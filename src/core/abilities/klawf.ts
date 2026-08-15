import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'

export const KlawfAbility: AbilityHandler = {
  abilityId: 'klawf_anger_shell',
  castTimeTicks: 12,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const atkSpdValues = [0.50, 0.75, 1.00] as const
    const DURATION = 4 * TICK_RATE

    addStatusEffect(unit, {
      id: 'atkSpd_buff',
      sourceUnitId: unit.id,
      durationTicks: DURATION,
      magnitude: atkSpdValues[tier - 1],
      stackId: 'klawf_speed',
    })
    addStatusEffect(unit, {
      id: 'crit_chance_buff',
      sourceUnitId: unit.id,
      durationTicks: DURATION,
      magnitude: 0.50,
      stackId: 'klawf_crit',
    })
  },
}
