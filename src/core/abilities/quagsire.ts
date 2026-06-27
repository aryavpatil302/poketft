import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId, hexDistance } from '../hexGrid'

export const QuagsireAbility: AbilityHandler = {
  abilityId: 'quagsire_unaware',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldsPerEnemy = [100, 150, 250] as const
    const aoeDamages      = [150, 225, 375] as const

    const shieldPer = shieldsPerEnemy[tier - 1]
    const aoeDmg    = aoeDamages[tier - 1]

    // Count enemies within 2 hexes
    let enemyCount = 0
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (hexDistance(unit.hexPos, other.hexPos) <= 2) enemyCount++
    }
    const totalShield = shieldPer * Math.max(1, enemyCount)

    // Taunt enemies within 1 hex
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (hexDistance(unit.hexPos, other.hexPos) <= 1) {
        addStatusEffect(other, {
          id: 'taunt',
          sourceUnitId: unit.id,
          durationTicks: 2 * TICK_RATE,
          stackId: `quagsire_taunt_${other.id}`,
        })
      }
    }

    // Apply shield; on expiry deal AoE
    const shield: Shield = {
      id: `quagsire_shield_${unit.id}_${state.tick}`,
      sourceAbility: 'quagsire_unaware',
      value: totalShield,
      maxValue: totalShield,
      durationTicks: 4 * TICK_RATE,
      onExpire: (u: Unit) => {
        // AoE damage + chill to all nearby enemies
        for (const hex of hexesInRange(u.hexPos, 2)) {
          const uid = state.hexOccupancy.get(hexId(hex))
          if (!uid) continue
          const target = state.units.get(uid)
          if (!target || target.team === u.team || target.state === 'dead') continue
          applyDamage(u, target, { baseAmount: aoeDmg, damageType: 'magic', canCrit: false, abilityId: 'quagsire_unaware' }, state)
          if (target.state !== 'dead') {
            addStatusEffect(target, {
              id: 'chill',
              sourceUnitId: u.id,
              durationTicks: 2 * TICK_RATE,
              magnitude: 0.20,
              stackId: `quagsire_chill_${target.id}`,
            })
          }
        }
      },
    }

    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: totalShield })
  },
}
