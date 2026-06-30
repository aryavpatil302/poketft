import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { startLeap } from '../systems/movement'
import { hexDistance } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'

// 5 cast + 30 outbound + 25 return ≈ 60 ticks = 1 second
const CAST_TICKS    = 5
const OUTBOUND_TICKS = 30
const RETURN_TICKS   = 25
const SQUASH_TICKS   = 15

export const WailordAbility: AbilityHandler = {
  abilityId: 'wailord_bounce',
  castTimeTicks: CAST_TICKS,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues = [75, 150, 300] as const
    const damageValues = [80,  120, 180] as const
    const stunSeconds  = [1,   1,   1.5] as const

    const shieldAmount = shieldValues[tier - 1]
    const damageAmount = damageValues[tier - 1]
    const stunDuration = stunSeconds[tier - 1]

    // Shield doesn't stack — replace existing Bounce shield
    const oldIdx = unit.shields.findIndex(s => s.sourceAbility === 'wailord_bounce')
    if (oldIdx >= 0) unit.shields.splice(oldIdx, 1)

    const shield: Shield = {
      id: `wailord_bounce_${unit.id}_${state.tick}`,
      sourceAbility: 'wailord_bounce',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: 3 * TICK_RATE,
    }
    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmount })

    // Resolve target
    const target = unit.targetId
      ? state.units.get(unit.targetId)
      : findNearestEnemies(unit, state, 1)[0]

    if (!target || target.state === 'dead') return

    unit.targetId = target.id

    // Remember home hex — Wailord returns here after stomping
    const returnHex = { ...unit.hexPos }
    const enemyHex  = { ...target.hexPos }

    // Outbound: sprite leaps to the enemy's hex — visual only, hexPos never moves
    const dist1  = Math.max(1, hexDistance(unit.hexPos, enemyHex))
    const haste1 = Math.max(0, (TICK_RATE * dist1) / (OUTBOUND_TICKS * unit.moveSpeed) - 1)

    startLeap(unit, enemyHex, state, haste1, (u: Unit, s: CombatState) => {
      // Apply damage and stun when sprite reaches enemy
      const tgt = s.units.get(target.id)
      if (tgt && tgt.state !== 'dead') {
        applyDamage(u, tgt, {
          baseAmount: damageAmount,
          damageType: 'magic',
          canCrit: false,
          scalingStat: 'special',
          scalingRatio: 0,
          abilityId: 'wailord_bounce',
        }, s)

        if (tgt.currentHp > 0) {
          addStatusEffect(tgt, {
            id: 'stun',
            sourceUnitId: u.id,
            durationTicks: Math.round(stunDuration * TICK_RATE),
            stackId: `wailord_stun_${tgt.id}`,
          })
        }
      }

      // Landing squash — drives spring-back animation in unitLayer
      addStatusEffect(u, {
        id: 'wailord_squash',
        sourceUnitId: u.id,
        durationTicks: SQUASH_TICKS,
        magnitude: SQUASH_TICKS,
        stackId: 'wailord_squash',
      })

      // Return: hexPos is still at returnHex (visualOnly kept it there), so
      // hexDistance would be 0. Target RETURN_TICKS directly via the haste formula.
      const haste2 = Math.max(0, TICK_RATE / (RETURN_TICKS * u.moveSpeed) - 1)
      startLeap(u, returnHex, s, haste2, () => {
        u.state = 'idle'
      }, undefined, true)
      u.state = 'leaping'
    }, undefined, true)

    unit.state = 'leaping'
  },
}
