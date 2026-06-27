import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'
import { startLeap } from '../systems/movement'
import { hexId, getNeighbors, isValidHex } from '../hexGrid'
import { findFurthestEnemyInRange } from '../systems/targeting'

export const KlawfAbility: AbilityHandler = {
  abilityId: 'klawf_anger_shell',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues  = [150, 225, 350] as const
    const atkSpdValues  = [0.30, 0.50, 0.80] as const
    const atkBonusValues = [20, 30, 50] as const

    const shieldAmount = shieldValues[tier - 1]
    const atkSpdBonus  = atkSpdValues[tier - 1]
    const atkBonus     = atkBonusValues[tier - 1]

    // Find furthest enemy within 2 hexes
    const leapTarget = findFurthestEnemyInRange(unit, state, 2)

    if (leapTarget) {
      // Find a free adjacent hex next to the target
      const candidates = getNeighbors(leapTarget.hexPos).filter(h => {
        if (!isValidHex(h)) return false
        const occupant = state.hexOccupancy.get(hexId(h))
        return !occupant || occupant === unit.id
      })
      const dest = candidates[0]
      if (dest) {
        startLeap(unit, dest, state, 4.0)
        unit.state = 'leaping'
      }
    }

    // Shield (permanent until broken)
    const shield: Shield = {
      id: `klawf_anger_shell_shield_${unit.id}_${state.tick}`,
      sourceAbility: 'klawf_anger_shell',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: -1,
    }
    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmount })

    // Attack speed buff that decays after 4 seconds
    addStatusEffect(unit, {
      id: 'atkSpd_buff',
      sourceUnitId: unit.id,
      durationTicks: 4 * TICK_RATE,
      magnitude: atkSpdBonus,
      stackId: 'klawf_speed',
    })

    // Flat attack bonus (permanent)
    addStatusEffect(unit, {
      id: 'dmg_buff',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude: atkBonus,
      stackId: 'klawf_atkbuff',
    })
  },
}
