import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { hexesInRange, hexId } from '../hexGrid'

export const AbsolAbility: AbilityHandler = {
  abilityId: 'absol_night_slash',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [200, 300, 500] as const
    const healValues   = [60,  90,  150] as const

    const damage = damageValues[tier - 1]
    const heal   = healValues[tier - 1]

    // Hit all enemies within 1 hex of Absol's current position
    const hitHexes = hexesInRange(unit.hexPos, 1)
    const hit = new Set<string>()

    for (const hex of hitHexes) {
      const occupantId = state.hexOccupancy.get(hexId(hex))
      if (!occupantId) continue
      const target = state.units.get(occupantId)
      if (!target || target.state === 'dead' || target.team === unit.team) continue
      if (hit.has(target.id)) continue
      hit.add(target.id)

      applyDamage(unit, target, {
        baseAmount: damage,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'absol_night_slash',
      }, state)

      applyHeal(unit, heal, unit.id, state)
    }
  },
}
