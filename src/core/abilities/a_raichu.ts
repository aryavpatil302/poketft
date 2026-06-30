import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { startLeap } from '../systems/movement'
import { createProjectile } from '../projectile'
import { hexDistance, hexId, hexesInRange, isValidHex } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'
import { computeStats } from '../unitFactory'

/** Find a hex exactly 2 steps away (fallback 1) that maximises distance from nearestEnemy,
 *  while staying within attack range of at least one enemy. */
function findSafetyDash(unit: Unit, state: CombatState, nearestEnemy: Unit, attackRange: number): { col: number; row: number } | null {
  const enemies = [...state.units.values()].filter(u => u.team !== unit.team && u.state !== 'dead')

  for (const targetDist of [2, 1]) {
    const candidates = hexesInRange(unit.hexPos, targetDist)
      .filter(h => isValidHex(h) && hexDistance(h, unit.hexPos) === targetDist)
      .filter(h => {
        const occ = state.hexOccupancy.get(hexId(h))
        return !occ || occ === unit.id
      })
      .filter(h => enemies.some(e => hexDistance(h, e.hexPos) <= attackRange))
    if (candidates.length === 0) continue
    // Primary: maximise distance from nearest enemy. Tie-break: prefer less movement.
    candidates.sort((a, b) =>
      hexDistance(b, nearestEnemy.hexPos) - hexDistance(a, nearestEnemy.hexPos)
    )
    return candidates[0]
  }
  return null
}

export const ARaichuAbility: AbilityHandler = {
  abilityId: 'a_raichu_surge_surfer',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [60, 80, 100] as const
    const damage = damageValues[tier - 1]

    // Dash direction: safety dash away from the geometrically nearest enemy (positional, not the attack target)
    const nearestEnemy = findNearestEnemies(unit, state, 1)[0]
    if (!nearestEnemy) return

    const attackRange = (unit._computedStats ?? computeStats(unit)).range
    const dest = findSafetyDash(unit, state, nearestEnemy, attackRange)
    if (!dest) return

    const sourceId = unit.id
    const spellBuff = getSpellBuff(unit, state)
    const projCount = 2 + spellBuff
    const primaryTargetId = unit.targetId  // capture before leap; attack target gets first bolt

    startLeap(unit, dest, state, 5.0, undefined, (u, s) => {
      // Bolts: lead with the current attack target, fill remaining slots with nearest enemies
      const allNear = findNearestEnemies(u, s, projCount + 1)
      const primary = primaryTargetId ? s.units.get(primaryTargetId) : undefined
      const targets: Unit[] = []
      if (primary && primary.state !== 'dead') targets.push(primary)
      for (const t of allNear) {
        if (targets.length >= projCount) break
        if (t.id !== primary?.id) targets.push(t)
      }
      for (const tgt of targets) {
        const proj = createProjectile({
          sourceId,
          targetId: tgt.id,
          startPos: { ...u.visualPos },
          speed: 14,
          damagePayload: {
            baseAmount: damage,
            damageType: 'magic',
            canCrit: false,
          },
          abilityId: 'a_raichu_surge_surfer',
        })
        s.projectiles.set(proj.id, proj)
      }
    })

    unit.state = 'leaping'
    incrementSpellBuff(unit, state)
  },
}
