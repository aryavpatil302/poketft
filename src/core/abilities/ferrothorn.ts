import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'

const DURATION_TICKS = 4 * TICK_RATE
const RUMBLE_TICKS   = 18

export const FerrothornAbility: AbilityHandler = {
  abilityId: 'ferrothorn_iron_barbs',
  castTimeTicks: 20,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const durabilityPcts  = [0.25, 0.30, 0.40] as const
    const retaliationDmgs = [75, 150, 225]      as const

    const durabilityPct  = durabilityPcts[tier - 1]
    const retaliationDmg = retaliationDmgs[tier - 1]

    // Multiplicative defense + spDefense buff for duration
    addStatusEffect(unit, {
      id: 'iron_barbs_durability',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      magnitude: durabilityPct,
      stackId: 'iron_barbs_durability',
    })

    // Retaliation marker — damage.ts reads magnitude to counter-hit auto-attackers
    addStatusEffect(unit, {
      id: 'iron_barbs',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      magnitude: retaliationDmg,
      stackId: 'iron_barbs',
    })

    // Brief post-cast shake as the barbs activate
    addStatusEffect(unit, {
      id: 'ferrothorn_rumble',
      sourceUnitId: unit.id,
      durationTicks: RUMBLE_TICKS,
      stackId: 'ferrothorn_rumble',
    })
  },
}
