import type { Unit, CombatState, AttackModifier } from '../types'
import { TICK_RATE, WINDUP_FRACTION, WINDUP_HIT_FRACTION } from '../constants'
import { computeStats } from '../unitFactory'
import { applyDamage } from './damage'
import { gainManaOnHit, gainManaOnDamageTaken } from './mana'
import { hexDistance, hexesInRange, hexId } from '../hexGrid'
import { createProjectile } from '../projectile'
import { addStatusEffect } from './statusEffect'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    // Start windup
    unit.isInWindup = true
    unit.attackWindupTimer = windupTicks(unit)
    return
  }

  // In windup — tick down, fire at peak, let retract animation finish
  unit.attackWindupTimer--

  const total     = windupTicks(unit)
  const hitElapsed = Math.max(1, Math.round(total * WINDUP_HIT_FRACTION))
  const elapsed    = total - unit.attackWindupTimer
  if (elapsed === hitElapsed) {
    fireAttack(unit, target, stats, state)
    // Rapid follow-up: skip the return animation so the next swing starts almost immediately
    if (unit.attackModifiers.length > 0 && unit.attackModifiers[0].instantFollowUp) {
      unit.attackWindupTimer = 0
    }
  }

  if (unit.attackWindupTimer > 0) return

  // Animation complete — reset for next cycle
  unit.isInWindup  = false
  unit.attackTimer = attackCooldownTicks(unit) - windupTicks(unit)

  // Rapid follow-up: if the next queued modifier wants to fire immediately, skip the cooldown
  if (unit.attackModifiers.length > 0 && unit.attackModifiers[0].instantFollowUp) {
    unit.attackTimer = 0
  }
}

function fireAttack(unit: Unit, target: Unit, stats: ReturnType<typeof computeStats>, state: CombatState): void {
  unit.attackCount++

  const isBlind = unit.statusEffects.some(fx => fx.id === 'blind')

  // Fire passive attack handlers (chain lightning, waves, etc.)
  const suppressBase = unit.passiveAttackHandlers.some(h => h.suppressBaseAttack)
  for (const handler of unit.passiveAttackHandlers) {
    handler.onAttack(unit, target, state)
  }

  const attackMod = unit.attackModifiers.length > 0 ? unit.attackModifiers[0] : null

  if (suppressBase) {
    // Handler owns all damage — just grant mana and process any modifier
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
        canCrit: true,
        abilityId: 'auto_attack',
      }, state)

      gainManaOnHit(unit)
      gainManaOnDamageTaken(target, result.preMitigDamage)

      if (attackMod && target.state !== 'dead') {
        applyAttackModifier(attackMod, unit, target, state)
      }
    }
  } else {
    // Ranged: launch projectile at animation peak
    // Blind: projectile still travels visually but carries no damage payload
    const capturedMod = attackMod
    const proj = createProjectile({
      sourceId: unit.id,
      targetId: target.id,
      startPos: { ...unit.visualPos },
      speed: capturedMod?.projectileSpeed ?? 8,
      // Bake the modifier's visual tag into the projectile at launch so the renderer
      // doesn't rely on the unit's runtime status (which may expire mid-flight)
      abilityId: capturedMod?.visualId,
      damagePayload: isBlind ? undefined : {
        baseAmount: stats.attack,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'auto_attack',
      },
      onHit: (!isBlind && capturedMod) ? (source, tgt, st) => {
        if (source) applyAttackModifier(capturedMod, source, tgt, st)
      } : undefined,
    })
    state.projectiles.set(proj.id, proj)
    if (!isBlind) gainManaOnHit(unit)
  }

  if (attackMod) {
    attackMod.remainingCharges--
    if (attackMod.remainingCharges <= 0) unit.attackModifiers.shift()
  }
}

function applyAttackModifier(mod: AttackModifier, source: Unit, target: Unit, state: CombatState): void {
  if (mod.bonusDamage && mod.bonusDamage > 0) {
    const dmgType = mod.bonusDamageType ?? 'physical'
    applyDamage(source, target, { baseAmount: mod.bonusDamage, damageType: dmgType, canCrit: false }, state)
  }
  if (mod.maxHealthPercent && mod.maxHealthPercent > 0) {
    const bonus = Math.round(target.maxHp * mod.maxHealthPercent)
    applyDamage(source, target, { baseAmount: bonus, damageType: 'true', canCrit: false }, state)
  }
  if (mod.aoeRadius && mod.aoeRadius > 0) {
    for (const hex of hexesInRange(target.hexPos, mod.aoeRadius)) {
      const splashId = state.hexOccupancy.get(hexId(hex))
      if (!splashId || splashId === target.id) continue
      const splash = state.units.get(splashId)
      if (!splash || splash.team === source.team || splash.state === 'dead') continue
      applyDamage(source, splash, { baseAmount: Math.round((mod.bonusDamage ?? 0) * 0.5), damageType: mod.bonusDamageType ?? 'magic', canCrit: false }, state)
    }
  }
  if (mod.knockUp) {
    addStatusEffect(target, { id: 'knockUp', sourceUnitId: source.id, durationTicks: 60, stackId: `knockup_${mod.id}` })
  }
  if (mod.onHit) mod.onHit(source, target, state)
}

// Called when unit enters attacking state to reset timers if needed
export function startAttacking(unit: Unit): void {
  unit.state = 'attacking'
  // Don't reset attackTimer here — preserves attack speed continuity
}
