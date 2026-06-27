import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'

export const SableyeAbility: AbilityHandler = {
  abilityId: 'sableye_power_gem',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageMagicValues = [150, 225, 350] as const
    const shieldValues      = [200, 300, 500] as const

    const magicDamage = damageMagicValues[tier - 1]
    const shieldAmt   = shieldValues[tier - 1]

    // Track cast parity with a permanent status effect on self
    const parityEffect = unit.statusEffects.find(fx => fx.stackId === 'sableye_parity')

    if (!parityEffect) {
      // First cast: add the parity tracker (stackId='odd' means next will be even, etc.)
      // We use magnitude=1 for odd cast, magnitude=0 for even cast
      // First cast is cast #1 (odd), so perform odd cast logic and store magnitude=0 (next=even)
      addStatusEffect(unit, {
        id: 'sableye_parity',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: 0,          // 0 = next cast is even
        stackId: 'sableye_parity',
      })

      // Odd cast: magic damage + charm on current attack target, fallback nearest enemy
      const atkTgt1 = unit.targetId ? state.units.get(unit.targetId) : undefined
      const target = (atkTgt1 && atkTgt1.state !== 'dead' && atkTgt1.team !== unit.team)
        ? atkTgt1
        : findNearestEnemies(unit, state, 1)[0]
      if (target) {
        applyDamage(unit, target, {
          baseAmount: magicDamage,
          damageType: 'magic',
          canCrit: true,
          abilityId: 'sableye_power_gem',
        }, state)

        addStatusEffect(target, {
          id: 'charm',
          sourceUnitId: unit.id,
          durationTicks: 3 * TICK_RATE,
          magnitude: 0.20,
          stackId: `sableye_charm_${target.id}`,
        })
      }
      return
    }

    // Subsequent casts: check current parity
    const isEvenCast = parityEffect.magnitude === 0

    if (isEvenCast) {
      // Even cast: atk speed buff + shield
      addStatusEffect(unit, {
        id: 'atkSpd_buff',
        sourceUnitId: unit.id,
        durationTicks: 3 * TICK_RATE,
        magnitude: 0.40,
        stackId: 'sableye_speed',
      })

      const shield: Shield = {
        id: `sableye_power_gem_shield_${unit.id}_${state.tick}`,
        sourceAbility: 'sableye_power_gem',
        value: shieldAmt,
        maxValue: shieldAmt,
        durationTicks: 3 * TICK_RATE,
      }
      unit.shields.push(shield)
      state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmt })

      // Toggle to odd
      parityEffect.magnitude = 1
    } else {
      // Odd cast: magic damage + charm on current attack target, fallback nearest enemy
      const atkTgt2 = unit.targetId ? state.units.get(unit.targetId) : undefined
      const target = (atkTgt2 && atkTgt2.state !== 'dead' && atkTgt2.team !== unit.team)
        ? atkTgt2
        : findNearestEnemies(unit, state, 1)[0]
      if (target) {
        applyDamage(unit, target, {
          baseAmount: magicDamage,
          damageType: 'magic',
          canCrit: true,
          abilityId: 'sableye_power_gem',
        }, state)

        addStatusEffect(target, {
          id: 'charm',
          sourceUnitId: unit.id,
          durationTicks: 3 * TICK_RATE,
          magnitude: 0.20,
          stackId: `sableye_charm_${target.id}`,
        })
      }

      // Toggle to even
      parityEffect.magnitude = 0
    }
  },
}
