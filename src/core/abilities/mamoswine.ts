import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'
import { applyHeal } from '../systems/heal'
import { computeStats } from '../unitFactory'

const BUFF_DURATION = 5 * TICK_RATE  // 300 ticks

export const MamoswineAbility: AbilityHandler = {
  abilityId: 'mamoswine_thick_fat',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const armorMrValues = [50, 75, 200] as const
    const healPcts      = [0.30, 0.45, 1.00] as const

    const armorMr  = armorMrValues[tier - 1]
    const healPct  = healPcts[tier - 1]
    const spMult   = (unit._computedStats ?? computeStats(unit)).special / 100
    const casterId = unit.id

    // Snapshot damage taken so far; delta on expire = damage during buff window
    const damageTakenAtCast = unit.damageTakenThisCombat

    // Clear any existing thick_fat buff and empowered auto modifier (recast)
    unit.statusEffects   = unit.statusEffects.filter(fx => fx.stackId !== 'thick_fat')
    unit.attackModifiers = unit.attackModifiers.filter(m => m.id !== 'mamoswine_thick_fat_auto')

    // Empowered autos: 100 flat bonus magic damage for the buff duration
    unit.attackModifiers.push({
      id: 'mamoswine_thick_fat_auto',
      bonusDamage: 100,
      bonusDamageType: 'magic',
      remainingCharges: 9999,
    })

    addStatusEffect(unit, {
      id: 'thick_fat',
      sourceUnitId: casterId,
      durationTicks: BUFF_DURATION,
      magnitude: armorMr,
      stackId: 'thick_fat',
      suppressManaGain: true,
      onExpire: (u: Unit, st: CombatState) => {
        u.attackModifiers = u.attackModifiers.filter(m => m.id !== 'mamoswine_thick_fat_auto')
        st.events.push({ type: 'vfx', effectId: 'mamoswine_thick_fat_end', unitId: casterId })
        const damageTaken = u.damageTakenThisCombat - damageTakenAtCast
        if (damageTaken <= 0) return
        const healAmount = Math.round(damageTaken * healPct * spMult)
        applyHeal(u, healAmount, casterId, st)
      },
    })

    // VFX: ground-layer animation behind Mamoswine for the buff duration
    state.events.push({ type: 'vfx', effectId: 'mamoswine_thick_fat_start', unitId: casterId })
  },
}
