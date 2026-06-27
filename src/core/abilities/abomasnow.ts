import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { createPersistentAoEZone, removePersistentAoEZone } from '../systems/persistentAoE'

const ZONE_ID_PREFIX = 'abomasnow_blizzard'

export const AbomasnowAbility: AbilityHandler = {
  abilityId: 'abomasnow_blizzard',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damagesPerSec = [60, 90, 150] as const
    const durations     = [4, 5, 6] as const

    const dmg      = damagesPerSec[tier - 1]
    const duration = durations[tier - 1]
    const zoneId   = `${ZONE_ID_PREFIX}_${unit.id}`

    // Recasting refreshes duration — remove existing zone first
    removePersistentAoEZone(state, zoneId)

    createPersistentAoEZone(state, {
      id: zoneId,
      center: unit.hexPos,
      radius: 2,
      sourceUnitId: unit.id,
      damagePerInterval: dmg,
      intervalTicks: TICK_RATE,
      damageType: 'magic',
      durationTicks: duration * TICK_RATE,
      lastFiredTick: state.tick,
      targetTeam: unit.team === 'player' ? 'enemy' : 'player',
      onExpire: (_st) => {},
    })
  },
}
