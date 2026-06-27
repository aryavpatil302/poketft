import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { startLeap } from '../systems/movement'
import { hexId, getNeighbors, isValidHex } from '../hexGrid'
import { findFurthestEnemyInRange } from '../systems/targeting'

const LEAP_HASTE = 4.0

export const ExcadrillAbility: AbilityHandler = {
  abilityId: 'excadrill_drill_run',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const knockUpDurations = [1.5, 2,   3  ] as const
    const damageValues     = [200, 300, 500] as const
    const bonusDamages     = [50,  75,  120] as const

    const knockUpDuration = knockUpDurations[tier - 1]
    const damageAmount    = damageValues[tier - 1]
    const bonusDamage     = bonusDamages[tier - 1]

    // Find furthest enemy within 3 hexes
    const leapTarget = findFurthestEnemyInRange(unit, state, 3)
      ?? (unit.targetId ? (state.units.get(unit.targetId) ?? null) : null)

    if (!leapTarget || leapTarget.state === 'dead') return

    // Find a free adjacent hex next to the target
    const candidates = getNeighbors(leapTarget.hexPos).filter(h => {
      if (!isValidHex(h)) return false
      const occupant = state.hexOccupancy.get(hexId(h))
      return !occupant || occupant === unit.id
    })

    const dest = candidates[0]
    if (!dest) return

    startLeap(unit, dest, state, LEAP_HASTE)

    // Apply knockUp immediately
    addStatusEffect(leapTarget, {
      id: 'knockUp',
      sourceUnitId: unit.id,
      durationTicks: Math.round(knockUpDuration * TICK_RATE),
      stackId: `excadrill_knockup_${leapTarget.id}`,
    })

    // Apply physical damage immediately
    applyDamage(unit, leapTarget, {
      baseAmount: damageAmount,
      damageType: 'physical',
      canCrit: true,
      abilityId: 'excadrill_drill_run',
    }, state)

    // Push 3 attack modifiers with AoE
    for (let i = 0; i < 3; i++) {
      unit.attackModifiers.push({
        id: 'excadrill_drill',
        remainingCharges: 1,
        bonusDamage,
        bonusDamageType: 'physical',
        aoeRadius: 1,
      })
    }

    unit.targetId = leapTarget.id
    unit.state = 'leaping'
  },
}
