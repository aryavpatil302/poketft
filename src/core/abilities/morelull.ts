import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { hexDistance } from '../hexGrid'

function findNearestEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

function findNearestAlly(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.id === unit.id || other.team !== unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

export const MorelullAbility: AbilityHandler = {
  abilityId: 'morelull_strength_sap',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues    = [120, 180, 300] as const
    const atkReducValues  = [15,  25,  40 ] as const
    const healValues      = [80,  120, 200] as const

    const damage    = damageValues[tier - 1]
    const atkReduc  = atkReducValues[tier - 1]
    const healAmt   = healValues[tier - 1]

    // Deal magic damage + atk reduction to current attack target, fallback nearest enemy
    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const enemy = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemy(unit, state)
    if (enemy) {
      applyDamage(unit, enemy, {
        baseAmount: damage,
        damageType: 'magic',
        canCrit: false,
        abilityId: 'morelull_strength_sap',
      }, state)

      if (enemy.state !== 'dead') {
        addStatusEffect(enemy, {
          id: 'atk_reduction',
          sourceUnitId: unit.id,
          durationTicks: 3 * TICK_RATE,
          magnitude: atkReduc,
          stackId: `morelull_atkreduc_${enemy.id}_${state.tick}`,
        })
      }
    }

    // Heal nearest ally
    const ally = findNearestAlly(unit, state)
    if (ally) {
      applyHeal(ally, healAmt, unit.id, state)
    }
  },
}
