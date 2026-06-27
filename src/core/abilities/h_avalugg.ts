import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'

export const HAvaluggAbility: AbilityHandler = {
  abilityId: 'h_avalugg_mountain_gale',
  castTimeTicks: 25,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const targetCounts = [3, 4, 5] as const
    const damageValues = [200, 300, 500] as const
    const stunSeconds  = [1.5, 2.0, 3.0] as const

    const count      = targetCounts[tier - 1]
    const damage     = damageValues[tier - 1]
    const stunTicks  = Math.round(stunSeconds[tier - 1] * TICK_RATE)

    const targets = findNearestEnemies(unit, state, count)

    for (const target of targets) {
      applyDamage(unit, target, {
        baseAmount: damage,
        damageType: 'physical',
        canCrit: false,
        abilityId: 'h_avalugg_mountain_gale',
      }, state)

      if (target.state === 'dead') continue

      addStatusEffect(target, {
        id: 'knockUp',
        sourceUnitId: unit.id,
        durationTicks: stunTicks,
        stackId: `h_avalugg_knockup_${target.id}`,
      })
    }
  },
}
