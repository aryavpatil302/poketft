/**
 * Hex Grid Math + A* Pathfinding
 *
 * Coordinate system:
 *   Storage:  OffsetCoord (col 0-6, row 0-7) — "odd-row" offset layout
 *             Odd rows (1, 3, 5, 7) are shifted right by half a hex, matching TFT's board.
 *   Math:     CubeCoord (q, r, s where q+r+s=0) — used for all distance/neighbor logic.
 *
 * Hex orientation: POINTY-TOP (vertices at top/bottom, flat sides left/right).
 *   horizSpacing = sqrt(3) * size
 *   vertSpacing  = 1.5 * size
 *   Odd rows shift right by horizSpacing / 2
 *
 * Board: 7 columns (0-6), 8 rows (0-7)
 *   Rows 0-3 = enemy half (top), rows 4-7 = player half (bottom)
 */

export interface OffsetCoord {
  col: number // 0-6
  row: number // 0-7
}

export interface CubeCoord {
  q: number
  r: number
  s: number // always = -q - r
}

export type HexId = string // `${col},${row}`

// ─── Board constants ──────────────────────────────────────────────────────────

export const BOARD_COLS = 7
export const BOARD_ROWS = 8  // 4 enemy rows (0-3) + 4 player rows (4-7)

// ─── Coordinate conversion ────────────────────────────────────────────────────

/**
 * Odd-row offset → cube coordinates.
 * Odd rows (row % 2 === 1) are shifted right by half a hex.
 */
export function offsetToCube(o: OffsetCoord): CubeCoord {
  const q = o.col - (o.row - (o.row & 1)) / 2
  const r = o.row
  return { q, r, s: -q - r }
}

export function cubeToOffset(c: CubeCoord): OffsetCoord {
  const col = c.q + (c.r - (c.r & 1)) / 2
  const row = c.r
  return { col, row }
}

// ─── Distance ─────────────────────────────────────────────────────────────────

export function cubeDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s))
}

export function hexDistance(a: OffsetCoord, b: OffsetCoord): number {
  return cubeDistance(offsetToCube(a), offsetToCube(b))
}

// ─── Neighbors ────────────────────────────────────────────────────────────────

// The 6 cube-direction vectors
const CUBE_DIRS: CubeCoord[] = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
]

function cubeAdd(a: CubeCoord, b: CubeCoord): CubeCoord {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s }
}

export function isValidHex(h: OffsetCoord): boolean {
  return h.col >= 0 && h.col < BOARD_COLS && h.row >= 0 && h.row < BOARD_ROWS
}

/** Returns all valid board neighbors of a hex. */
export function getNeighbors(h: OffsetCoord): OffsetCoord[] {
  const cube = offsetToCube(h)
  return CUBE_DIRS.map(d => cubeToOffset(cubeAdd(cube, d))).filter(isValidHex)
}

// ─── HexId helpers ────────────────────────────────────────────────────────────

export function hexId(h: OffsetCoord): HexId {
  return `${h.col},${h.row}`
}

export function hexFromId(id: HexId): OffsetCoord {
  const [col, row] = id.split(',').map(Number)
  return { col, row }
}

export function hexEquals(a: OffsetCoord, b: OffsetCoord): boolean {
  return a.col === b.col && a.row === b.row
}

// ─── Pixel conversion ─────────────────────────────────────────────────────────

/**
 * Returns the pixel center of a hex given the hex size (circumradius).
 * Pointy-top orientation: vertices at top and bottom.
 * Origin is top-left of the board canvas area.
 */
export function hexToPixel(h: OffsetCoord, hexSize: number): { x: number; y: number } {
  // Pointy-top hexes: width = sqrt(3)*size, height = 2*size
  // Horizontal spacing between column centers = sqrt(3) * size
  // Vertical spacing between row centers     = 1.5 * size
  // Odd rows shift RIGHT by horizSpacing / 2
  const horizSpacing = Math.sqrt(3) * hexSize
  const vertSpacing  = hexSize * 1.5
  const x = h.col * horizSpacing + (h.row % 2 === 1 ? horizSpacing / 2 : 0) + horizSpacing / 2
  const y = h.row * vertSpacing + hexSize
  return { x, y }
}

/**
 * Converts a pixel position back to the nearest hex.
 * Useful for click detection in the board UI.
 */
export function pixelToHex(px: number, py: number, hexSize: number): OffsetCoord {
  // Inverse of hexToPixel — brute force nearest-center for now (board is small)
  let best: OffsetCoord = { col: 0, row: 0 }
  let bestDist = Infinity
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const h = { col, row }
      const center = hexToPixel(h, hexSize)
      const d = (px - center.x) ** 2 + (py - center.y) ** 2
      if (d < bestDist) {
        bestDist = d
        best = h
      }
    }
  }
  return best
}

// ─── A* Pathfinding ───────────────────────────────────────────────────────────

export interface PathResult {
  path: OffsetCoord[] // Includes start hex, excludes hexes that couldn't be entered
  reachable: boolean  // True if goal was reached
}

/**
 * A* pathfinding on the hex board.
 *
 * @param start        Starting hex
 * @param goal         Target hex (unit will try to reach this or the nearest passable neighbor)
 * @param occupancy    Map of hexId → unitId for all occupied hexes
 * @param movingUnitId The unit doing the moving (its own hex is NOT treated as blocked)
 * @param stopAtRange  Stop when within this many hexes of goal (0 = reach goal itself)
 */
export function findPath(
  start: OffsetCoord,
  goal: OffsetCoord,
  occupancy: Map<HexId, string>,
  movingUnitId: string,
  stopAtRange = 0,
): PathResult {
  // If already within range, no movement needed
  if (hexDistance(start, goal) <= stopAtRange) {
    return { path: [start], reachable: true }
  }

  const startId = hexId(start)
  const goalId = hexId(goal)

  // Hexes blocked to movement (occupied by OTHER units, excluding goal hex which
  // is the target — units can approach adjacent to it)
  function isBlocked(h: OffsetCoord): boolean {
    const id = hexId(h)
    if (id === startId) return false  // own hex
    if (id === goalId && stopAtRange === 0) return false  // can enter goal if range 0
    const occupant = occupancy.get(id)
    return occupant !== undefined && occupant !== movingUnitId
  }

  // Priority queue (min-heap via sorted array — board is tiny, 28 hexes max)
  type Node = { hex: OffsetCoord; g: number; f: number; parent: HexId | null }
  const open: Node[] = []
  const closed = new Set<HexId>()
  const nodeMap = new Map<HexId, Node>()

  const startNode: Node = { hex: start, g: 0, f: hexDistance(start, goal), parent: null }
  open.push(startNode)
  nodeMap.set(startId, startNode)

  while (open.length > 0) {
    // Pop node with lowest f
    open.sort((a, b) => a.f - b.f)
    const current = open.shift()!
    const currentId = hexId(current.hex)
    closed.add(currentId)

    // Check if we reached goal or within stopAtRange
    if (hexDistance(current.hex, goal) <= stopAtRange) {
      // Reconstruct path
      const path: OffsetCoord[] = []
      let node: Node | undefined = current
      while (node) {
        path.unshift(node.hex)
        node = node.parent ? nodeMap.get(node.parent) : undefined
      }
      return { path, reachable: true }
    }

    for (const neighbor of getNeighbors(current.hex)) {
      const nId = hexId(neighbor)
      if (closed.has(nId)) continue
      if (isBlocked(neighbor)) continue

      const g = current.g + 1
      const h = hexDistance(neighbor, goal)
      const existing = nodeMap.get(nId)

      if (!existing || g < existing.g) {
        const node: Node = { hex: neighbor, g, f: g + h, parent: currentId }
        nodeMap.set(nId, node)
        if (!open.find(n => hexId(n.hex) === nId)) {
          open.push(node)
        }
      }
    }
  }

  // Goal unreachable — return path to closest reachable hex to goal
  // Find the closed node closest to goal
  let bestNode: Node | null = null
  let bestDist = Infinity
  for (const [id, node] of nodeMap) {
    if (!closed.has(id)) continue
    const d = hexDistance(node.hex, goal)
    if (d < bestDist) {
      bestDist = d
      bestNode = node
    }
  }

  if (bestNode) {
    const path: OffsetCoord[] = []
    let node: Node | undefined = bestNode
    while (node) {
      path.unshift(node.hex)
      node = node.parent ? nodeMap.get(node.parent) : undefined
    }
    return { path, reachable: false }
  }

  return { path: [start], reachable: false }
}

// ─── Hex line ─────────────────────────────────────────────────────────────────

/**
 * Returns every hex along the straight line from `a` to `b` (inclusive of both ends).
 * Uses cube-coordinate lerp + rounding — the standard "supercover" hex line algorithm.
 * Does NOT check board validity; caller can filter with isValidHex if needed.
 */
function cubeRound(q: number, r: number, s: number): CubeCoord {
  let rq = Math.round(q)
  let rr = Math.round(r)
  let rs = Math.round(s)
  const dq = Math.abs(rq - q)
  const dr = Math.abs(rr - r)
  const ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds)        rr = -rq - rs
  else                     rs = -rq - rr
  return { q: rq, r: rr, s: rs }
}

export function hexLinePath(a: OffsetCoord, b: OffsetCoord): OffsetCoord[] {
  const N = hexDistance(a, b)
  if (N === 0) return [a]
  const ac = offsetToCube(a)
  const bc = offsetToCube(b)
  const result: OffsetCoord[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const cube = cubeRound(
      ac.q + (bc.q - ac.q) * t,
      ac.r + (bc.r - ac.r) * t,
      ac.s + (bc.s - ac.s) * t,
    )
    result.push(cubeToOffset(cube))
  }
  return result
}

// ─── Hex area ─────────────────────────────────────────────────────────────────

/**
 * Returns all hexes within `range` distance of `center` that are on the board.
 * Useful for AoE ability targeting.
 */
export function hexesInRange(center: OffsetCoord, range: number): OffsetCoord[] {
  const result: OffsetCoord[] = []
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const h = { col, row }
      if (hexDistance(center, h) <= range) result.push(h)
    }
  }
  return result
}
