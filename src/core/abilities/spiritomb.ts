import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { createPersistentAoEZone } from '../systems/persistentAoE'
import { addMark } from '../systems/marks'
import { hexDistance } from '../hexGrid'

export const SpiritombAbility: AbilityHandler = {
  abilityId: 'spiritomb_destiny_bond',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damagesPerSec = [50, 75, 120] as const
    const dmg = damagesPerSec[tier - 1]

    createPersistentAoEZone(state, {
      id: `spiritomb_zone_${unit.id}`,
      center: unit.hexPos,
      radius: 1,
      sourceUnitId: unit.id,
      damagePerInterval: dmg,
      intervalTicks: TICK_RATE,
      damageType: 'magic',
      durationTicks: 6 * TICK_RATE,
      lastFiredTick: state.tick,
      targetTeam: unit.team === 'player' ? 'enemy' : 'player',
    })

    // Mark the most distant enemy — mirrors zone damage
    let distantEnemy: Unit | null = null
    let maxDist = -1
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      const d = hexDistance(unit.hexPos, other.hexPos)
      if (d > maxDist) { maxDist = d; distantEnemy = other }
    }

    if (distantEnemy) {
      const mirrorTarget = distantEnemy
      addMark(mirrorTarget, {
        id: 'spiritomb_mirror',
        sourceUnitId: unit.id,
        durationTicks: 6 * TICK_RATE,
      })

      addStatusEffect(mirrorTarget, {
        id: 'spiritomb_mirror_dmg',
        sourceUnitId: unit.id,
        durationTicks: 6 * TICK_RATE,
        tickInterval: TICK_RATE,
        tickEffect: (u, st) => {
          if (u.state === 'dead') return
          applyDamage(unit, u, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityId: 'spiritomb_destiny_bond' }, st)
        },
        stackId: `spiritomb_mirror_${mirrorTarget.id}`,
      })
    }
  },
}
