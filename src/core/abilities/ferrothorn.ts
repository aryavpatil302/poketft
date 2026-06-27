import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'

export const FerrothornAbility: AbilityHandler = {
  abilityId: 'ferrothorn_iron_barbs',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const durationValues      = [4, 5, 6] as const
    const totalShieldValues   = [300, 400, 600] as const

    const duration    = durationValues[tier - 1]
    const totalShield = totalShieldValues[tier - 1]

    // Mark self with iron_barbs status for the duration
    // The status serves as a flag that other systems can check to deal retaliation damage
    addStatusEffect(unit, {
      id: 'iron_barbs',
      sourceUnitId: unit.id,
      durationTicks: duration * TICK_RATE,
      magnitude: totalShield / 4,   // per-hit retaliation damage stored in magnitude
      stackId: 'iron_barbs',
    })

    // Proxy the retaliation as an upfront shield for the duration of the effect
    // This approximates the total retaliation damage absorbed over the window
    const shield: Shield = {
      id: `ferrothorn_iron_barbs_${unit.id}_${state.tick}`,
      sourceAbility: 'ferrothorn_iron_barbs',
      value: totalShield,
      maxValue: totalShield,
      durationTicks: duration * TICK_RATE,
    }

    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: totalShield })
  },
}
