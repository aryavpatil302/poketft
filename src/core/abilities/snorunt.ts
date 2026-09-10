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
    const baseShield   = Math.round(shieldValues[tier - 1] * spMult)
    // Shiny Snorunt: Ice Body shields for 1.5x as much (single computation
    // site — see src/core/systems/shinyEffects/snorunt.ts for the registry
    // entry documenting this).
    const shieldAmount = unit.isShiny ? Math.round(baseShield * 1.5) : baseShield

    const shield: Shield = {
      id: `snorunt_ice_body_${unit.id}_${state.tick}`,
      sourceAbility: 'snorunt_ice_body',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: 3 * TICK_RATE,
    }

    // Shiny scales this shield ×1.5. addShield has no fractional-credit param, so
    // when shiny the whole shield (and the damage it absorbs) is credited to the
    // shiny rollup — a magnitude proxy, not just the marginal +50%.
    addShield(unit, shield, state, unit.isShiny ? 'shiny:' + unit.definitionId : undefined)
  },
}
