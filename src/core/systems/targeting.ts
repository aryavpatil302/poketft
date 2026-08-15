import type { Unit, CombatState, Team } from '../types'
import type { OffsetCoord } from '../hexGrid'
import { hexDistance, hexesInRange, hexId, hexLinePath, findPath } from '../hexGrid'
import { computeStats } from '../unitFactory'
import { softPassableCosts } from './movement'
import { combatRng } from '../rng'

// Can `unit` actually path to within attack range of `target`? Uses the same
// soft-cost model as real movement (allies are squeeze-through-able), so a
// target only reachable through allies still counts as reachable.
function canReach(unit: Unit, target: Unit, state: CombatState): boolean {
  const range = (unit._computedStats ?? computeStats(unit)).range
  if (hexDistance(unit.hexPos, target.hexPos) <= range) return true
  return findPath(unit.hexPos, target.hexPos, state.hexOccupancy, unit.id, range,
    softPassableCosts(state, unit)).reachable
}

// Returns the best target for a unit to attack.
// Prefers enemies already in attack range; randomises ties so adjacent units
// don't always deterministically focus the lowest-ID target.
export function acquireTarget(unit: Unit, state: CombatState): string | null {
  // Taunt override
  const tauntFx = unit.statusEffects.find(fx => fx.id === 'taunt')
  if (tauntFx) {
    const taunter = state.units.get(tauntFx.sourceUnitId)
    if (taunter && taunter.state !== 'dead') return tauntFx.sourceUnitId
  }

  const range = (unit._computedStats ?? computeStats(unit)).range
  const enemies: Unit[] = []
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead' || other.definitionId === 'ruiner_stone') continue
    enemies.push(other)
  }
  if (enemies.length === 0) return null

  // Prefer enemies already in attack range; fall back to all enemies
  const inRange = enemies.filter(e => hexDistance(unit.hexPos, e.hexPos) <= range)
  let pool = inRange.length > 0 ? inRange : enemies

  // Out of range: if the geometrically-nearest enemy is walled off (unreachable),
  // bias toward enemies we can actually path to, so the unit engages a reachable
  // one instead of parking forever staring at an enemy it can never touch.
  if (inRange.length === 0 && enemies.length > 1) {
    const nearest = enemies.reduce((a, b) =>
      hexDistance(unit.hexPos, a.hexPos) <= hexDistance(unit.hexPos, b.hexPos) ? a : b)
    if (!canReach(unit, nearest, state)) {
      const reachable = enemies.filter(e => canReach(unit, e, state))
      if (reachable.length > 0) pool = reachable
    }
  }

  // Find the minimum distance within the pool
  let minDist = Infinity
  for (const e of pool) {
    const d = hexDistance(unit.hexPos, e.hexPos)
    if (d < minDist) minDist = d
  }
  const closest = pool.filter(e => hexDistance(unit.hexPos, e.hexPos) === minDist)

  const isCliff = (u: Unit) => u.definitionId === 'cliff_l' || u.definitionId === 'cliff_r'
  const cliffPool = closest.filter(isCliff)
  const tiePool   = cliffPool.length > 0 ? cliffPool : closest

  // Keep the current target if it's still in the preferred pool (prevents flickering while moving)
  if (unit.targetId && tiePool.some(e => e.id === unit.targetId)) {
    return unit.targetId
  }

  // Pick randomly among equidistant candidates, cliffs preferred
  return tiePool[Math.floor(combatRng() * tiePool.length)].id
}

// Called once per tick.
// While moving/idle: re-evaluate nearest enemy each tick so the unit naturally
// routes toward whoever it will encounter first.
// Once attacking or casting: lock onto the current target so it doesn't snap
// away just because another unit walked adjacent.
export function tickTargeting(unit: Unit, state: CombatState): void {
  if (unit.state === 'dead') return

  // Taunt always overrides regardless of attack state
  const tauntFx = unit.statusEffects.find(fx => fx.id === 'taunt')
  if (tauntFx) {
    const taunter = state.units.get(tauntFx.sourceUnitId)
    if (taunter && taunter.state !== 'dead') {
      unit.targetId = tauntFx.sourceUnitId
      return
    }
  }

  // Locked-in while attacking, casting, or briefly after a cast (manaLockTimer > 0).
  // During moving/idle with no prior engagement, re-evaluate freely so units
  // naturally route toward whoever they'll encounter first.
  const hasTarget = unit.targetId !== null
  if (hasTarget) {
    const current = state.units.get(unit.targetId!)
    if (current && current.state !== 'dead') {
      const isEngaged = unit.state === 'attacking'
                     || unit.state === 'casting'
                     || unit.manaLockTimer > 0
      if (isEngaged) return  // committed — don't switch
    }
  }

  // No live target, or freely moving pre-engagement — pick nearest living enemy
  unit.targetId = acquireTarget(unit, state)
}

// ─── Targeting helpers ────────────────────────────────────────────────────────

export function findNearestEnemies(unit: Unit, state: CombatState, count: number): Unit[] {
  return [...state.units.values()]
    .filter(u => u.team !== unit.team && u.state !== 'dead')
    .sort((a, b) => hexDistance(unit.hexPos, a.hexPos) - hexDistance(unit.hexPos, b.hexPos))
    .slice(0, count)
}

export function findFurthestEnemyInRange(unit: Unit, state: CombatState, maxRange: number): Unit | null {
  let best: Unit | null = null
  let bestDist = -1
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d <= maxRange && d > bestDist) { bestDist = d; best = other }
  }
  return best
}

export function findLowestHealthEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestHp = Infinity
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    if (other.currentHp < bestHp) { bestHp = other.currentHp; best = other }
  }
  return best
}

export function findLowestHealthAlly(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestHp = Infinity
  for (const other of state.units.values()) {
    if (other.id === unit.id || other.team !== unit.team || other.state === 'dead') continue
    if (other.currentHp < bestHp) { bestHp = other.currentHp; best = other }
  }
  return best
}

export function findNearestAlly(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.id === unit.id || other.team !== unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

export function findUnitsInRadius(
  center: OffsetCoord,
  state: CombatState,
  radius: number,
  team: Team | 'both',
): Unit[] {
  const result: Unit[] = []
  for (const hex of hexesInRange(center, radius)) {
    const uid = state.hexOccupancy.get(hexId(hex))
    if (!uid) continue
    const u = state.units.get(uid)
    if (!u || u.state === 'dead') continue
    if (team !== 'both' && u.team !== team) continue
    result.push(u)
  }
  return result
}

export function findLargestEnemyCluster(
  unit: Unit,
  state: CombatState,
  radius: number,
): { center: OffsetCoord; units: Unit[] } {
  const enemies = [...state.units.values()].filter(u => u.team !== unit.team && u.state !== 'dead')
  let bestCenter: OffsetCoord = unit.hexPos
  let bestUnits: Unit[] = []

  for (const enemy of enemies) {
    const inRange = enemies.filter(e => hexDistance(enemy.hexPos, e.hexPos) <= radius)
    if (inRange.length > bestUnits.length) {
      bestUnits = inRange
      bestCenter = enemy.hexPos
    }
  }
  return { center: bestCenter, units: bestUnits }
}

export function findHighestDamageDealerEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDmg = -1
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    if (other.damageDealtThisCombat > bestDmg) { bestDmg = other.damageDealtThisCombat; best = other }
  }
  return best
}

export function findEnemiesInLine(
  from: OffsetCoord,
  to: OffsetCoord,
  state: CombatState,
  team: Team,
): Unit[] {
  const line = hexLinePath(from, to)
  const result: Unit[] = []
  for (const hex of line) {
    const uid = state.hexOccupancy.get(hexId(hex))
    if (!uid) continue
    const u = state.units.get(uid)
    if (u && u.team === team && u.state !== 'dead') result.push(u)
  }
  return result
}

export function findNearestUnmarkedEnemies(
  unit: Unit,
  state: CombatState,
  count: number,
  markId: string,
): Unit[] {
  return [...state.units.values()]
    .filter(u => u.team !== unit.team && u.state !== 'dead' && !u.marks.some(m => m.id === markId))
    .sort((a, b) => hexDistance(unit.hexPos, a.hexPos) - hexDistance(unit.hexPos, b.hexPos))
    .slice(0, count)
}
