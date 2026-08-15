import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

export const SnorunAbility: AbilityHandler = {
  abilityId: 'snorunt_ice_body',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues = [150, 200, 300] as const
    const spMult       = (unit._computedStats ?? computeStats(unit)).special / 100
    const shieldAmount = Math.round(shieldValues[tier - 1] * spMult)

    const shield: Shield = {
      id: `snorunt_ice_body_${unit.id}_${state.tick}`,
      sourceAbility: 'snorunt_ice_body',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: 3 * TICK_RATE,
    }

    addShield(unit, shield, state)
  },
}
