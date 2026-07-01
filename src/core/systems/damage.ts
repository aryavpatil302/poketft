import type { Unit, CombatState, DamagePayload } from '../types'
import { computeStats } from '../unitFactory'
import { hexId } from '../hexGrid'

// ─── Mitigation formula ───────────────────────────────────────────────────────
// Same formula as League of Legends:
//   armor >= 0 → reduction = armor / (armor + 100)
//   armor <  0 → reduction = 1 - (100 / (100 - armor))  which gives a multiplier > 1

export function mitigationFactor(resistance: number): number {
  if (resistance >= 0) {
    return resistance / (resistance + 100)
  } else {
    return 1 - 100 / (100 - resistance)
  }
}

export function rollCrit(unit: Unit): boolean {
  const stats = unit._computedStats
  const chance = stats ? stats.critChance : unit.critChance
  return Math.random() < chance
}

// ─── Shield absorption ────────────────────────────────────────────────────────
// Returns the remaining damage after shields have absorbed as much as possible.
// Shields absorb from front (index 0) to back.

function absorbWithShields(unit: Unit, damage: number, _state: CombatState): number {
  let remaining = damage
  for (const shield of unit.shields) {
    if (shield.value <= 0 || remaining <= 0) continue
    const absorbed = Math.min(shield.value, remaining)
    shield.value -= absorbed
    remaining -= absorbed
    if (shield.value <= 0) {
      // Shield broke — fire onExpire
      if (shield.onExpire) shield.onExpire(unit, shield)
    }
  }
  // Remove broken shields
  unit.shields = unit.shields.filter(s => s.value > 0)
  return remaining
}

// ─── Main damage pipeline ─────────────────────────────────────────────────────

export interface ApplyDamageResult {
  finalDamage: number    // damage that actually hit HP (after shields)
  preMitigDamage: number // damage before mitigation (for mana gain)
  isCrit: boolean
}

export function applyDamage(
  source: Unit,
  target: Unit,
  payload: DamagePayload,
  state: CombatState,
): ApplyDamageResult {
  if (target.state === 'dead') return { finalDamage: 0, preMitigDamage: 0, isCrit: false }

  const targetStats = target._computedStats ?? computeStats(target)
  const sourceStats = source._computedStats ?? computeStats(source)

  // Scaling (e.g. ability scales with special)
  let base = payload.baseAmount
  if (payload.scalingStat && payload.scalingRatio) {
    const scaleStat = payload.scalingStat === 'attack' ? sourceStats.attack : sourceStats.special
    base += scaleStat * payload.scalingRatio
  }

  // Incoming damage multiplier (Future Sight, etc.)
  if (target.incomingDamageMult !== 1.0) {
    base = Math.round(base * target.incomingDamageMult)
  }

  // Crit
  let isCrit = false
  if (payload.canCrit && rollCrit(source)) {
    base *= sourceStats.critDamage
    isCrit = true
  }

  const preMitigDamage = Math.round(base)

  // Track cumulative pre-mitigation damage for targeting heuristics
  target.damageTakenThisCombat += preMitigDamage

  // Mitigation
  let finalPreShield = preMitigDamage
  if (payload.damageType === 'physical') {
    const effectiveDefense = payload.armorPiercePct
      ? targetStats.defense * (1 - payload.armorPiercePct)
      : targetStats.defense
    const red = mitigationFactor(effectiveDefense)
    finalPreShield = Math.round(preMitigDamage * (1 - red))
  } else if (payload.damageType === 'magic') {
    const effectiveSpDef = payload.spDefPiercePct
      ? targetStats.spDefense * (1 - payload.spDefPiercePct)
      : targetStats.spDefense
    const red = mitigationFactor(effectiveSpDef)
    finalPreShield = Math.round(preMitigDamage * (1 - red))
  }
  // true damage: no mitigation

  // Shields absorb before HP
  const hpDamage = absorbWithShields(target, finalPreShield, state)

  // Apply HP damage
  target.currentHp = Math.max(0, target.currentHp - hpDamage)

  // Track damage dealt by the source
  source.damageDealtThisCombat += hpDamage

  // Omnivamp: heal source for a fraction of HP damage dealt
  if (hpDamage > 0 && source.state !== 'dead') {
    const sourceStats = source._computedStats
    if (sourceStats && sourceStats.omnivamp > 0) {
      const heal = Math.round(hpDamage * sourceStats.omnivamp)
      if (heal > 0) {
        source.currentHp = Math.min(source.maxHp, source.currentHp + heal)
        state.events.push({ type: 'heal', targetId: source.id, amount: heal, sourceId: source.id })
      }
    }
  }

  // Emit event
  state.events.push({
    type: 'damage',
    targetId: target.id,
    amount: hpDamage,
    damageType: payload.damageType,
    isCrit,
    sourceId: source.id,
    abilityId: payload.abilityId,
  })

  // Death check
  if (target.currentHp <= 0) {
    target.currentHp = 0
    target.state = 'dead'
    state.hexOccupancy.delete(hexId(target.hexPos))
    state.events.push({ type: 'death', unitId: target.id, sourceId: source.id, abilityId: payload.abilityId })
  }

  // Iron Barbs retaliation — auto-attacks hitting an active Ferrothorn bounce damage back
  if (payload.abilityId === 'auto_attack' && target.state !== 'dead' && source.state !== 'dead') {
    const ironBarbs = target.statusEffects.find(fx => fx.id === 'iron_barbs')
    if (ironBarbs?.magnitude) {
      applyDamage(target, source, {
        baseAmount: ironBarbs.magnitude,
        damageType: 'magic',
        canCrit: false,
        abilityId: 'ferrothorn_iron_barbs',
      }, state)
      // Refresh hit-flash pulse on Ferrothorn (scale bump handled in unitLayer)
      const flashIdx = target.statusEffects.findIndex(fx => fx.stackId === 'ferrothorn_hit_flash')
      if (flashIdx >= 0) {
        target.statusEffects[flashIdx].durationTicks = 10
      } else {
        target.statusEffects.push({
          id: 'ferrothorn_hit_flash',
          sourceUnitId: target.id,
          durationTicks: 10,
          stackId: 'ferrothorn_hit_flash',
        })
      }
    }
  }

  // Bellibolt: accumulate a charge on any incoming hit
  if (target.definitionId === 'bellibolt' && target.state !== 'dead') {
    const existing = target.statusEffects.find(fx => fx.stackId === 'bellibolt_charge')
    if (existing) {
      if ((existing.magnitude ?? 0) < 10) {
        existing.magnitude = (existing.magnitude ?? 0) + 1
        target._computedStats = null
      }
    } else {
      target.statusEffects.push({
        id: 'bellibolt_charge',
        sourceUnitId: target.id,
        durationTicks: -1,
        magnitude: 1,
        stackId: 'bellibolt_charge',
      })
      target._computedStats = null
    }
  }

  return { finalDamage: hpDamage, preMitigDamage, isCrit }
}
