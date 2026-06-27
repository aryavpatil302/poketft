import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { startLeap } from '../systems/movement'
import { hexId, hexDistance, getNeighbors, isValidHex } from '../hexGrid'
const LEAP_HASTE = 4.0

export const GibleAbility: AbilityHandler = {
  abilityId: 'gible_bite',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const stunDurations = [1.5, 2.0, 2.5] as const
    const damageValues  = [150, 200, 275] as const

    const stunDuration = stunDurations[tier - 1]
    const damageAmount = damageValues[tier - 1]

    // Pick a random in-range enemy, excluding current attack target unless it's the only option
    const inRange = [...state.units.values()].filter(u =>
      u.team !== unit.team && u.state !== 'dead' && hexDistance(unit.hexPos, u.hexPos) <= 4
    )
    const preferred = inRange.filter(u => u.id !== unit.targetId)
    const pool = preferred.length > 0 ? preferred : inRange
    const leapTarget: Unit | null =
      pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : (unit.targetId ? state.units.get(unit.targetId) ?? null : null)

    if (!leapTarget || leapTarget.state === 'dead') return

    const candidates = getNeighbors(leapTarget.hexPos).filter(h => {
      if (!isValidHex(h)) return false
      const occupant = state.hexOccupancy.get(hexId(h))
      return !occupant || occupant === unit.id
    })
    const dest = candidates[0]
    if (!dest) return

    const tgtId     = leapTarget.id
    const casterId  = unit.id

    startLeap(unit, dest, state, LEAP_HASTE, (u, s) => {
      const tgt = s.units.get(tgtId)
      if (!tgt || tgt.state === 'dead') return

      u.targetId = tgtId

      // Force Gible to keep targeting the leap target for the stun duration
      // (taunt override in acquireTarget prevents tickTargeting from switching him away)
      addStatusEffect(u, {
        id: 'taunt',
        sourceUnitId: tgtId,
        durationTicks: Math.round(stunDuration * TICK_RATE),
        stackId: 'gible_target_lock',
      })

      applyDamage(u, tgt, {
        baseAmount: damageAmount,
        damageType: 'physical',
        canCrit: false,
        abilityId: 'gible_bite',
      }, s)

      if (tgt.state !== 'dead') {
        addStatusEffect(tgt, {
          id: 'stun',
          sourceUnitId: casterId,
          durationTicks: Math.round(stunDuration * TICK_RATE),
          stackId: `gible_stun_${tgtId}_${s.tick}`,
        })
      }
    })

    unit.targetId = leapTarget.id
    unit.state = 'leaping'
  },
}
