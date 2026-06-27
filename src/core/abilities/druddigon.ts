import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
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

export const DruddigonAbility: AbilityHandler = {
  abilityId: 'druddigon_dragon_tail',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [250, 375, 600] as const
    const damage = damageValues[tier - 1]

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemy(unit, state)
    if (!target) return

    applyDamage(unit, target, {
      baseAmount: damage,
      damageType: 'physical',
      canCrit: true,
      abilityId: 'druddigon_dragon_tail',
    }, state)

    if (target.state === 'dead') return

    // If target's HP < caster's HP, knock the target up (knockback approximation)
    if (target.currentHp < unit.currentHp) {
      addStatusEffect(target, {
        id: 'knockUp',
        sourceUnitId: unit.id,
        durationTicks: Math.round(0.5 * TICK_RATE),
        stackId: `druddigon_knockup_${target.id}_${state.tick}`,
      })
    }
  },
}
