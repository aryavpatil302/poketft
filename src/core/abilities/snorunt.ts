import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexDistance } from '../hexGrid'

export const SnorunAbility: AbilityHandler = {
  abilityId: 'snorunt_ice_body',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues = [120, 180, 280] as const
    const damageValues = [80,  120, 200] as const

    const shieldAmount = shieldValues[tier - 1]
    const aoeDamage    = damageValues[tier - 1]
    const casterId     = unit.id
    const casterTeam   = unit.team

    // Capture state in closure so onExpire can use it
    const capturedState = state

    const shieldId = `snorunt_ice_body_${unit.id}_${state.tick}`
    const shield: Shield = {
      id: shieldId,
      sourceAbility: 'snorunt_ice_body',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: 6 * TICK_RATE,
      onExpire: (u: Unit) => {
        // AoE magic damage + chill to all enemies within 2 hexes of caster position at expiry
        for (const other of capturedState.units.values()) {
          if (other.team === casterTeam || other.state === 'dead') continue
          if (hexDistance(u.hexPos, other.hexPos) > 2) continue

          applyDamage(
            capturedState.units.get(casterId) ?? u,
            other,
            { baseAmount: aoeDamage, damageType: 'magic', canCrit: false, abilityId: 'snorunt_ice_body' },
            capturedState,
          )

          if (other.state === 'dead') continue
          addStatusEffect(other, {
            id: 'chill',
            sourceUnitId: casterId,
            durationTicks: Math.round(1.5 * TICK_RATE),
            magnitude: 0.25,
            stackId: `snorunt_chill_${other.id}_${capturedState.tick}`,
          })
        }
      },
    }

    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmount })
  },
}
