import type { Unit, CombatState } from '../types'
import type { OffsetCoord } from '../hexGrid'
import { hexDistance, hexToPixel, hexId, findPath, getNeighbors, isValidHex, BOARD_COLS, BOARD_ROWS } from '../hexGrid'
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

// ─── Hex claiming ─────────────────────────────────────────────────────────────
//
// hexOccupancy is one-entry-per-hex, so a blind `set` silently overwrites
// whoever was already there — leaving the evicted unit's hexPos pointing at a
// hex it no longer owns, i.e. two units on one hex. Every path that puts a unit
// onto a hex (dash landing, teleport, spawn) must go through claimHex.

// BFS outward from `fromHex` for a hex nothing is standing on.
// `forUnitId`'s own hex counts as open; `excluded` blocks hexes already handed
// out earlier in the same operation; `rowRange` constrains to [minRow, maxRow].
export function findNearestOpenHex(
  fromHex: OffsetCoord,
  state: CombatState,
  opts: { forUnitId?: string; excluded?: Set<string>; rowRange?: [number, number] } = {},
): OffsetCoord | null {
  const { forUnitId, excluded, rowRange } = opts
  const visited = new Set<string>()
  const queue: OffsetCoord[] = [fromHex]

  while (queue.length > 0) {
    const current = queue.shift()!
    const key     = hexId(current)
    if (visited.has(key)) continue
    visited.add(key)

    if (!isValidHex(current)) continue
    if (rowRange && (current.row < rowRange[0] || current.row > rowRange[1])) continue

    if (!excluded?.has(key) && !isHexBlocked(state, key, forUnitId)) return current

    for (const n of getNeighbors(current)) {
      if (!visited.has(hexId(n))) queue.push(n)
    }
  }
  return null
}

// A hex is blocked only if a LIVING unit that still exists holds it — stale
// entries for dead/removed units are treated as free.
function isHexBlocked(state: CombatState, key: string, exceptUnitId?: string): boolean {
  const occupantId = state.hexOccupancy.get(key)
  if (!occupantId || occupantId === exceptUnitId) return false
  const occupant = state.units.get(occupantId)
  return !!occupant && occupant.state !== 'dead'
}

/**
 * Move `unit` onto `hex`, preserving one-unit-per-hex.
 *
 * If a living unit already holds `hex`, the incumbent keeps it and `unit` is
 * placed on the nearest open hex instead — settled units are never displaced,
 * so a claim can't cascade into a chain of pushes. If the board is completely
 * full the unit stays where it is rather than stacking.
 *
 * Returns the hex actually taken.
 */
export function claimHex(unit: Unit, hex: OffsetCoord, state: CombatState): OffsetCoord {
  const dest = isHexBlocked(state, hexId(hex), unit.id)
    ? findNearestOpenHex(hex, state, { forUnitId: unit.id })
    : hex

  // Board full with nowhere to go — leave the unit on its current hex and
  // re-assert its claim there (a mid-leap unit owns no hex). If even that hex
  // was taken during the flight there is genuinely nowhere to put him: keep the
  // occupancy map truthful by leaving the incumbent's claim alone rather than
  // overwriting it, and accept the visual overlap.
  if (!dest) {
    const key = hexId(unit.hexPos)
    if (!isHexBlocked(state, key, unit.id)) state.hexOccupancy.set(key, unit.id)
    unit.moveProgress = 0
    unit.path = []
    return unit.hexPos
  }

  // Free the old hex only if we still own it — a mid-leap unit owns nothing,
  // and a displaced unit's old key may already belong to someone else.
  const oldKey = hexId(unit.hexPos)
  if (state.hexOccupancy.get(oldKey) === unit.id) state.hexOccupancy.delete(oldKey)

  unit.hexPos       = { ...dest }
  unit.visualPos    = hexToPixel(dest, HEX_SIZE)
  unit.moveProgress = 0
  unit.path         = []
  state.hexOccupancy.set(hexId(dest), unit.id)
  return unit.hexPos
}

export function teleportUnit(unit: Unit, dest: OffsetCoord, state: CombatState): void {
  claimHex(unit, dest, state)
}

/**
 * Release every hex a unit holds. Call this on death instead of
 * `hexOccupancy.delete(hexId(unit.hexPos))`.
 *
 * Blind-deleting by hexPos is wrong for a unit that dies mid-slide: it does NOT
 * own its hexPos (tickMovement frees the origin at takeoff and reserves the
 * destination), so the delete frees whichever unit has since claimed that hex,
 * while the corpse's own reservation leaks and blocks that hex for the rest of
 * combat. Scanning is O(board) and only runs on death.
 */
export function releaseHexes(unit: Unit, state: CombatState): void {
  for (const [key, ownerId] of state.hexOccupancy) {
    if (ownerId === unit.id) state.hexOccupancy.delete(key)
  }
  delete unit._leap
}

/**
 * Per-tick safety net for the one-unit-per-hex invariant.
 *
 * Ability code writes hexOccupancy directly in a lot of places, and any missed
 * `set` leaves a unit standing on a hex the map says belongs to someone else.
 * This sweep finds those squatters and slides them to the nearest open hex, so
 * the invariant self-heals instead of depending on every ability author
 * remembering to call claimHex. O(units) — negligible at ~20 units.
 *
 * Deliberately skipped:
 *   • leaping units — mid-flight they own no hex by design
 *   • moving units  — mid-slide they own their reserved DESTINATION, not the
 *     hexPos they're sliding out of, so "unowned hexPos" is correct there
 */
export function reconcileHexOccupancy(state: CombatState): void {
  // Reverse index: unitId → hex keys it currently owns. Lets us detect orphaned
  // reservations — a settled unit still holding a hex other than its hexPos,
  // leaked when an in-flight interrupt bypassed cancelInFlightMovement.
  const owned = new Map<string, string[]>()
  for (const [key, id] of state.hexOccupancy) {
    const arr = owned.get(id)
    if (arr) arr.push(key); else owned.set(id, [key])
  }

  for (const unit of state.units.values()) {
    if (unit.state === 'dead') continue

    // Leap data present but not actually leaping = a dash that was force-ended
    // mid-flight (ascended/idled by an ability). Clear the dangling _leap so the
    // unit stops owning zero hexes and gets repaired as a settled unit below;
    // snap its sprite back to its (never-updated) hex so it doesn't float mid-air.
    if (unit._leap && unit.state !== 'leaping') {
      const onInterrupt = unit._leap.onInterrupt
      delete unit._leap
      unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
      onInterrupt?.(unit, state)   // dash abandoned without landing — undo flight-only state (e.g. invulnerability)
    }

    // Legitimately in flight (owns no hex) or mid-slide (owns its reserved
    // destination, not hexPos) — occupancy is correct by design, skip.
    if (unit.state === 'leaping' || unit._leap || unit.state === 'moving') continue

    // (a) Ensure the settled unit owns its own hex.
    const key   = hexId(unit.hexPos)
    const owner = state.hexOccupancy.get(key)
    if (owner !== unit.id) {
      if (!isHexBlocked(state, key, unit.id)) state.hexOccupancy.set(key, unit.id)
      else claimHex(unit, unit.hexPos, state)   // genuine overlap — incumbent keeps it
    }

    // (b) Free any OTHER hex still reserved to this unit (the leaked phantom
    // blocker). claimHex may have relocated it, so recompute the hex to keep.
    const mine = owned.get(unit.id)
    if (mine) {
      const keepKey = hexId(unit.hexPos)
      for (const k of mine) {
        if (k !== keepKey && state.hexOccupancy.get(k) === unit.id) state.hexOccupancy.delete(k)
      }
    }
  }
}

// ─── Cancel an in-progress slide or leap (CC interruption) ────────────────────
// Stun/knockup force a unit out of 'moving'/'leaping' via a flat state
// overwrite (see statusEffect.ts) with no cleanup of its own — left alone,
// that strands hexOccupancy: a mid-slide unit already reserved its
// destination hex and freed its origin (see tickMovement), and a mid-leap
// unit already freed its origin with the destination unclaimed (see
// startLeap) — either way hexPos stops updating while occupancy no longer
// matches it, so another unit can end up sharing that hex. Call this
// whenever a unit is forced out of 'moving'/'leaping' by CC, mirroring the
// same interrupted-leap fix already used for Rayquaza's grab.
export function cancelInFlightMovement(unit: Unit, state: CombatState): void {
  if (unit._leap) {
    const visualOnly  = unit._leap.visualOnly
    const onInterrupt = unit._leap.onInterrupt
    delete unit._leap
    unit.moveProgress = 0
    unit.path = []
    // Undo any flight-only state the leap set up (e.g. Excadrill's tunnel
    // invulnerability) — its onLand cleanup will never run now that the dash was
    // interrupted, so without this the unit would keep that state forever.
    onInterrupt?.(unit, state)
    // Real (non-visual) leaps freed the origin at startLeap and only claim the
    // destination on arrival, so the unit currently owns no hex. Re-settle it
    // through claimHex — NOT a blind occupancy set: another unit may have moved
    // or leaped onto the origin during the flight, and a blind set would clobber
    // that claim, stacking two units on one hex. claimHex keeps the origin if
    // it's still free, otherwise relocates to the nearest open hex.
    if (!visualOnly) {
      claimHex(unit, unit.hexPos, state)
    }
    return
  }

  if (unit.state === 'moving' && unit.path.length > 0) {
    const nextHex = unit.path[0]
    // Only snap forward if the destination was actually reserved for us
    // (the normal mid-slide case) — a unit can be in 'moving' state for one
    // tick before its first tickMovement() call ever runs, in which case
    // nothing was reserved yet and hexPos/occupancy are already consistent.
    if (state.hexOccupancy.get(hexId(nextHex)) === unit.id) {
      unit.hexPos = nextHex
      unit.visualPos = hexToPixel(nextHex, HEX_SIZE)
    }
    unit.moveProgress = 0
    unit.path = []
  }
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
    // Free the origin only if we still own it. A slide that was interrupted and
    // restarted from the same hexPos may have had that hex reserved by another
    // mover in the meantime (this unit freed it on the first slide-start) —
    // deleting it blindly would clobber that unit's reservation.
    const originKey = hexId(unit.hexPos)
    if (state.hexOccupancy.get(originKey) === unit.id) state.hexOccupancy.delete(originKey)
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

// LeapData now lives on Unit in types.ts — the renderer reads dash progress
// off it, so it's part of the real schema rather than a module-augmented field.

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
  onInterrupt?: (unit: Unit, state: CombatState) => void,
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
    onInterrupt,
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
      // Real leap — commit hexPos and claim the destination hex. The hex was
      // picked at cast time and may have been taken during the flight, so this
      // can land him on a neighbouring hex instead (see claimHex).
      // claimHex snaps visualPos to whichever hex he actually took.
      claimHex(unit, leap.destHex, state)
    }
    const onLand = leap.onLand
    delete unit._leap
    onLand?.(unit, state)
    return true
  }

  return false
}

// ─── A* path recalculation ────────────────────────────────────────────────────

// Per-hex extra pathfinding cost for occupied-but-traversable hexes:
//   • MOVING units — light penalty; they'll usually have vacated by arrival.
//   • stationary ALLIES — heavy penalty; a unit prefers open lanes but can
//     squeeze through its own team when it would otherwise be fully boxed in
//     (prevents the "enclosed by idle allies, stands still all fight" deadlock).
// Stationary ENEMIES stay hard blocks (never added).
const SOFT_MOVING = 4
const SOFT_ALLY   = 12

export function softPassableCosts(state: CombatState, mover: Unit): Map<string, number> {
  const costs = new Map<string, number>()
  for (const [hex, unitId] of state.hexOccupancy) {
    if (unitId === mover.id) continue
    const u = state.units.get(unitId)
    if (!u || u.state === 'dead') continue
    if (u.state === 'moving') costs.set(hex, SOFT_MOVING)
    else if (u.team === mover.team) costs.set(hex, SOFT_ALLY)
  }
  return costs
}

export function recalculatePath(unit: Unit, state: CombatState): void {
  if (!unit.targetId) { unit.path = []; return }

  const target = state.units.get(unit.targetId)
  if (!target || target.state === 'dead') { unit.path = []; return }

  // A fresh path always starts a fresh slide: reset moveProgress so a stale
  // fractional value (left by an interrupted slide) can't make tickMovement skip
  // its reserve+collision check and stack the unit onto an occupied hex.
  unit.moveProgress = 0

  const stats = unit._computedStats ?? computeStats(unit)
  const result = findPath(unit.hexPos, target.hexPos, state.hexOccupancy, unit.id, stats.range,
    softPassableCosts(state, unit))
  unit.path = result.path.length > 1 ? result.path.slice(1) : []
}
