import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { addStatusEffect } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'

export const VikavoltAbility: AbilityHandler = {
  abilityId: 'vikavolt_discharge',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [400, 500, 675] as const
    const stunSeconds  = [1.5, 2.0, 3.0] as const

    const damage    = damageValues[tier - 1]
    const stunTicks = Math.round(stunSeconds[tier - 1] * 60)

    // Find the most populated enemy row; ties broken by lowest total HP in that row
    const rowCounts = new Map<number, number>()
    const rowHp     = new Map<number, number>()
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      const row = other.hexPos.row
      rowCounts.set(row, (rowCounts.get(row) ?? 0) + 1)
      rowHp.set(row, (rowHp.get(row) ?? 0) + other.currentHp)
    }

    let targetRow = -1
    let maxCount  = 0
    let minHp     = Infinity
    for (const [row, count] of rowCounts) {
      const hp = rowHp.get(row) ?? 0
      if (count > maxCount || (count === maxCount && hp < minHp)) {
        maxCount  = count
        minHp     = hp
        targetRow = row
      }
    }
    if (targetRow === -1) return

    // Visual: flash the targeted row
    state.events.push({ type: 'vfx', effectId: 'discharge_row', sourceId: unit.id, targetRow })

    // Apply damage + stun to all enemies in that row
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (other.hexPos.row !== targetRow) continue

      // 33% extra damage to shields — add bonus damage equal to 33% of the target's total shield value
      const totalShieldHp = other.shields.reduce((sum, s) => sum + s.value, 0)
      const shieldBonus   = Math.round(totalShieldHp * 0.33)

      applyDamage(unit, other, {
        baseAmount: damage + shieldBonus,
        damageType: 'magic',
        canCrit:    false,
        abilityId:  'vikavolt_discharge',
      }, state)

      if (other.currentHp <= 0) continue

      addStatusEffect(other, {
        id:           'stun',
        sourceUnitId: unit.id,
        durationTicks: stunTicks,
        stackId:      `vikavolt_stun_${other.id}`,
      })
    }
  },
}
