import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'

export const MamoswineAbility: AbilityHandler = {
  abilityId: 'mamoswine_thick_fat',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const buffValues = [40, 60, 100] as const
    const magnitude  = buffValues[tier - 1]

    // Armor buff for 5 seconds
    addStatusEffect(unit, {
      id: 'armorBuff',
      sourceUnitId: unit.id,
      durationTicks: 5 * TICK_RATE,
      magnitude,
      stackId: 'mamo_armor',
    })

    // Sp. Defense buff for 5 seconds
    addStatusEffect(unit, {
      id: 'spDefBuff',
      sourceUnitId: unit.id,
      durationTicks: 5 * TICK_RATE,
      magnitude,
      stackId: 'mamo_spdef',
    })

    const handlerId = `mamo_rider_${unit.id}_${state.tick}`

    // Passive attack handler: add Defense + Sp. Defense as bonus magic damage while buffed
    const handler = {
      id: handlerId,
      onAttack(src: Unit, tgt: Unit, st: CombatState): void {
        // Self-remove if the armor buff has expired
        if (!src.statusEffects.some(fx => fx.id === 'armorBuff' && fx.stackId === 'mamo_armor')) {
          src.passiveAttackHandlers = src.passiveAttackHandlers.filter(h => h.id !== handlerId)
          return
        }

        const stats = src._computedStats
        if (!stats) return

        const bonus = stats.defense + stats.spDefense
        if (bonus <= 0) return

        applyDamage(src, tgt, {
          baseAmount: bonus,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'mamoswine_thick_fat',
        }, st)
      },
    }

    unit.passiveAttackHandlers.push(handler)
  },
}
