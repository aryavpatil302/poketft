import { makeUnit } from '../core/unitFactory'
import type { Unit } from '../core/types'
import type { OffsetCoord } from '../core/hexGrid'
import { BOARD_COLS } from '../core/hexGrid'

// Mirror player board positions to the enemy side
// Player rows 4-7 → Enemy rows 3-0 (mirrored top-to-bottom, same columns)
function mirrorRow(row: number): number {
  const rowMap: Record<number, number> = { 4: 3, 5: 2, 6: 1, 7: 0 }
  return rowMap[row] ?? 0
}

export function generateEnemyTeam(playerUnits: Unit[]): Unit[] {
  if (playerUnits.length === 0) {
    // Default: Vigoroth at col 3 row 3 and Tangela at col 4 row 2
    const defaults: Array<[string, OffsetCoord]> = [
      ['vigoroth', { col: 3, row: 3 }],
      ['tangela',  { col: 4, row: 2 }],
    ]
    return defaults.map(([id, pos]) => {
      const u = makeUnit(id, 'enemy', 1)
      u.hexPos = pos
      return u
    })
  }

  // Mirror player team composition with same unit types
  const enemyUnits: Unit[] = []
  const usedCols = new Set<string>()

  for (const playerUnit of playerUnits) {
    const mirroredRow = mirrorRow(playerUnit.hexPos.row)
    const mirroredCol = BOARD_COLS - 1 - playerUnit.hexPos.col

    const posKey = `${mirroredCol},${mirroredRow}`
    const fallbackKey = `${playerUnit.hexPos.col},${mirroredRow}`

    let finalPos: OffsetCoord
    if (!usedCols.has(posKey)) {
      finalPos = { col: mirroredCol, row: mirroredRow }
      usedCols.add(posKey)
    } else if (!usedCols.has(fallbackKey)) {
      finalPos = { col: playerUnit.hexPos.col, row: mirroredRow }
      usedCols.add(fallbackKey)
    } else {
      // Find any empty spot in enemy rows (0-3)
      let placed = false
      for (let row = 0; row <= 3 && !placed; row++) {
        for (let col = 0; col < BOARD_COLS && !placed; col++) {
          const k = `${col},${row}`
          if (!usedCols.has(k)) {
            finalPos = { col, row }
            usedCols.add(k)
            placed = true
          }
        }
      }
      if (!placed) continue  // board full
      finalPos = { col: 0, row: 0 }
    }

    const enemy = makeUnit(playerUnit.definitionId, 'enemy', playerUnit.tier)
    enemy.hexPos = finalPos
    enemyUnits.push(enemy)
  }

  return enemyUnits
}
