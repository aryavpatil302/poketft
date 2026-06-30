import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { hexesInRange, hexId } from '../hexGrid'
import { computeStats } from '../unitFactory'

const SCALING_PCTS = [0.50, 0.90, 1.20] as const

export const BelliboltAbility: AbilityHandler = {
  abilityId: 'bellibolt_electrophoresis',
  castTimeTicks: 25,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    // Read charge count and compute damage while charges still boost def/spdef
    const chargeFx = unit.statusEffects.find(fx => fx.stackId === 'bellibolt_charge')
    const charges = chargeFx?.magnitude ?? 0
    const stats = computeStats(unit)
    const dmg = Math.round((stats.defense + stats.spDefense) * SCALING_PCTS[tier - 1])

    // Discharge — remove all charges
    if (chargeFx) {
      unit.statusEffects = unit.statusEffects.filter(fx => fx.stackId !== 'bellibolt_charge')
      unit._computedStats = null
    }

    // AoE in 1-hex radius (only fires if charges were stacked)
    if (charges > 0 && dmg > 0) {
      for (const hex of hexesInRange(unit.hexPos, 1)) {
        const targetId = state.hexOccupancy.get(hexId(hex))
        if (!targetId) continue
        const target = state.units.get(targetId)
        if (!target || target.team === unit.team || target.state === 'dead') continue
        applyDamage(unit, target, {
          baseAmount: dmg,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'bellibolt_electrophoresis',
        }, state)
      }
    }

    // Discharge VFX — plays on Bellibolt
    state.events.push({
      type: 'vfx',
      effectId: 'bellibolt_discharge',
      unitId: unit.id,
      x: unit.visualPos.x,
      y: unit.visualPos.y,
    })
  },
}
