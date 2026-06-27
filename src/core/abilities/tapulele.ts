import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId } from '../hexGrid'
import { isTerrainActive, setTerrain } from '../systems/terrain'

export const TapuLeleAbility: AbilityHandler = {
  abilityId: 'tapulele_natures_madness',
  castTimeTicks: 120,  // 2-second charge-up

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages = [500, 750, 1200] as const
    const damage  = damages[tier - 1]

    const psychicTerrain = isTerrainActive(state, 'psychic')

    for (const hex of hexesInRange(unit.hexPos, 4)) {
      const uid = state.hexOccupancy.get(hexId(hex))
      if (!uid) continue
      const target = state.units.get(uid)
      if (!target || target.team === unit.team || target.state === 'dead') continue

      const payload = {
        baseAmount: damage,
        damageType: 'magic' as const,
        canCrit: false,
        abilityId: 'tapulele_natures_madness' as const,
      }

      if (psychicTerrain) {
        // Ignore MR: apply as true damage
        applyDamage(unit, target, { ...payload, damageType: 'true' }, state)
      } else {
        applyDamage(unit, target, payload, state)
      }
    }

    setTerrain(state, 'psychic', true)
  },
}
