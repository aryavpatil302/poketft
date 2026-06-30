import type { Unit, CombatState } from '../types'
import type { OffsetCoord } from '../hexGrid'
import { hexDistance, hexToPixel, hexId, findPath, getNeighbors, BOARD_COLS, BOARD_ROWS } from '../hexGrid'
import { HEX_SIZE, TICK_RATE } from '../constants'
import { computeStats } from '../unitFactory'

// ─── Pathfinding helper ───────────────────────────────────────────────────────

export function findBestAttackHex(
  unit: Unit,
  target: Unit,
  state: CombatState,
): OffsetCoord | null {
  const stats = unit._computedStats ?? computeStats(unit)
  const range = stats.range

  if (hexDistance(unit.hexPos, target.hexPos) <= range) {
    return unit.hexPos
  }

  const result = findPath(unit.hexPos, target.hexPos, state.hexOccupancy, unit.id, range)
  if (result.path.length > 1) return result.path[result.path.length - 1]
  if (result.path.length === 1 && hexDistance(result.path[0], target.hexPos) <= range) return result.path[0]

  const candidates = getNeighbors(target.hexPos).filter(h => {
    if (h.col < 0 || h.col >= BOARD_COLS || h.row < 0 || h.row >= BOARD_ROWS) return false
    const id = hexId(h)
    const occupant = state.hexOccupancy.get(id)
    return !occupant || occupant === unit.id
  })
  candidates.sort((a, b) => hexDistance(a, unit.hexPos) - hexDistance(b, unit.hexPos))
  return candidates[0] ?? null
}

// ─── Teleport (instant position change) ──────────────────────────────────────

export function teleportUnit(unit: Unit, dest: OffsetCoord, state: CombatState): void {
  state.hexOccupancy.delete(hexId(unit.hexPos))
  unit.hexPos = dest
  unit.visualPos = hexToPixel(dest, HEX_SIZE)
  unit.moveProgress = 0
  unit.path = []
  state.hexOccupancy.set(hexId(dest), unit.id)
}

// ─── Normal movement tick ─────────────────────────────────────────────────────
// Returns true when the unit steps onto a new hex (caller should recalculate path).

export function tickMovement(unit: Unit, state: CombatState): boolean {
  if (unit.path.length === 0) return true

  const nextHex = unit.path[0]

  // At the very start of a new slide (moveProgress === 0):
  //   • Check if the destination is blocked by another unit — reroute if so.
  //   • Reserve the destination immediately so no other unit can also claim it
  //     this same tick, and free the origin so units behind us can follow.
  if (unit.moveProgress === 0) {
    const occupant = state.hexOccupancy.get(hexId(nextHex))
    if (occupant && occupant !== unit.id) {
      // Destination became occupied — clear path and let caller recalculate.
      unit.path = []
      return true
    }
    state.hexOccupancy.delete(hexId(unit.hexPos))
    state.hexOccupancy.set(hexId(nextHex), unit.id)
  }

  const stats = unit._computedStats ?? computeStats(unit)
  const ticksPerHex = Math.round(60 / stats.moveSpeed)

  unit.moveProgress += 1 / ticksPerHex

  const currentPx = hexToPixel(unit.hexPos, HEX_SIZE)
  const nextPx    = hexToPixel(nextHex, HEX_SIZE)
  const t = Math.min(unit.moveProgress, 1)
  unit.visualPos = {
    x: currentPx.x + (nextPx.x - currentPx.x) * t,
    y: currentPx.y + (nextPx.y - currentPx.y) * t,
  }

  if (unit.moveProgress >= 1) {
    // Destination was already claimed above; just commit hexPos.
    unit.moveProgress = 0
    unit.hexPos = nextHex
    unit.path.shift()
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
    return true
  }

  return false
}

// ─── Leap: direct pixel lerp (ability dashes) ─────────────────────────────────
//
// Instead of moving hex-by-hex, the unit lerps its visualPos directly from the
// origin pixel to the destination pixel in a single straight line.
//
//   • No intermediate hexes are visited or claimed in hexOccupancy.
//   • The origin hex is freed immediately on startLeap().
//   • The destination hex is claimed only when tickLeapPixel() completes.
//   • hexPos stays at the origin until arrival, then jumps to dest.
//
// This gives a clean straight-line visual dash through any units in the way.

interface LeapData {
  sx: number; sy: number     // start pixel
  ex: number; ey: number     // end pixel
  tick: number               // ticks elapsed (0 → total)
  total: number              // total ticks for the dash
  destHex: OffsetCoord       // hex to claim on arrival
  onLand?: (unit: Unit, state: CombatState) => void
  onMidpoint?: (unit: Unit, state: CombatState) => void
  midpointFired: boolean
  visualOnly?: boolean       // skip hexPos/occupancy changes — sprite-only animation
}

declare module '../types' {
  interface Unit {
    _leap?: LeapData
    hexOccupancy_updated?: boolean
  }
}

/**
 * Begin a leap dash. Call this from the ability's onCast handler.
 *
 * @param hasteMagnitude  The speed multiplier bonus (e.g. 4.0 → 5× base speed).
 */
export function startLeap(
  unit: Unit,
  dest: OffsetCoord,
  state: CombatState,
  hasteMagnitude: number,
  onLand?: (unit: Unit, state: CombatState) => void,
  onMidpoint?: (unit: Unit, state: CombatState) => void,
  visualOnly?: boolean,
): void {
  const leapSpeed   = unit.moveSpeed * (1 + hasteMagnitude)
  const ticksPerHex = Math.round(TICK_RATE / leapSpeed)
  const hexDist     = Math.max(1, hexDistance(unit.hexPos, dest))
  const totalTicks  = hexDist * ticksPerHex

  const destPx = hexToPixel(dest, HEX_SIZE)

  // For real leaps, free the origin hex so other units can path through.
  // Visual-only leaps never change occupancy — the unit stays on its hex.
  if (!visualOnly) {
    state.hexOccupancy.delete(hexId(unit.hexPos))
  }

  unit._leap = {
    sx: unit.visualPos.x,
    sy: unit.visualPos.y,
    ex: destPx.x,
    ey: destPx.y,
    tick: 0,
    total: totalTicks,
    destHex: dest,
    onLand,
    onMidpoint,
    midpointFired: false,
    visualOnly,
  }
  unit.path = []
}

/**
 * Advance the leap one tick. Returns true when the unit has arrived.
 * Call this every tick while unit.state === 'leaping'.
 */
export function tickLeapPixel(unit: Unit, state: CombatState): boolean {
  const leap = unit._leap
  if (!leap) return true   // no leap data → treat as done

  leap.tick++
  const t = Math.min(leap.tick / leap.total, 1)

  unit.visualPos = {
    x: leap.sx + (leap.ex - leap.sx) * t,
    y: leap.sy + (leap.ey - leap.sy) * t,
  }

  if (!leap.midpointFired && leap.tick >= Math.ceil(leap.total / 2)) {
    leap.midpointFired = true
    leap.onMidpoint?.(unit, state)
  }

  if (t >= 1) {
    unit.visualPos = { x: leap.ex, y: leap.ey }
    unit.moveProgress = 0
    if (!leap.visualOnly) {
      // Real leap — commit hexPos and claim the destination hex.
      unit.hexPos = leap.destHex
      state.hexOccupancy.set(hexId(unit.hexPos), unit.id)
    }
    const onLand = leap.onLand
    delete unit._leap
    onLand?.(unit, state)
    return true
  }

  return false
}

// ─── A* path recalculation ────────────────────────────────────────────────────

export function recalculatePath(unit: Unit, state: CombatState): void {
  if (!unit.targetId) { unit.path = []; return }

  const target = state.units.get(unit.targetId)
  if (!target || target.state === 'dead') { unit.path = []; return }

  const stats = unit._computedStats ?? computeStats(unit)
  const result = findPath(unit.hexPos, target.hexPos, state.hexOccupancy, unit.id, stats.range)
  unit.path = result.path.length > 1 ? result.path.slice(1) : []
}
