import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexDistance } from '../hexGrid'
import { findNearestEnemies, findEnemiesInLine } from '../systems/targeting'

export const FroslassAbility: AbilityHandler = {
  abilityId: 'froslass_icy_wind',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [200, 300, 500] as const
    const baseDamage   = damageValues[tier - 1]

    // Find the furthest enemy to define the line direction
    let furthestEnemy: Unit | null = null
    let furthestDist = -1
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      const d = hexDistance(unit.hexPos, other.hexPos)
      if (d > furthestDist) { furthestDist = d; furthestEnemy = other }
    }

    if (!furthestEnemy) return

    // Find all enemies in the line from Froslass to the furthest enemy
    const enemyTeam = unit.team === 'player' ? 'enemy' : 'player'
    const hitUnits = findEnemiesInLine(unit.hexPos, furthestEnemy.hexPos, state, enemyTeam)

    // Sort by distance from Froslass (ascending)
    hitUnits.sort((a, b) => hexDistance(unit.hexPos, a.hexPos) - hexDistance(unit.hexPos, b.hexPos))

    // Apply damage with falloff: first enemy full, each subsequent * 0.75^i
    for (let i = 0; i < hitUnits.length; i++) {
      const target = hitUnits[i]
      const amount = Math.round(baseDamage * Math.pow(0.75, i))

      applyDamage(unit, target, {
        baseAmount: amount,
        damageType: 'magic',
        canCrit: false,
        abilityId: 'froslass_icy_wind',
      }, state)

      // Apply chill to all hit enemies
      addStatusEffect(target, {
        id: 'chill',
        sourceUnitId: unit.id,
        durationTicks: 2 * TICK_RATE,
        magnitude: 0.25,
        stackId: `froslass_chill_${target.id}`,
      })
    }
  },
}
