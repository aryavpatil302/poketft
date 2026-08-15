import { makeUnit } from '../core/unitFactory'
import type { Unit, UnitDefinition } from '../core/types'
import { BOARD_COLS, hexesInRange } from '../core/hexGrid'
import { ALL_UNITS, UNIT_MAP } from '../data/units'
import { calcBoardProfile, unitPowerScore, getThresholds, calibratedPower, PRIOR_WEIGHTS, type PowerWeights } from './boardPower'
import type { CalibParams } from './calibration'

const ENEMY_POOL: UnitDefinition[] = ALL_UNITS.filter(u => !u.isDummy && u.cost > 0)
const TANK_POOL  = ENEMY_POOL.filter(u => u.role === 'tank')
const CARRY_POOL = ENEMY_POOL.filter(u => u.role !== 'tank')

// Compact cluster of columns centered on the board midpoint (for tanks forming a wall)
function clusterColumns(n: number): number[] {
  if (n === 0) return []
  const center = (BOARD_COLS - 1) / 2
  return Array.from({ length: n }, (_, i) =>
    Math.max(0, Math.min(BOARD_COLS - 1, Math.round(center - (n - 1) / 2 + i)))
  )
}

// Columns spread evenly across the full board width (for carries)
function spreadColumns(n: number): number[] {
  if (n === 0) return []
  if (n === 1) return [Math.floor(BOARD_COLS / 2)]
  return Array.from({ length: n }, (_, i) =>
    Math.round(i * (BOARD_COLS - 1) / (n - 1))
  )
}

// Columns radiating outward from a center column (for fallback search)
function colsFromCenter(center: number): number[] {
  const cols = [center]
  for (let d = 1; d < BOARD_COLS; d++) {
    if (center - d >= 0) cols.push(center - d)
    if (center + d < BOARD_COLS) cols.push(center + d)
  }
  return cols
}

// Tier that best matches the power budget for this unit.
// All units carry a universal 30%-of-range penalty on tier 3, so they prefer
// tier 1/2 and the remaining budget flows to higher-cost units at tier 1.
// Cost-3 units get an additional 20% penalty on top (50% total), because they
// are the most likely to be over-starred on high-power-2-star player boards.
function bestTier(def: UnitDefinition, budget: number): 1|2|3 {
  const range = unitPowerScore(def.cost, 3) - unitPowerScore(def.cost, 1)
  const scores: Array<[1|2|3, number]> = [
    [1, Math.abs(unitPowerScore(def.cost, 1) - budget)],
    [2, Math.abs(unitPowerScore(def.cost, 2) - budget)],
    [3, Math.abs(unitPowerScore(def.cost, 3) - budget) + range * 0.30],
  ]
  if (def.cost === 3) scores[2][1] += range * 0.20  // extra 20% for cost-3 (50% total)
  scores.sort((a, b) => a[1] - b[1])
  return scores[0][0]
}

// Reward units that push traits toward or across their next breakpoint.
// Completing a threshold (gap=1) scores highest; getting closer also scores.
function traitSynergyScore(def: UnitDefinition, traitCounts: Map<string, number>): number {
  let score = 0
  for (const t of def.types) {
    const current = traitCounts.get(t) ?? 0
    const thresholds = getThresholds(t)
    const nextThreshold = thresholds.find(thr => current < thr)
    if (nextThreshold === undefined) {
      // Already at max threshold — tiny bonus just for depth
      if (current > 0) score += 0.5
    } else {
      const gap = nextThreshold - current
      if (gap === 1)      score += 8   // completes the breakpoint
      else if (gap === 2) score += 3   // one slot away
      else if (gap === 3) score += 1.5 // two slots away
      else if (current > 0) score += 0.5 // already started but far from next
    }
  }
  return score
}

interface EnemySlot { def: UnitDefinition; tier: 1|2|3 }

// Post-process: measure the actual board power (including trait bonuses) and
// iteratively adjust unit tiers until the real delta is within ±10% of the
// target. Tier-3 and stacked cost-3 units count heavier via the weight vector
// (learned by the calibration layer; priors reproduce the legacy 0.30 / count²).
function clampToTarget(slots: EnemySlot[], targetPower: number, w: PowerWeights = PRIOR_WEIGHTS): EnemySlot[] {
  const result = slots.map(s => ({ ...s }))

  for (let iter = 0; iter < 10; iter++) {
    // Build throw-away units so calcBoardProfile can measure trait bonuses
    const tmp = result.map(s => {
      const u = makeUnit(s.def.id, 'enemy', s.tier)
      return u
    })
    const ratio = targetPower > 0
      ? (calibratedPower(calcBoardProfile(tmp), w) - targetPower) / targetPower
      : 0

    if (Math.abs(ratio) <= 0.10) break

    if (ratio > 0.10) {
      // Enemy too strong — downgrade the highest-power unit that is above tier 1
      const cands = result
        .map((s, i) => ({ i, p: unitPowerScore(s.def.cost, s.tier) }))
        .filter(x => result[x.i].tier > 1)
        .sort((a, b) => b.p - a.p)
      if (cands.length === 0) break
      const { i } = cands[0]
      result[i] = { ...result[i], tier: (result[i].tier - 1) as 1|2|3 }
    } else {
      // Enemy too weak — upgrade a unit below tier 3, preferring higher-cost over
      // cost-3 so the budget flows to cost-4/5 at tier 1 rather than cost-3 at tier 3.
      const cands = result
        .map((s, i) => ({ i, p: unitPowerScore(s.def.cost, s.tier) }))
        .filter(x => result[x.i].tier < 3)
        .sort((a, b) => {
          const ca = result[a.i].def.cost, cb = result[b.i].def.cost
          if ((ca === 3) !== (cb === 3)) return ca === 3 ? 1 : -1  // non-3-cost first
          return a.p - b.p
        })
      if (cands.length === 0) break
      const { i } = cands[0]
      result[i] = { ...result[i], tier: (result[i].tier + 1) as 1|2|3 }
    }
  }

  return result
}

// preferredCost: unit cost to bias toward (matches player's cost distribution)
function pickSlot(
  pool: UnitDefinition[],
  excludeIds: Set<string>,
  budget: number,
  traitCounts: Map<string, number>,
  preferredCost?: number,
): EnemySlot | null {
  const available = pool.filter(u => !excludeIds.has(u.id))
  if (available.length === 0) return null

  const scored = available.map(def => {
    const tier = bestTier(def, budget)
    const dist     = Math.abs(unitPowerScore(def.cost, tier) - budget) / Math.max(budget, 1)
    const syn      = traitSynergyScore(def, traitCounts)
    // Penalise cost distance from the player's distribution to keep boards realistic
    const costDist = preferredCost !== undefined ? Math.abs(def.cost - preferredCost) * 0.5 : 0
    return { def, tier, key: dist * 3 + costDist - syn * 0.55 }
  })
  scored.sort((a, b) => a.key - b.key)

  // Pick randomly from top 4 for variety
  const pick = scored[Math.floor(Math.random() * Math.min(4, scored.length))]
  return { def: pick.def, tier: pick.tier }
}

// Place units on enemy rows 0–3 (row 3 = front, row 0 = back).
// Tanks     → row 3, clustered toward center to form a blocking wall
// Melee carries → row 2; attack fighters occasionally push to row 3
// Ranged    → rows 0–1, corner columns preferred
function placeEnemyUnits(slots: EnemySlot[]): Unit[] {
  const tanks      = slots.filter(s => s.def.role === 'tank')
  const meleeCarry = slots.filter(s => s.def.role !== 'tank' && s.def.baseStats.range <= 1)
  const ranged     = slots.filter(s => s.def.role !== 'tank' && s.def.baseStats.range >  1)

  const used = new Set<string>()
  const results: Unit[] = []

  function tryOccupy(col: number, row: number): boolean {
    if (col < 0 || col >= BOARD_COLS || row < 0 || row > 3) return false
    const k = `${col},${row}`
    if (used.has(k)) return false
    used.add(k)
    return true
  }

  function placeAt(slot: EnemySlot, col: number, row: number): void {
    const u = makeUnit(slot.def.id, 'enemy', slot.tier)
    u.hexPos = { col, row }
    results.push(u)
  }

  function findFree(preferRow: number, preferCol: number): { col: number; row: number } | null {
    const rowOrder = [preferRow, preferRow - 1, preferRow + 1, 0, 1, 2, 3]
      .filter((r, i, a) => r >= 0 && r <= 3 && a.indexOf(r) === i)
    for (const row of rowOrder) {
      for (const col of colsFromCenter(preferCol)) {
        if (tryOccupy(col, row)) return { col, row }
      }
    }
    return null
  }

  // Tanks: row 3, clustered toward the center to block carries behind them
  clusterColumns(tanks.length).forEach((preferCol, i) => {
    const pos = findFree(3, preferCol)
    if (pos) placeAt(tanks[i], pos.col, pos.row)
  })

  // Melee carries: row 2 by default; attack fighters 50% front row, others 25%
  spreadColumns(meleeCarry.length).forEach((preferCol, i) => {
    const slot = meleeCarry[i]
    const frontChance = slot.def.role === 'attack fighter' ? 0.50 : 0.25
    const preferRow = Math.random() < frontChance ? 3 : 2
    const pos = findFree(preferRow, preferCol)
    if (pos) placeAt(slot, pos.col, pos.row)
  })

  // Ranged: rows 0–1, corner-priority columns; fresh priority per slot
  const cornerCols = [0, 6, 1, 5, 2, 4, 3]
  for (const slot of ranged) {
    let placed = false
    outer: for (const row of [0, 1]) {
      for (const col of cornerCols) {
        if (tryOccupy(col, row)) { placeAt(slot, col, row); placed = true; break outer }
      }
    }
    if (!placed) {
      // Board full in back rows — find any remaining slot
      outer: for (let row = 0; row <= 3; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          if (tryOccupy(col, row)) { placeAt(slot, col, row); break outer }
        }
      }
    }
  }

  return results
}

// Place cliff_l / cliff_r for enemy ascender teams.
// Prefers front rows; breaks ties by adjacency to already-placed units so cliffs
// hand out the armor/MR buff to as many neighbors as possible.
function addCliffsIfNeeded(units: Unit[]): Unit[] {
  const ascenderSpecies = new Set(
    units.filter(u => u.types.includes('ascender')).map(u => u.definitionId)
  )
  const n     = ascenderSpecies.size
  const level = n >= 4 ? 4 : n >= 2 ? 2 : 0
  if (level === 0) return units

  const cliffCount = level >= 4 ? 2 : 1
  const occupied   = new Set(units.map(u => `${u.hexPos.col},${u.hexPos.row}`))

  function adjScore(col: number, row: number): number {
    let count = 0
    for (const nb of hexesInRange({ col, row }, 1)) {
      if (nb.col === col && nb.row === row) continue
      if (occupied.has(`${nb.col},${nb.row}`)) count++
    }
    return count
  }

  const cliffIds = cliffCount >= 2 ? ['cliff_l', 'cliff_r'] : ['cliff_l']
  const result   = [...units]

  for (const cliffId of cliffIds) {
    let bestCol = -1, bestRow = -1, bestScore = -Infinity
    // Prefer row 3 (front), allow row 2 as fallback; slight bonus for front row
    for (const row of [3, 2]) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (occupied.has(`${col},${row}`)) continue
        const score = adjScore(col, row) + (row === 3 ? 0.5 : 0)
        if (score > bestScore) { bestScore = score; bestCol = col; bestRow = row }
      }
    }
    if (bestCol < 0) continue

    const cliff     = makeUnit(cliffId, 'enemy', 1)
    cliff.hexPos    = { col: bestCol, row: bestRow }
    result.push(cliff)
    occupied.add(`${bestCol},${bestRow}`)
  }

  return result
}

export function generateEnemyTeam(playerUnits: Unit[], calib?: CalibParams): Unit[] {
  const realPlayer = playerUnits.filter(u => !u.isDummy)

  if (realPlayer.length === 0) {
    const defaults: Array<[string, number, number]> = [
      ['vigoroth', 3, 3],
      ['tangela',  4, 2],
    ]
    return defaults.map(([id, col, row]) => {
      const u = makeUnit(id, 'enemy', 1)
      u.hexPos = { col, row }
      return u
    })
  }

  const profile = calcBoardProfile(realPlayer)
  const w = calib?.w ?? PRIOR_WEIGHTS

  // Calibrated even point: the enemy power at which the learned model predicts
  // a 50% player win chance. Player skill (calib.b) shifts it: a player who
  // consistently over-performs their board power gets matched against stronger
  // enemies at "even". With no calibration this equals the legacy player power.
  const playerCalPower = calibratedPower(profile, w)
  let evenPower = playerCalPower
  if (calib && calib.n > 0) {
    // From sigmoid(k·d + b) = 0.5 → d = -b/k → enemyPower = playerPower + S·b/k
    const S = Math.max(1, playerCalPower)
    evenPower = Math.max(1, playerCalPower + (S * calib.b) / Math.max(1, calib.k))
  }

  // Power delta: 70% chance of tight range (±10%), 30% chance of wide outer band (±25%).
  // Wide draws are biased toward the ±10% boundary via r² so extreme swings are rare.
  let delta: number
  if (Math.random() < 0.70) {
    delta = Math.max(-0.10, Math.min(0.10, (Math.random() + Math.random() - 1) * 0.12))
  } else {
    const r    = Math.random()
    const sign = Math.random() < 0.5 ? -1 : 1
    delta = sign * (0.10 + r * r * 0.15)   // r² biases toward 0.10, rarely reaches 0.25
  }
  const targetPower = Math.max(1, evenPower * (1 + delta))

  // Unit count: 70% same, 15% one fewer, 15% one more
  const countRoll = Math.random()
  const targetCount = countRoll < 0.15
    ? Math.max(1, profile.unitCount - 1)
    : countRoll < 0.30
    ? Math.min(20, profile.unitCount + 1)
    : profile.unitCount

  // Tank count: match player ratio ±1, but always leave room for at least 1 carry
  const tankRatio = profile.unitCount > 0 ? profile.tankCount / profile.unitCount : 0.33
  let targetTankCount = Math.round(tankRatio * targetCount) + (Math.floor(Math.random() * 3) - 1)
  if (targetCount > 1) targetTankCount = Math.min(targetTankCount, targetCount - 1)
  targetTankCount = Math.max(0, targetTankCount)
  const targetCarryCount = targetCount - targetTankCount

  // Extract player's cost distribution per role to guide enemy unit selection.
  // This prevents unrealistic boards (e.g. two 3★ cost-2 tanks when player has cost-1 units).
  const playerTankCosts = realPlayer
    .map(u => UNIT_MAP.get(u.definitionId))
    .filter((d): d is UnitDefinition => !!d && !d.isDummy && d.role === 'tank')
    .map(d => d.cost).sort((a, b) => a - b)

  const playerCarryCosts = realPlayer
    .map(u => UNIT_MAP.get(u.definitionId))
    .filter((d): d is UnitDefinition => !!d && !d.isDummy && d.role !== 'tank')
    .map(d => d.cost).sort((a, b) => a - b)

  // Split power budget proportionally between tanks and carries
  const tankBudget  = targetPower * (targetTankCount  / Math.max(targetCount, 1))
  const carryBudget = targetPower * (targetCarryCount / Math.max(targetCount, 1))

  const excludeIds  = new Set<string>()
  const traitCounts = new Map<string, number>()
  const slots: EnemySlot[] = []

  function addSlot(slot: EnemySlot): void {
    slots.push(slot)
    excludeIds.add(slot.def.id)
    for (const t of slot.def.types) traitCounts.set(t, (traitCounts.get(t) ?? 0) + 1)
  }

  // Select tank slots — cost-guided by player's tank distribution
  let remainingTank = tankBudget
  for (let i = 0; i < targetTankCount; i++) {
    const remaining = targetTankCount - i
    const budget = remainingTank / Math.max(remaining, 1)
    const preferredCost = playerTankCosts.length > 0
      ? playerTankCosts[Math.min(i, playerTankCosts.length - 1)]
      : undefined
    const slot = pickSlot(TANK_POOL, excludeIds, budget, traitCounts, preferredCost)
      ?? pickSlot(ENEMY_POOL, excludeIds, budget, traitCounts)
    if (!slot) break
    addSlot(slot)
    remainingTank -= unitPowerScore(slot.def.cost, slot.tier)
  }

  // Select carry slots — cost-guided; strictly from CARRY_POOL (no tank fallback)
  let remainingCarry = carryBudget
  for (let i = 0; i < targetCarryCount; i++) {
    const remaining = targetCarryCount - i
    const budget = remainingCarry / Math.max(remaining, 1)
    const preferredCost = playerCarryCosts.length > 0
      ? playerCarryCosts[Math.min(i, playerCarryCosts.length - 1)]
      : undefined
    const slot = pickSlot(CARRY_POOL, excludeIds, budget, traitCounts, preferredCost)
    if (!slot) break
    addSlot(slot)
    remainingCarry -= unitPowerScore(slot.def.cost, slot.tier)
  }

  return addCliffsIfNeeded(placeEnemyUnits(clampToTarget(slots, targetPower, w)))
}

// ─── Random player board ─────────────────────────────────────────────────────
// For empty-board starts in normal mode: sample a random reference board to
// set a power/count target, run the coherent board generator against it, then
// mirror the placed result onto the player half (row r → 7 − r) as player
// units — as if the player had placed a sensible board themselves. Cliffs are
// stripped: the Ascender trait re-summons them for player teams at combat start.
export function generateRandomPlayerBoard(): Unit[] {
  const size = 3 + Math.floor(Math.random() * 5)   // 3–7 reference units
  const picked = new Set<string>()
  const seed: Unit[] = []
  let guard = 0
  while (seed.length < size && guard++ < 200) {
    const def = ENEMY_POOL[Math.floor(Math.random() * ENEMY_POOL.length)]
    if (picked.has(def.id)) continue
    picked.add(def.id)
    const r = Math.random()
    const tier: 1 | 2 | 3 = r < 0.55 ? 1 : r < 0.90 ? 2 : 3
    seed.push(makeUnit(def.id, 'player', tier))
  }
  seed.forEach((u, i) => { u.hexPos = { col: 1 + (i % 6), row: 5 + Math.floor(i / 6) } })

  return generateEnemyTeam(seed)
    .filter(u => u.definitionId !== 'cliff_l' && u.definitionId !== 'cliff_r')
    .map(g => {
      const u = makeUnit(g.definitionId, 'player', g.tier as 1 | 2 | 3)
      u.hexPos = { col: g.hexPos.col, row: 7 - g.hexPos.row }
      return u
    })
}
