import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId, hexDistance } from '../hexGrid'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

export const QuagsireAbility: AbilityHandler = {
  abilityId: 'quagsire_unaware',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldsPerEnemy = [100,  150,  400] as const
    const aoeDamages      = [200,   350,   600] as const

    const shieldPer = shieldsPerEnemy[tier - 1]
    const aoeDmg    = aoeDamages[tier - 1]
    const spMult    = (unit._computedStats ?? computeStats(unit)).special / 100

    // Count enemies within 2 hexes
    let enemyCount = 0
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (hexDistance(unit.hexPos, other.hexPos) <= 2) enemyCount++
    }
    const totalShield = Math.round(shieldPer * spMult * Math.max(1, enemyCount))

    // Taunt enemies within 1 hex for 4 seconds
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (hexDistance(unit.hexPos, other.hexPos) <= 1) {
        addStatusEffect(other, {
          id: 'taunt',
          sourceUnitId: unit.id,
          durationTicks: 4 * TICK_RATE,
          stackId: `quagsire_taunt_${other.id}`,
        })
      }
    }

    // Apply shield; on expiry/break: AoE + chill + pop VFX
    const shield: Shield = {
      id: `quagsire_shield_${unit.id}_${state.tick}`,
      sourceAbility: 'quagsire_unaware',
      value: totalShield,
      maxValue: totalShield,
      durationTicks: 4 * TICK_RATE,
      effectiveMaxHp: unit.currentHp + totalShield,
      onExpire: (u: Unit) => {
        // AoE special damage + 30% chill in 1-hex radius
        for (const hex of hexesInRange(u.hexPos, 1)) {
          const uid = state.hexOccupancy.get(hexId(hex))
          if (!uid) continue
          const target = state.units.get(uid)
          if (!target || target.team === u.team || target.state === 'dead') continue
          applyDamage(u, target, { baseAmount: aoeDmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'quagsire_unaware' }, state)
          if (target.currentHp > 0) {
            addStatusEffect(target, {
              id: 'chill',
              sourceUnitId: u.id,
              durationTicks: 3 * TICK_RATE,
              magnitude: 0.30,
              stackId: `quagsire_chill_${target.id}`,
            })
          }
        }
        // Pop bubble VFX
        state.events.push({
          type: 'vfx',
          effectId: 'quagsire_shield_pop',
          x: u.visualPos.x,
          y: u.visualPos.y,
        })
      },
    }

    addShield(unit, shield, state)
  },
}
