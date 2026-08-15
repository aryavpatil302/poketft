import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import type { OffsetCoord } from '../hexGrid'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { findNearestEnemies } from '../systems/targeting'
import { startLeap, claimHex } from '../systems/movement'
import { hexDistance } from '../hexGrid'
import { removeStatusEffectByStack } from '../systems/statusEffect'
import { computeStats } from '../unitFactory'

const BLITZ_TICKS  = 12   // ~0.2s per dash into a target
const RETURN_TICKS = 12   // ~0.2s dash back home
const HIT_RADIUS   = 2    // extra victims must be within 2 hexes of the primary target

// The Zen "first cast deals 50% more" one-shot marker (added by applyZen).
const ZEN_EMPOWER_STACK = 'zen_empower_cast'

export const DarmanitanAbility: AbilityHandler = {
  abilityId: 'darmanitan_flair_blitz',
  castTimeTicks: 12,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dmgPcts = [500, 700, 1000] as const
    let damage = Math.round(computeStats(unit).attack * (dmgPcts[tier - 1] / 100))

    // First Flair Blitz after entering Zen deals 50% more (consumes the marker).
    let zenFrac = 0   // fraction of this cast's damage from the Zen empower → attributed to Zen
    if (unit.statusEffects.some(fx => fx.stackId === ZEN_EMPOWER_STACK)) {
      damage = Math.round(damage * 1.5)
      zenFrac = 0.5 / 1.5
      removeStatusEffectByStack(unit, ZEN_EMPOWER_STACK)
    }

    // Primary = current auto-attack target if it's a live enemy, else nearest.
    const atkTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const [nearest] = findNearestEnemies(unit, state, 1)
    const primary = (atkTarget && atkTarget.state !== 'dead' && atkTarget.team !== unit.team)
      ? atkTarget : nearest
    if (!primary) return

    // Extra victims after the primary, each ordered by distance from the primary
    // so the blitz path stays sensible. Tier 1-2: the two closest enemies within
    // HIT_RADIUS. Tier 3: EVERY other living enemy on the board, no range cap.
    const others = [...state.units.values()]
      .filter(u => u.team !== unit.team && u.state !== 'dead' && u.id !== primary.id)
      .sort((a, b) => hexDistance(primary.hexPos, a.hexPos) - hexDistance(primary.hexPos, b.hexPos))
    const extras = tier >= 3
      ? others
      : others.filter(u => hexDistance(u.hexPos, primary.hexPos) <= HIT_RADIUS).slice(0, 2)

    const targetIds = [primary.id, ...extras.map(u => u.id)]
    const homeHex: OffsetCoord = { ...unit.hexPos }

    // Fire-behind-caster VFX flag for the whole blitz sequence (removed on return).
    unit.statusEffects.push({
      id: 'flair_blitz_active',
      sourceUnitId: unit.id,
      durationTicks: -1,
      stackId: 'flair_blitz_active',
    })

    blitzNext(unit, state, targetIds, 0, damage, homeHex, zenFrac)
    unit.state = 'leaping'
  },
}

function blitzNext(
  unit: Unit,
  state: CombatState,
  targetIds: string[],
  index: number,
  damage: number,
  homeHex: OffsetCoord,
  zenFrac = 0,
): void {
  // Skip already-dead targets; stop when the list is exhausted.
  while (index < targetIds.length) {
    const t = state.units.get(targetIds[index])
    if (t && t.state !== 'dead') break
    index++
  }
  if (index >= targetIds.length) {
    returnHome(unit, state, homeHex)
    return
  }

  const target  = state.units.get(targetIds[index])!
  const destHex: OffsetCoord = { ...target.hexPos }
  const dist    = Math.max(1, hexDistance(unit.hexPos, destHex))
  const haste   = Math.max(0, (TICK_RATE * dist) / (BLITZ_TICKS * unit.moveSpeed) - 1)

  startLeap(unit, destHex, state, haste, (u, s) => {
    const tgt = s.units.get(target.id)
    if (tgt && tgt.state !== 'dead') {
      applyDamage(u, tgt, {
        baseAmount: damage,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'darmanitan_flair_blitz',
        traitFrac: zenFrac > 0 ? { trait: 'zen', frac: zenFrac } : undefined,
      }, s)
    }
    blitzNext(u, s, targetIds, index + 1, damage, homeHex, zenFrac)
  }, undefined, true)   // visual-only: hexPos stays home until the sequence ends
  unit.state = 'leaping'
}

function returnHome(unit: Unit, state: CombatState, dest: OffsetCoord): void {
  const haste = Math.max(0, TICK_RATE / (RETURN_TICKS * unit.moveSpeed) - 1)
  startLeap(unit, dest, state, haste, (u, s) => {
    // Visual-only leaps didn't move hexPos; commit it now. dest may have been
    // taken mid-flight — claimHex falls back to the nearest open hex.
    claimHex(u, dest, s)
    removeStatusEffectByStack(u, 'flair_blitz_active')
    u.state = 'idle'
  }, undefined, true)
  unit.state = 'leaping'
}
