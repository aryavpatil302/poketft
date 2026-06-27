import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { hexDistance } from '../hexGrid'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'

// Find the ally with the lowest current HP (excluding self); returns null if none
function findLowestHealthAlly(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestHp = Infinity

  for (const other of state.units.values()) {
    if (other.id === unit.id) continue
    if (other.team !== unit.team) continue
    if (other.state === 'dead') continue
    if (other.currentHp < bestHp) {
      bestHp = other.currentHp
      best = other
    }
  }
  return best
}

// Find the nearest living enemy to this unit
function findNearestEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity

  for (const other of state.units.values()) {
    if (other.team === unit.team) continue
    if (other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) {
      bestDist = d
      best = other
    }
  }
  return best
}

export const RibombeeAbility: AbilityHandler = {
  abilityId: 'ribombee_pollen_puff',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const healValues   = [100, 175, 300] as const
    const damageValues = [100, 175, 300] as const
    const heal   = healValues[tier - 1]
    const damage = damageValues[tier - 1]

    // ── Healing puff → lowest health ally ─────────────────────────────────
    const allyTarget = findLowestHealthAlly(unit, state)
    if (allyTarget) {
      const healProj = createProjectile({
        sourceId: unit.id,
        targetId: allyTarget.id,
        startPos: { ...unit.visualPos },
        speed: 13,
        healPayload: { amount: heal },
        abilityId: 'ribombee_pollen_puff',
      })
      state.projectiles.set(healProj.id, healProj)
    }

    // ── Damage puff → current attack target, fallback nearest enemy ────────
    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const enemyTarget = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemy(unit, state)
    if (enemyTarget) {
      const dmgProj = createProjectile({
        sourceId: unit.id,
        targetId: enemyTarget.id,
        startPos: { ...unit.visualPos },
        speed: 13,
        damagePayload: {
          baseAmount: damage,
          damageType: 'magic',
          canCrit: false,
          scalingStat: 'special',
          scalingRatio: 0,
        },
        onHit: (_source, target, _state) => {
          // Reduce attack speed by 30% for 1 second (60 ticks)
          addStatusEffect(target, {
            id: 'chill',
            sourceUnitId: unit.id,
            durationTicks: 60,
            magnitude: 0.30,
            stackId: 'ribombee_pollen_slow',
          })
        },
        abilityId: 'ribombee_pollen_puff',
      })
      state.projectiles.set(dmgProj.id, dmgProj)
    }
  },
}
