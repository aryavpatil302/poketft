// Orients a recorded FightLog onto the viewer's own half of the board.
//
// The recorder (src/game/round.ts's buildUnit) places seatA on the 'player'
// team at its true rows and mirrors seatB onto the 'enemy' team by
// the bottom-row flip `row -> (BOARD_ROWS - 1) - row`, which round.ts spells
// out against the board's last row index. A client whose own seat is seatB is
// therefore handed a log
// in which its own units are labelled 'enemy' and sit on the top half — and
// src/game/playback.ts's applyFrame consumes `uf.team` and `uf.hexPos`
// verbatim, so it would faithfully render the viewer's own board as the enemy
// board. This function inverts that one transform, and nothing else.
//
// STRICTLY PRESENTATIONAL. It adds, drops and reorders no frame and no event,
// and touches no tick, HP, mana or damage number. COMBAT-03 requires both
// clients to see the identical fight — identical in events and outcome,
// oriented to each viewer — so `winner` is remapped in exactly one place and
// is never re-derived from reconstructed unit state (playbackWinner keeps
// returning `log.winner` verbatim).

import { hexToPixel, BOARD_ROWS } from '../core/hexGrid'
import { HEX_SIZE } from '../core/constants'
import { cloneFightLog } from '../net/fightWire'
import type { CombatEvent } from '../core/types'
import type { FightLog, UnitFrame, ProjectileFrame } from './round'

// ─── The two reflections ─────────────────────────────────────────────────────

// Derived from BOARD_ROWS, never hardcoded: this is exactly buildUnit's
// `7 - row` read back out of the board constant it came from.
function mirrorRow(row: number): number {
  return BOARD_ROWS - 1 - row
}

// The affine vertical reflection implied by hexToPixel's own formula
// (y = row * 1.5 * size + size): for any row r and its mirror
// BOARD_ROWS - 1 - r, the two pixel centers sum to this constant.
const MIRROR_Y_SUM = (BOARD_ROWS - 1) * 1.5 * HEX_SIZE + 2 * HEX_SIZE

function mirrorPixelY(y: number): number {
  return MIRROR_Y_SUM - y
}

// A unit's visual position is mirrored by ANCHORING TO ITS OWN RECORDED HEX,
// not by the affine reflection above. That is the non-obvious part of this
// file: there is no single affine pixel transform that reproduces the row
// flip, because `BOARD_ROWS - 1 - row` inverts row PARITY, and hexToPixel
// shifts odd rows right by half a hex. A naive vertical pixel flip would
// therefore land half a hex off horizontally on every other row. Taking the
// offset from the unit's own anchor and re-placing it against the mirrored
// anchor makes the transform exact at rest on every hex, and keeps a
// mid-move unit's horizontal drift while inverting its vertical drift.
//
// Anchoring the y component here too (rather than reusing mirrorPixelY) is
// deliberate: it makes the at-rest case exact for ANY HEX_SIZE, not only for
// the one where the anchor pair happens to sum to MIRROR_Y_SUM in floating
// point. Both forms round identically on a mid-move y — measured against a
// real recorded fight, the double-mirror round trip drifts by at most ~6e-14
// px either way — so there is nothing to gain by trading away exactness at
// rest, which is the case a viewer actually stares at.
function mirrorVisualPos(
  visualPos: { x: number; y: number },
  hexPos: { col: number; row: number },
  mirroredHex: { col: number; row: number },
): { x: number; y: number } {
  const anchor = hexToPixel(hexPos, HEX_SIZE)
  const mirroredAnchor = hexToPixel(mirroredHex, HEX_SIZE)
  return {
    x: mirroredAnchor.x + (visualPos.x - anchor.x),
    y: mirroredAnchor.y - (visualPos.y - anchor.y),
  }
}

function swapTeam(team: 'player' | 'enemy'): 'player' | 'enemy' {
  return team === 'player' ? 'enemy' : 'player'
}

// ─── Frame-member mirrors ────────────────────────────────────────────────────

function mirrorUnitFrame(uf: UnitFrame): void {
  const mirroredHex = { col: uf.hexPos.col, row: mirrorRow(uf.hexPos.row) }
  uf.visualPos = mirrorVisualPos(uf.visualPos, uf.hexPos, mirroredHex)
  uf.hexPos = mirroredHex
  uf.team = swapTeam(uf.team)
  // A dash's endpoints are free pixel points with no hex of their own — same
  // situation as a projectile, so they take the affine reflection.
  if (uf.leap) {
    uf.leap.sy = mirrorPixelY(uf.leap.sy)
    uf.leap.ey = mirrorPixelY(uf.leap.ey)
  }
}

// Projectiles carry pixel positions with no hex of their own, so they get the
// exact affine reflection derived from hexToPixel's formula and keep their x
// untouched. A projectile can therefore sit up to half a hex off horizontally
// for the duration of its flight; it is a transient arc, it carries no
// outcome, and the alternative is reconstructing a hex for a point that never
// had one.
function mirrorProjectileFrame(pf: ProjectileFrame): void {
  pf.startPos = { x: pf.startPos.x, y: mirrorPixelY(pf.startPos.y) }
  pf.currentPos = { x: pf.currentPos.x, y: mirrorPixelY(pf.currentPos.y) }
  if (pf.targetPos) pf.targetPos = { x: pf.targetPos.x, y: mirrorPixelY(pf.targetPos.y) }
}

// ─── Events ──────────────────────────────────────────────────────────────────

// CombatEvent DOES carry positional data — a great many of its ~60 vfx
// variants do (x/y, fromX/fromY/toX/toY, hexPositions[], positions[],
// targetRow, direction vectors, swing angles), and one carries a team
// (`earthquake`). An exhaustive switch over that union would be a maintenance
// trap: every new vfx variant added by an ability would silently skip the
// mirror without any compile error, because the miss is a missing case, not a
// type error.
//
// So this walks the event by FIELD NAME instead. The field vocabulary is
// small, consistent across the union, and listed below; anything not named
// here (every id, every amount, every damageType, every duration) is copied
// verbatim, which is what keeps the transform presentational.
const MIRRORED_PIXEL_Y = new Set(['y', 'fromY', 'toY'])
const NEGATED = new Set([
  'dirY',        // a direction vector's vertical component
  'angle',       // a swing/cone orientation: reflecting vertically negates it
  'rotation',
  'startAngle',
  'swingDir',    // handedness, which a reflection flips
])
const MIRRORED_ROW = new Set(['targetRow', 'row'])

function mirrorEventValue(key: string, value: unknown): unknown {
  if (typeof value === 'number') {
    if (MIRRORED_PIXEL_Y.has(key)) return mirrorPixelY(value)
    if (NEGATED.has(key)) return -value
    if (MIRRORED_ROW.has(key)) return mirrorRow(value)
    return value
  }
  if (key === 'team' && (value === 'player' || value === 'enemy')) return swapTeam(value)
  if (Array.isArray(value)) return value.map(entry => mirrorEventValue(key, entry))
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = mirrorEventValue(k, v)
    }
    return out
  }
  return value
}

function mirrorEvent(event: CombatEvent): CombatEvent {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event as unknown as Record<string, unknown>)) {
    out[key] = mirrorEventValue(key, value)
  }
  return out as unknown as CombatEvent
}

// ─── The transform ───────────────────────────────────────────────────────────

// Returns `log` itself, untouched, whenever the viewer already sits on the
// 'player' half (seatA) or holds neither seat — a defensive identity rather
// than a throw, because a spectator or a stale seat must not break playback.
export function mirrorFightLogForSeat(log: FightLog, localSeat: number): FightLog {
  if (log.seatA === localSeat) return log
  if (log.seatB !== localSeat) return log

  // cloneFightLog is the project's existing, already-tested lossless deep copy
  // of a FightLog (it survives the Infinity values a real fight carries, which
  // a bare JSON round trip does not). Mutate the clone; the input is never
  // touched.
  const mirrored = cloneFightLog(log)

  mirrored.seatA = log.seatB
  mirrored.seatB = log.seatA
  mirrored.survivorStarsA = log.survivorStarsB
  mirrored.survivorStarsB = log.survivorStarsA
  mirrored.quakesA = log.quakesB
  mirrored.quakesB = log.quakesA
  // The single place the outcome is remapped. 'draw' stays 'draw'.
  mirrored.winner = log.winner === 'player' ? 'enemy' : log.winner === 'enemy' ? 'player' : 'draw'

  for (const frame of mirrored.frames) {
    for (const uf of frame.units) mirrorUnitFrame(uf)
    for (const pf of frame.projectiles) mirrorProjectileFrame(pf)
    // In place, index by index — the events array must keep its exact length
    // and push order (see round.ts's captureFrame comment on why order is
    // load-bearing).
    for (let i = 0; i < frame.events.length; i++) frame.events[i] = mirrorEvent(frame.events[i])
    // Terrain is global and unchanged; only the per-team tailwind swaps.
    frame.tailwind = { player: frame.tailwind.enemy, enemy: frame.tailwind.player }
  }

  return mirrored
}
