import { describe, it, expect } from 'vitest'
import {
  offsetToCube,
  cubeToOffset,
  cubeDistance,
  hexDistance,
  getNeighbors,
  hexToPixel,
  pixelToHex,
  isValidHex,
  hexId,
  findPath,
  hexesInRange,
  BOARD_COLS,
  BOARD_ROWS,
} from './hexGrid'

// ─── Coordinate Conversion ────────────────────────────────────────────────────

describe('offsetToCube / cubeToOffset round-trip', () => {
  it('round-trips every board hex', () => {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const o = { col, row }
        const back = cubeToOffset(offsetToCube(o))
        expect(back).toEqual(o)
      }
    }
  })

  it('cube coords satisfy q+r+s = 0', () => {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const c = offsetToCube({ col, row })
        expect(c.q + c.r + c.s).toBe(0)
      }
    }
  })
})

// ─── Distance ─────────────────────────────────────────────────────────────────

describe('hexDistance', () => {
  it('same hex = distance 0', () => {
    expect(hexDistance({ col: 3, row: 2 }, { col: 3, row: 2 })).toBe(0)
  })

  it('adjacent hex = distance 1', () => {
    // col neighbors in same even row
    expect(hexDistance({ col: 0, row: 0 }, { col: 1, row: 0 })).toBe(1)
  })

  it('A1 to A3 (col 0,row 0 to col 2,row 0) = distance 2', () => {
    // Same row, 2 columns apart
    expect(hexDistance({ col: 0, row: 0 }, { col: 2, row: 0 })).toBe(2)
  })

  it('A1 to D1 (col 0,row 0 to col 0,row 3) = distance 3 (vertical)', () => {
    expect(hexDistance({ col: 0, row: 0 }, { col: 0, row: 3 })).toBe(3)
  })

  it('opposite corners A1 to D7 >= 6', () => {
    // Top-left to bottom-right should be at least 6 hexes apart
    const d = hexDistance({ col: 0, row: 0 }, { col: 6, row: 3 })
    expect(d).toBeGreaterThanOrEqual(6)
  })

  it('is symmetric', () => {
    const a = { col: 1, row: 0 }
    const b = { col: 4, row: 2 }
    expect(hexDistance(a, b)).toBe(hexDistance(b, a))
  })
})

describe('cubeDistance', () => {
  it('cubeDistance between same point = 0', () => {
    expect(cubeDistance({ q: 0, r: 0, s: 0 }, { q: 0, r: 0, s: 0 })).toBe(0)
  })
})

// ─── Neighbors ────────────────────────────────────────────────────────────────

describe('getNeighbors', () => {
  it('corner hex A1 (col 0, row 0) has exactly 2 valid neighbors', () => {
    const n = getNeighbors({ col: 0, row: 0 })
    expect(n.length).toBe(2)
  })

  it('corner hex D7 (col 6, row 3) has valid neighbors', () => {
    const n = getNeighbors({ col: 6, row: 3 })
    expect(n.length).toBeGreaterThanOrEqual(2)
  })

  it('center hex (col 3, row 1) has 6 valid neighbors', () => {
    const n = getNeighbors({ col: 3, row: 1 })
    expect(n.length).toBe(6)
  })

  it('all neighbors are valid board hexes', () => {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        for (const n of getNeighbors({ col, row })) {
          expect(isValidHex(n)).toBe(true)
        }
      }
    }
  })

  it('all neighbors are distance 1 from source', () => {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const h = { col, row }
        for (const n of getNeighbors(h)) {
          expect(hexDistance(h, n)).toBe(1)
        }
      }
    }
  })

  it('neighbor relationship is symmetric', () => {
    // If B is neighbor of A, A must be neighbor of B
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const a = { col, row }
        for (const b of getNeighbors(a)) {
          const bNeighbors = getNeighbors(b)
          const aIsNeighborOfB = bNeighbors.some(n => n.col === a.col && n.row === a.row)
          expect(aIsNeighborOfB).toBe(true)
        }
      }
    }
  })
})

// ─── isValidHex ───────────────────────────────────────────────────────────────

describe('isValidHex', () => {
  it('board corners are valid', () => {
    expect(isValidHex({ col: 0, row: 0 })).toBe(true)
    expect(isValidHex({ col: 6, row: 3 })).toBe(true)
  })

  it('out-of-bounds hexes are invalid', () => {
    expect(isValidHex({ col: -1, row: 0 })).toBe(false)
    expect(isValidHex({ col: 7, row: 0 })).toBe(false)
    expect(isValidHex({ col: 0, row: -1 })).toBe(false)
    expect(isValidHex({ col: 0, row: 8 })).toBe(false)  // board has rows 0-7
  })
})

// ─── hexId ────────────────────────────────────────────────────────────────────

describe('hexId', () => {
  it('produces unique IDs for every board hex', () => {
    const ids = new Set<string>()
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        ids.add(hexId({ col, row }))
      }
    }
    expect(ids.size).toBe(BOARD_ROWS * BOARD_COLS) // 28
  })
})

// ─── hexToPixel / pixelToHex ──────────────────────────────────────────────────

describe('hexToPixel / pixelToHex round-trip', () => {
  it('round-trips hex centers for every board hex', () => {
    const SIZE = 50
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const h = { col, row }
        const { x, y } = hexToPixel(h, SIZE)
        const back = pixelToHex(x, y, SIZE)
        expect(back).toEqual(h)
      }
    }
  })

  it('odd rows are offset right relative to even rows', () => {
    const SIZE = 50
    const evenRow = hexToPixel({ col: 0, row: 0 }, SIZE)
    const oddRow  = hexToPixel({ col: 0, row: 1 }, SIZE)
    // Odd row col-0 should have a greater x than even row col-0
    expect(oddRow.x).toBeGreaterThan(evenRow.x)
  })
})

// ─── A* Pathfinding ───────────────────────────────────────────────────────────

describe('findPath', () => {
  const emptyMap = new Map<string, string>()

  it('path from a hex to itself has length 1', () => {
    const result = findPath({ col: 0, row: 0 }, { col: 0, row: 0 }, emptyMap, 'u1')
    expect(result.path).toHaveLength(1)
    expect(result.reachable).toBe(true)
  })

  it('finds path between adjacent hexes (length 2: start + goal)', () => {
    const result = findPath({ col: 0, row: 0 }, { col: 1, row: 0 }, emptyMap, 'u1')
    expect(result.reachable).toBe(true)
    expect(result.path).toHaveLength(2)
    expect(result.path[0]).toEqual({ col: 0, row: 0 })
    expect(result.path[result.path.length - 1]).toEqual({ col: 1, row: 0 })
  })

  it('path length is >= hex distance', () => {
    for (let trial = 0; trial < 10; trial++) {
      const start = { col: Math.floor(Math.random() * 7), row: Math.floor(Math.random() * 4) }
      const goal  = { col: Math.floor(Math.random() * 7), row: Math.floor(Math.random() * 4) }
      const result = findPath(start, goal, emptyMap, 'u1')
      if (result.reachable) {
        const dist = hexDistance(start, goal)
        // path includes start, so length = dist + 1
        expect(result.path.length).toBeGreaterThanOrEqual(dist + 1)
      }
    }
  })

  it('path starts at start and ends at goal on empty board', () => {
    const start = { col: 0, row: 0 }
    const goal  = { col: 6, row: 3 }
    const result = findPath(start, goal, emptyMap, 'u1')
    expect(result.reachable).toBe(true)
    expect(result.path[0]).toEqual(start)
    expect(result.path[result.path.length - 1]).toEqual(goal)
  })

  it('routes around a blocked hex', () => {
    // Block the only direct path from (0,0) → (1,0) by occupying (1,0)
    const occupied = new Map([['1,0', 'enemy']])
    const result = findPath({ col: 0, row: 0 }, { col: 2, row: 0 }, occupied, 'u1')
    expect(result.reachable).toBe(true)
    // Path should not go through the blocked hex
    const passesThrough10 = result.path.some(h => h.col === 1 && h.row === 0)
    expect(passesThrough10).toBe(false)
  })

  it('stopAtRange=1 stops adjacent to goal, not on it', () => {
    const result = findPath({ col: 0, row: 0 }, { col: 4, row: 0 }, emptyMap, 'u1', 1)
    expect(result.reachable).toBe(true)
    const last = result.path[result.path.length - 1]
    expect(hexDistance(last, { col: 4, row: 0 })).toBeLessThanOrEqual(1)
    expect(last).not.toEqual({ col: 4, row: 0 })
  })

  it('moving unit own hex is not treated as blocked', () => {
    // Unit is at (0,0), occupied map says (0,0) is occupied by 'u1'
    const occupied = new Map([['0,0', 'u1']])
    const result = findPath({ col: 0, row: 0 }, { col: 2, row: 0 }, occupied, 'u1')
    expect(result.reachable).toBe(true)
  })

  it('returns partial path when goal is completely surrounded', () => {
    // Surround (3,1) with enemy units
    const surrounded = { col: 3, row: 1 }
    const neighbors = getNeighbors(surrounded)
    const occupied = new Map<string, string>()
    for (const n of neighbors) occupied.set(hexId(n), 'enemy')
    occupied.set(hexId(surrounded), 'enemy')

    const result = findPath({ col: 0, row: 0 }, surrounded, occupied, 'u1')
    // Can't reach, but should get as close as possible
    expect(result.reachable).toBe(false)
    expect(result.path.length).toBeGreaterThan(0)
  })
})

// ─── hexesInRange ─────────────────────────────────────────────────────────────

describe('hexesInRange', () => {
  it('range 0 returns only the center', () => {
    const result = hexesInRange({ col: 3, row: 1 }, 0)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ col: 3, row: 1 })
  })

  it('range 1 returns center + neighbors', () => {
    const center = { col: 3, row: 1 }
    const result = hexesInRange(center, 1)
    const neighbors = getNeighbors(center)
    expect(result.length).toBe(1 + neighbors.length)
  })

  it('all returned hexes are valid board hexes', () => {
    for (const h of hexesInRange({ col: 3, row: 1 }, 3)) {
      expect(isValidHex(h)).toBe(true)
    }
  })

  it('all returned hexes are within range', () => {
    const center = { col: 3, row: 1 }
    const range = 2
    for (const h of hexesInRange(center, range)) {
      expect(hexDistance(center, h)).toBeLessThanOrEqual(range)
    }
  })
})
