import type { Unit, CombatState, AttackModifier } from '../types'
import { TICK_RATE, WINDUP_FRACTION, WINDUP_HIT_FRACTION } from '../constants'
import { computeStats } from '../unitFactory'
import { applyDamage, rollCrit } from './damage'
import { gainManaOnHit, gainManaOnDamageTaken } from './mana'
import { hexDistance, hexesInRange, hexId } from '../hexGrid'
import { createProjectile } from '../projectile'
import { addStatusEffect } from './statusEffect'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// An auto counts as "empowered" (for reporting) when the unit has an active attack
// modifier (Tapu Koko's surge, Armarouge's cannon autos, Weavile, A-Marowak, …) OR
// is in an empowered form. Extend EMPOWERED_FORM_STATUS as new forms are added.
const EMPOWERED_FORM_STATUS = new Set(['salamence_enraged'])
function isEmpoweredAuto(unit: Unit): boolean {
  return unit.attackModifiers.length > 0 || unit.statusEffects.some(fx => EMPOWERED_FORM_STATUS.has(fx.id))
}

// MAX_ATTACK_SPEED is enforced once, at the source, in computeStats
// (unitFactory.ts) — stats.attackSpeed here is already capped.
export function attackCooldownTicks(unit: Unit): number {
  const stats = unit._computedStats ?? computeStats(unit)
  return Math.round(TICK_RATE / stats.attackSpeed)
}

export function windupTicks(unit: Unit): number {
  return Math.round(attackCooldownTicks(unit) * WINDUP_FRACTION)
}

// Whether the unit is in range of its target
export function isInRange(unit: Unit, state: CombatState): boolean {
  if (!unit.targetId) return false
  const target = state.units.get(unit.targetId)
  if (!target || target.state === 'dead') return false
  const stats = unit._computedStats ?? computeStats(unit)
  return hexDistance(unit.hexPos, target.hexPos) <= stats.range
}

// ─── Attack tick ──────────────────────────────────────────────────────────────
// Call this each tick when unit.state === 'attacking'

export function tickAttack(unit: Unit, state: CombatState): void {
  if (!unit.targetId) { unit.state = 'idle'; return }
  const target = state.units.get(unit.targetId)
  if (!target || target.state === 'dead') { unit.state = 'idle'; return }

  // Check still in range
  if (!isInRange(unit, state)) {
    unit.state = 'moving'
    unit.isInWindup = false
    unit.attackWindupTimer = 0
    return
  }

  const stats = unit._computedStats ?? computeStats(unit)

  if (!unit.isInWindup) {
    // Waiting for attack cooldown
    if (unit.attackTimer > 0) {
      unit.attackTimer--
      return
    }
    // Start windup — pre-roll crit so renderer can show lunge before damage lands
    unit.isInWindup = true
    unit.pendingCrit = rollCrit(unit)
    const startMod = unit.attackModifiers.length > 0 ? unit.attackModifiers[0] : null
    unit.attackWindupTimer = startMod?.extendedWindupTicks ?? windupTicks(unit)
    return
  }

  // In windup — tick down, fire at peak, let retract animation finish
  unit.attackWindupTimer--

  const curMod     = unit.attackModifiers.length > 0 ? unit.attackModifiers[0] : null
  const total      = curMod?.extendedWindupTicks ?? windupTicks(unit)
  const hitElapsed = Math.max(1, Math.round(total * WINDUP_HIT_FRACTION))
  const elapsed    = total - unit.attackWindupTimer
  if (elapsed === hitElapsed) {
    fireAttack(unit, target, stats, state)
    // Rapid follow-up: skip the return animation so the next swing starts almost immediately
    const nextMod = unit.attackModifiers.length > 0 ? unit.attackModifiers[0] : null
    if (nextMod?.instantFollowUp || nextMod?.followUpDelayTicks !== undefined) {
      unit.attackWindupTimer = 0
    }
  }

  if (unit.attackWindupTimer > 0) return

  // Animation complete — reset for next cycle
  unit.isInWindup  = false
  unit.pendingCrit = false
  unit.attackTimer = attackCooldownTicks(unit) - windupTicks(unit)

  // Rapid follow-up: if the next queued modifier wants to fire immediately, skip the cooldown
  const nextMod = unit.attackModifiers.length > 0 ? unit.attackModifiers[0] : null
  if (nextMod?.instantFollowUp) {
    unit.attackTimer = 0
  } else if (nextMod?.followUpDelayTicks !== undefined) {
    unit.attackTimer = nextMod.followUpDelayTicks
  }
}

function fireAttack(unit: Unit, target: Unit, stats: ReturnType<typeof computeStats>, state: CombatState): void {
  unit.attackCount++

  const attackMod0 = unit.attackModifiers.length > 0 ? unit.attackModifiers[0] : null
  const isBlind = unit.statusEffects.some(fx => fx.id === 'blind') && !attackMod0?.ignoreBlind
  const empoweredAuto = isEmpoweredAuto(unit)   // captured before the modifier is consumed below

  // Fire passive attack handlers (chain lightning, waves, etc.)
  const suppressBase = unit.passiveAttackHandlers.some(h => h.suppressBaseAttack)
                    || (attackMod0?.suppressBaseAttack ?? false)
  for (const handler of unit.passiveAttackHandlers) {
    handler.onAttack(unit, target, state)
  }

  const attackMod = attackMod0

  if (suppressBase) {
    // Modifier (or handler) owns all damage — skip base auto, just grant mana and apply modifier
    if (!isBlind) gainManaOnHit(unit)
    if (attackMod && target.state !== 'dead') {
      applyAttackModifier(attackMod, unit, target, state)
    }
  } else if (stats.range <= 1) {
    // Melee: instant damage at animation peak
    if (isBlind) {
      // Attack animation fires, but no damage or mana on connect
      state.events.push({ type: 'miss', sourceId: unit.id, targetId: target.id })
    } else {
      const result = applyDamage(unit, target, {
        baseAmount: stats.attack,
        damageType: 'physical',
        canCrit: false,
        forceCrit: unit.pendingCrit,
        abilityId: 'auto_attack',
        empowered: empoweredAuto,
      }, state)

      if (!(attackMod?.suppressManaGain)) gainManaOnHit(unit)
      gainManaOnDamageTaken(target, result.preMitigDamage)

      if (attackMod) {
        applyAttackModifier(attackMod, unit, target, state)
      }
    }
  } else {
    // Ranged: launch projectile at animation peak
    // Blind: projectile still travels visually but carries no damage payload
    const capturedMod = attackMod
    const capturedHandlers = unit.passiveAttackHandlers.filter(h => h.onProjectileHit)
    const suppressMana = capturedMod?.suppressManaGain ?? false
    const baseSpeed = capturedMod?.projectileSpeed ?? 10.4  // base auto projectile speed (8 × 1.3, +30%)
    const projSpeed = unit.statusEffects.some(fx => fx.stackId === 'aerodactyl_ancient_power_applied')
      ? baseSpeed * 1.2
      : baseSpeed
    const proj = createProjectile({
      sourceId: unit.id,
      targetId: target.id,
      startPos: { ...unit.visualPos },
      speed: projSpeed,
      // Bake the modifier's visual tag into the projectile at launch so the renderer
      // doesn't rely on the unit's runtime status (which may expire mid-flight)
      abilityId: capturedMod?.visualId,
      damagePayload: isBlind ? undefined : {
        baseAmount: stats.attack,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'auto_attack',
        empowered: empoweredAuto,
      },
      onHit: !isBlind ? (source, tgt, st) => {
        // Attacker gains mana when the shot LANDS, not when it is launched. (If the
        // target dies mid-flight the projectile is dropped without firing onHit, so
        // a whiffed ranged auto grants no mana — intended.)
        if (source && !suppressMana) gainManaOnHit(source)
        if (capturedMod && source) applyAttackModifier(capturedMod, source, tgt, st)
        if (source) {
          for (const h of capturedHandlers) h.onProjectileHit!(source, tgt, st)
        }
      } : undefined,
    })
    state.projectiles.set(proj.id, proj)
  }

  if (attackMod) {
    attackMod.remainingCharges--
    if (attackMod.remainingCharges <= 0) unit.attackModifiers.shift()
  }
}

function applyAttackModifier(mod: AttackModifier, source: Unit, target: Unit, state: CombatState): void {
  // Everything a modifier deals (its bonus, AoE splash, and custom onHit — Armarouge's
  // cannon AoE, Tapu Koko's chain, …) is part of an empowered auto. Flag the source so
  // damage.ts tags that damage empowered, then restore.
  const prevEmpowered = source._empoweredAuto
  source._empoweredAuto = true
  try {
  // Bonus/splash damage is ability-shaped (tagged with abilityId, not the auto
  // marker), so it only crits if the source holds Leek/Razor Claw — see the
  // abilityCanCrit gate in damage.ts. canCrit: true here just opts in; the gate
  // still requires source.abilitiesCanCrit === true.
  const modAbilityId = mod.visualId ?? mod.id
  if (target.state !== 'dead') {
    if (mod.bonusDamage && mod.bonusDamage > 0) {
      const dmgType = mod.bonusDamageType ?? 'physical'
      applyDamage(source, target, { baseAmount: mod.bonusDamage, damageType: dmgType, canCrit: true, abilityId: modAbilityId, beachyFrac: mod.bonusBeachyFrac }, state)
    }
    if (mod.maxHealthPercent && mod.maxHealthPercent > 0) {
      const bonus = Math.round(target.maxHp * mod.maxHealthPercent)
      applyDamage(source, target, { baseAmount: bonus, damageType: 'true', canCrit: true, abilityId: modAbilityId }, state)
    }
    if (mod.knockUp) {
      addStatusEffect(target, { id: 'knockUp', sourceUnitId: source.id, durationTicks: 60, stackId: `knockup_${mod.id}` })
    }
  }
  if (mod.aoeRadius && mod.aoeRadius > 0) {
    for (const hex of hexesInRange(target.hexPos, mod.aoeRadius)) {
      const splashId = state.hexOccupancy.get(hexId(hex))
      if (!splashId || splashId === target.id) continue
      const splash = state.units.get(splashId)
      if (!splash || splash.team === source.team || splash.state === 'dead') continue
      applyDamage(source, splash, { baseAmount: Math.round((mod.bonusDamage ?? 0) * 0.5), damageType: mod.bonusDamageType ?? 'magic', canCrit: true, abilityId: modAbilityId }, state)
    }
  }
  if (mod.onHit) mod.onHit(source, target, state)
  } finally {
    source._empoweredAuto = prevEmpowered
  }
}

// Called when unit enters attacking state to reset timers if needed
export function startAttacking(unit: Unit): void {
  unit.state = 'attacking'
  // Don't reset attackTimer here — preserves attack speed continuity
}
