import type { Unit, CombatState } from '../types'

// This file has TWO separate mechanics that merely share one hook:
//
// 1. A universal stat passive, applied unconditionally to every `isShiny`
//    unit regardless of registry contents — see `SHINY_STAT_MULT` and the
//    block at the top of `initShinyEffects`'s per-unit loop. This is baked
//    directly into the unit's stored base stats, not a status effect.
//
// 2. A `definitionId` → effect registry consulted once at combat setup for
//    units carrying `isShiny`, dispatched AFTER the universal pass above. It
//    ships with no entries, so today it is a no-op; the seam exists so
//    per-species shiny effects can be added later without touching the
//    combat engine again. A registered per-species effect STACKS ON TOP of
//    the universal bonus — it does not replace it.
//
// When `onCombatStart` fires: exactly once per shiny unit per combat, during
// `createCombatState`, after ability passives, item passives, and trait
// effects have all initialised (see the wiring at the bottom of
// `combatEngine.ts` — `initShinyEffects(state)` runs immediately after
// `initTraitEffects(state)`). Not per tick, not per cast. There is no
// teardown hook — anything granted here lasts the whole combat.
//
// Team-wide effects: iterate `state.units.values()` and filter allies with
// `u.team === self.team && !u.isDummy` — the same filter the trait
// initialisers use (`traitEffects.ts:63`, and five sibling call sites).
// There is no `state !== 'dead'` check in those init filters — nothing is
// dead at combat start, so the exclusion that actually matters is
// `isDummy` (test-mode training dummies). The Promoter aura
// (`traitEffects.ts:1160-1195`) is the closest existing loop to copy for
// *shape*. For shields, call `addShield(unit, shield, state, traitSource?)`
// from `./shield`, which applies healBlock reduction and `healShieldPower`
// scaling and emits the `shield` combat event the renderer consumes.
// Promoter's own inline shield push at `traitEffects.ts:1180` (a manual
// `ally.shields.push(shield)` plus a manual `state.events.push(...)`)
// predates that helper and skips both — its loop shape is worth copying,
// its shield grant is not.
//
// Self-only effects: prefer `addStatusEffect` from `./statusEffect` with
// `durationTicks: -1` and a unique `stackId` so it is read lazily by
// `computeStats` and cannot double-apply; write a field directly only when
// a dedicated stat field already exists. `src/data/items/life_orb.ts:19-37`
// does both in one passive (a direct `unit.abilityDamageMult` write plus an
// `addStatusEffect` with a `stackId` guard) and is the reference.
//
// How to register: call `registerShinyEffect('<definitionId>', <Effect>)`
// (or the equivalent `SHINY_EFFECT_REGISTRY.set(...)`) and add that call to
// the `Registrations` section at the bottom of this file, one per line,
// with the effect object defined above it or imported — exactly how
// `ability.ts` registers `AbilityHandler`s at the bottom of that file.

// ─── Shiny effect interface ────────────────────────────────────────────────────

export interface ShinyEffect {
  id: string
  description: string   // surfaced in the shop tooltip once effects exist
  onCombatStart(self: Unit, state: CombatState): void  // called once per shiny unit when combat begins
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const SHINY_EFFECT_REGISTRY = new Map<string, ShinyEffect>()

export function registerShinyEffect(definitionId: string, effect: ShinyEffect): void {
  SHINY_EFFECT_REGISTRY.set(definitionId, effect)
}

export function getShinyEffect(definitionId: string): ShinyEffect | undefined {
  return SHINY_EFFECT_REGISTRY.get(definitionId)
}

// ─── Universal stat passive ─────────────────────────────────────────────────────

// Flat +5% applied to six stored base stats on every shiny unit, always,
// independent of the (currently empty) per-species registry below.
const SHINY_STAT_MULT = 1.05

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function initShinyEffects(state: CombatState): void {
  for (const unit of state.units.values()) {
    // isShiny gates dispatch first — the registry is keyed by bare
    // definitionId, so a lookup-first implementation would fire a shiny
    // effect on every ordinary copy of that species.
    if (!unit.isShiny) continue

    // ─── Universal +5% base-stat bump ───────────────────────────────────────
    // Mutates the unit's STORED base fields directly, the same way
    // scaleHp/scaleAtk in unitFactory.ts bake star-tier scaling into stored
    // base fields once at construction — a shiny bonus is equally permanent
    // and unit-level, just baked in at combat start instead. This composes
    // on top of whatever star-tier scaling already ran during makeUnit(),
    // since it reads the already-scaled unit.maxHp/attack/etc.
    unit.maxHp = Math.round(unit.maxHp * SHINY_STAT_MULT)
    // Assign (do not multiply) currentHp from the NEW maxHp — this ordering
    // is what makes double-derivation impossible and keeps the unit at full
    // health entering combat.
    unit.currentHp = unit.maxHp
    unit.attack = Math.round(unit.attack * SHINY_STAT_MULT)
    unit.special = Math.round(unit.special * SHINY_STAT_MULT)
    unit.defense = Math.round(unit.defense * SHINY_STAT_MULT)
    unit.spDefense = Math.round(unit.spDefense * SHINY_STAT_MULT)
    // attackSpeed is left unrounded — it's a fractional value in the
    // 0.5–1.5 range (e.g. Tangela is 0.50), so rounding would collapse it
    // to a whole number and destroy the stat entirely.
    unit.attackSpeed *= SHINY_STAT_MULT
    // Invalidate the computed-stats cache so this boost is visible on the
    // very first tick, even though initTraitEffects (which runs earlier in
    // createCombatState) may already have populated it — same invalidation
    // idiom used throughout traitEffects.ts.
    unit._computedStats = null

    const effect = SHINY_EFFECT_REGISTRY.get(unit.definitionId)
    if (!effect) continue
    effect.onCombatStart(unit, state)
  }
}

// ─── Registrations ──────────────────────────────────────────────────────────
// Registered shiny effects go here, one registerShinyEffect(...) call per
// line — mirroring the registerAbility(...) block at the bottom of
// ability.ts. Empty for now: this step ships the seam, not the effects.
