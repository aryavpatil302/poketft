import { describe, it, expect, beforeAll } from 'vitest'
import { newRun } from '../econ/runState'
import { botSeats } from '../econ/bots'
import { recordFight } from './round'
import type { FightLog, FightFrame, UnitFrame } from './round'
import { cloneFightLog } from '../net/fightWire'
import { hexToPixel, BOARD_COLS, BOARD_ROWS } from '../core/hexGrid'
import { HEX_SIZE } from '../core/constants'
import type { CombatEvent } from '../core/types'
import { mirrorFightLogForSeat } from './playbackPerspective'
import '../core/systems/ability'   // register abilities for the headless sim

// ─── Fixtures ────────────────────────────────────────────────────────────────

function emptyFrame(units: UnitFrame[], events: CombatEvent[] = []): FightFrame {
  return {
    tick: 1,
    units,
    projectiles: [],
    events,
    terrain: { electric: false, psychic: true, grassy: false, misty: false, sunny: false },
    tailwind: { player: true, enemy: false },
  }
}

function unitAt(id: string, hexPos: { col: number; row: number }, visualPos: { x: number; y: number }): UnitFrame {
  return {
    id,
    definitionId: 'zubat',
    team: 'player',
    tier: 1,
    hexPos,
    visualPos,
    currentHp: 500, maxHp: 700, currentMana: 10, maxMana: 60,
    state: 'moving', items: [],
    targetId: null, attackTimer: 0, attackWindupTimer: 0,
    isInWindup: false, pendingCrit: false, abilityCastTimer: 0, attackCount: 0,
    attackModifiers: [], shields: [], statusEffects: [], marks: [],
    dmgDealt: { physical: 0, magic: 0, true: 0 },
    dmgTaken: { physical: 0, magic: 0, true: 0 },
  }
}

function logWith(frames: FightFrame[]): FightLog {
  return {
    seatA: 0, seatB: 1, stage: 4, winner: 'player', ticksElapsed: frames.length,
    survivorStarsA: 5, survivorStarsB: 2, quakesA: 3, quakesB: 1, frames,
  }
}

// A real, genuinely simulated fight — the involution and non-mutation proofs
// run against this rather than a hand-built literal, the same way
// src/net/fightWire.test.ts gets a genuine log.
let realLog: FightLog

beforeAll(() => {
  const run = newRun(botSeats())
  run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
  run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 2, row: 6 } }]
  realLog = recordFight(run, 0, 1, 1)
  expect(realLog.frames.length).toBeGreaterThan(10)
})

// ─── Identity cases ──────────────────────────────────────────────────────────

describe('mirrorFightLogForSeat — identity', () => {
  it('returns the same log object unchanged when the viewer is seatA', () => {
    const log = logWith([emptyFrame([unitAt('u1', { col: 1, row: 5 }, { x: 10, y: 20 })])])
    expect(mirrorFightLogForSeat(log, 0)).toBe(log)
  })

  it('returns the same log object unchanged when the viewer is neither seat (defensive identity, not a throw)', () => {
    const log = logWith([emptyFrame([unitAt('u1', { col: 1, row: 5 }, { x: 10, y: 20 })])])
    expect(() => mirrorFightLogForSeat(log, 4)).not.toThrow()
    expect(mirrorFightLogForSeat(log, 4)).toBe(log)
    // A creep log (seatB === -1) viewed by the human seat is the seatA case.
    const creep: FightLog = { ...logWith([]), seatA: 2, seatB: -1 }
    expect(mirrorFightLogForSeat(creep, 2)).toBe(creep)
  })
})

// ─── Meta swaps ──────────────────────────────────────────────────────────────

describe('mirrorFightLogForSeat — log metadata', () => {
  it('swaps seatA/seatB, survivorStars and quakes for the seatB viewer', () => {
    const log = logWith([])
    const mirrored = mirrorFightLogForSeat(log, 1)
    expect(mirrored.seatA).toBe(1)
    expect(mirrored.seatB).toBe(0)
    expect(mirrored.survivorStarsA).toBe(2)
    expect(mirrored.survivorStarsB).toBe(5)
    expect(mirrored.quakesA).toBe(1)
    expect(mirrored.quakesB).toBe(3)
    expect(mirrored.stage).toBe(log.stage)
    expect(mirrored.ticksElapsed).toBe(log.ticksElapsed)
  })

  it('maps winner player->enemy, enemy->player and draw->draw', () => {
    for (const [recorded, expected] of [
      ['player', 'enemy'], ['enemy', 'player'], ['draw', 'draw'],
    ] as Array<[FightLog['winner'], FightLog['winner']]>) {
      const log: FightLog = { ...logWith([]), winner: recorded }
      expect(mirrorFightLogForSeat(log, 1).winner).toBe(expected)
    }
  })

  it('swaps the per-team tailwind flags and leaves global terrain alone', () => {
    const log = logWith([emptyFrame([])])
    const mirrored = mirrorFightLogForSeat(log, 1)
    expect(mirrored.frames[0].tailwind).toEqual({ player: false, enemy: true })
    expect(mirrored.frames[0].terrain).toEqual(log.frames[0].terrain)
  })
})

// ─── Unit geometry ───────────────────────────────────────────────────────────

describe('mirrorFightLogForSeat — unit geometry', () => {
  it('swaps every team and flips every row to BOARD_ROWS - 1 - row with col untouched', () => {
    const units: UnitFrame[] = [
      { ...unitAt('p', { col: 3, row: 6 }, { x: 0, y: 0 }), team: 'player' },
      { ...unitAt('e', { col: 5, row: 1 }, { x: 0, y: 0 }), team: 'enemy' },
    ]
    const mirrored = mirrorFightLogForSeat(logWith([emptyFrame(units)]), 1)
    const [p, e] = mirrored.frames[0].units
    expect(p.team).toBe('enemy')
    expect(p.hexPos).toEqual({ col: 3, row: BOARD_ROWS - 1 - 6 })
    expect(e.team).toBe('player')
    expect(e.hexPos).toEqual({ col: 5, row: BOARD_ROWS - 1 - 1 })
  })

  it('a unit at rest lands exactly on its mirrored hex anchor, on every hex of the board', () => {
    const units: UnitFrame[] = []
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        units.push(unitAt(`u-${col}-${row}`, { col, row }, hexToPixel({ col, row }, HEX_SIZE)))
      }
    }
    expect(units).toHaveLength(BOARD_COLS * BOARD_ROWS)

    const mirrored = mirrorFightLogForSeat(logWith([emptyFrame(units)]), 1)
    for (const uf of mirrored.frames[0].units) {
      // Exact equality, not a tolerance: the odd-row half-hex stagger means a
      // naive vertical pixel flip would land half a hex off on every other
      // row, and a tolerance would hide exactly that.
      expect(uf.visualPos).toEqual(hexToPixel(uf.hexPos, HEX_SIZE))
    }
  })

  it('a unit mid-move keeps its horizontal offset and has its vertical offset negated', () => {
    const hexPos = { col: 2, row: 5 }
    const anchor = hexToPixel(hexPos, HEX_SIZE)
    const offset = { x: 9, y: -14 }
    const units = [unitAt('m', hexPos, { x: anchor.x + offset.x, y: anchor.y + offset.y })]

    const mirrored = mirrorFightLogForSeat(logWith([emptyFrame(units)]), 1)
    const moved = mirrored.frames[0].units[0]
    const mirroredAnchor = hexToPixel(moved.hexPos, HEX_SIZE)
    expect(moved.visualPos.x - mirroredAnchor.x).toBeCloseTo(offset.x, 9)
    expect(moved.visualPos.y - mirroredAnchor.y).toBeCloseTo(-offset.y, 9)
  })

  it('mirrors in-flight leap endpoints so a dash arc still points the right way', () => {
    const withLeap: UnitFrame = {
      ...unitAt('l', { col: 1, row: 4 }, hexToPixel({ col: 1, row: 4 }, HEX_SIZE)),
      state: 'leaping',
      leap: { sx: 100, sy: 200, ex: 140, ey: 320, tick: 3, total: 10 },
    }
    const mirrored = mirrorFightLogForSeat(logWith([emptyFrame([withLeap])]), 1)
    const leap = mirrored.frames[0].units[0].leap!
    expect(leap.sx).toBe(100)
    expect(leap.ex).toBe(140)
    expect(leap.tick).toBe(3)
    expect(leap.total).toBe(10)
    // Vertical direction inverts: the dash went downward, mirrored it goes up.
    expect(leap.ey - leap.sy).toBeCloseTo(-(320 - 200), 9)
  })

  it('mirrors projectile pixel positions vertically and leaves x alone', () => {
    const frame = emptyFrame([])
    frame.projectiles = [{
      id: 'p1', sourceId: 'u1', targetId: 'u2',
      startPos: { x: 50, y: 100 },
      currentPos: { x: 60, y: 150 },
      targetPos: { x: 70, y: 200 },
      hitRadius: 8,
    }]
    const mirrored = mirrorFightLogForSeat(logWith([frame]), 1)
    const p = mirrored.frames[0].projectiles[0]
    expect(p.startPos.x).toBe(50)
    expect(p.currentPos.x).toBe(60)
    expect(p.targetPos!.x).toBe(70)
    // Reflected about the board's vertical midline: order inverts and the
    // spacing between the three points is preserved.
    expect(p.currentPos.y - p.startPos.y).toBeCloseTo(-50, 9)
    expect(p.targetPos!.y - p.currentPos.y).toBeCloseTo(-50, 9)
    expect(p.startPos.y).not.toBe(100)
  })
})

// ─── Events ──────────────────────────────────────────────────────────────────

describe('mirrorFightLogForSeat — events', () => {
  it('mirrors positional event payloads and leaves ids and numeric damage payloads untouched', () => {
    const events: CombatEvent[] = [
      { type: 'damage', targetId: 't1', amount: 137, damageType: 'magic', isCrit: true, sourceId: 's1' },
      { type: 'vfx', effectId: 'tornado', x: 300, y: 400, dirX: 1, dirY: 1 },
      { type: 'vfx', effectId: 'discharge_row', sourceId: 's1', targetRow: 6 },
      { type: 'vfx', effectId: 'earthquake', team: 'player' },
      { type: 'vfx', effectId: 'aqua_ring_pass', fromX: 10, fromY: 20, toX: 30, toY: 60, toUnitId: 'u9', level: 2 },
      { type: 'vfx', effectId: 'sneasler_dire_claw', sourceId: 's1', hexPositions: [{ x: 5, y: 15 }], angle: 0.75 },
      { type: 'vfx', effectId: 'h_avalugg_avalanche', positions: [{ x: 7, y: 21, unitId: 'u2' }], hoverTicks: 4 },
    ]
    const original = JSON.parse(JSON.stringify(events)) as CombatEvent[]
    const mirrored = mirrorFightLogForSeat(logWith([emptyFrame([], events)]), 1).frames[0].events

    // Damage is pure payload — nothing about it is positional.
    expect(mirrored[0]).toEqual(original[0])

    const tornado = mirrored[1] as Extract<CombatEvent, { effectId: 'tornado' }>
    expect(tornado.x).toBe(300)
    expect(tornado.y).not.toBe(400)
    expect(tornado.dirX).toBe(1)
    expect(tornado.dirY).toBe(-1)

    const discharge = mirrored[2] as Extract<CombatEvent, { effectId: 'discharge_row' }>
    expect(discharge.targetRow).toBe(BOARD_ROWS - 1 - 6)
    expect(discharge.sourceId).toBe('s1')

    const quake = mirrored[3] as Extract<CombatEvent, { effectId: 'earthquake' }>
    expect(quake.team).toBe('enemy')

    const aqua = mirrored[4] as Extract<CombatEvent, { effectId: 'aqua_ring_pass' }>
    expect(aqua.fromX).toBe(10)
    expect(aqua.toX).toBe(30)
    expect(aqua.toUnitId).toBe('u9')
    expect(aqua.level).toBe(2)
    expect(aqua.toY - aqua.fromY).toBeCloseTo(-40, 9)

    const claw = mirrored[5] as Extract<CombatEvent, { effectId: 'sneasler_dire_claw' }>
    expect(claw.hexPositions[0].x).toBe(5)
    expect(claw.hexPositions[0].y).not.toBe(15)
    expect(claw.angle).toBeCloseTo(-0.75, 9)

    const avalanche = mirrored[6] as Extract<CombatEvent, { effectId: 'h_avalugg_avalanche' }>
    expect(avalanche.positions[0].x).toBe(7)
    expect(avalanche.positions[0].unitId).toBe('u2')
    expect(avalanche.hoverTicks).toBe(4)
  })
})

// ─── Presentational invariants, on a real recorded fight ─────────────────────

// Deep equality with one concession: a pixel coordinate may differ by at most
// PIXEL_EPSILON. Reflecting a float about a midline and back is NOT bit-exact
// — `fl(C - fl(C - y))` re-rounds, and measured against a real recorded fight
// the double mirror drifts by at most ~6e-14 px on the y of a mid-move unit
// or an in-flight projectile. That is a thousandth of a millionth of a pixel;
// it is unobservable, and no reformulation of the transform removes it (both
// the anchored form and the single-rounding affine form were measured).
//
// Everything else is compared EXACTLY: strings, booleans, nulls, array
// lengths and key sets. So a team that failed to swap back, a row that
// flipped wrong, a dropped event, a reordered frame or a mutated HP value all
// still fail this assertion — only sub-nanopixel float noise is forgiven.
const PIXEL_EPSILON = 1e-9

function expectInvolution(actual: unknown, expected: unknown, path = 'log'): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Number.isNaN(expected) && Number.isNaN(actual)) return
    expect(Math.abs(actual - expected), `${path}: ${actual} vs ${expected}`)
      .toBeLessThanOrEqual(PIXEL_EPSILON)
    return
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} should be an array`).toBe(true)
    const actualArray = actual as unknown[]
    expect(actualArray.length, `${path}.length`).toBe(expected.length)
    for (let i = 0; i < expected.length; i++) {
      expectInvolution(actualArray[i], expected[i], `${path}[${i}]`)
    }
    return
  }
  if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', `${path} should be an object`).toBe(true)
    const expectedRecord = expected as Record<string, unknown>
    const actualRecord = actual as Record<string, unknown>
    expect(Object.keys(actualRecord).sort(), `${path} key set`).toEqual(Object.keys(expectedRecord).sort())
    for (const key of Object.keys(expectedRecord)) {
      expectInvolution(actualRecord[key], expectedRecord[key], `${path}.${key}`)
    }
    return
  }
  expect(actual, path).toBe(expected)
}

describe('mirrorFightLogForSeat — presentational invariants', () => {
  it('adds, drops and reorders nothing: frame count, every tick, and every events array length and order are unchanged', () => {
    const mirrored = mirrorFightLogForSeat(realLog, realLog.seatB)
    expect(mirrored.frames.length).toBe(realLog.frames.length)
    expect(mirrored.frames.map(f => f.tick)).toEqual(realLog.frames.map(f => f.tick))

    for (let i = 0; i < realLog.frames.length; i++) {
      expect(mirrored.frames[i].events.length).toBe(realLog.frames[i].events.length)
      expect(mirrored.frames[i].units.length).toBe(realLog.frames[i].units.length)
      expect(mirrored.frames[i].events.map(ev => ev.type))
        .toEqual(realLog.frames[i].events.map(ev => ev.type))
      // Unit identity and order preserved, and no recorded HP is touched.
      expect(mirrored.frames[i].units.map(u => u.id))
        .toEqual(realLog.frames[i].units.map(u => u.id))
      expect(mirrored.frames[i].units.map(u => u.currentHp))
        .toEqual(realLog.frames[i].units.map(u => u.currentHp))
    }
  })

  it('is an involution on a real recorded fight: mirroring twice deep-equals the original', () => {
    // Mirroring swaps the seats, so the second application must target the
    // mirrored log's OWN seatB (the original seatA) — re-passing the original
    // seatB would hit the seatA identity branch and prove nothing.
    const once = mirrorFightLogForSeat(realLog, realLog.seatB)
    expect(once.seatB).toBe(realLog.seatA)
    const twice = mirrorFightLogForSeat(once, once.seatB)
    expect(twice.winner).toBe(realLog.winner)
    expect(twice.seatA).toBe(realLog.seatA)
    expect(twice.seatB).toBe(realLog.seatB)
    expectInvolution(twice, realLog)
  })

  it('does not mutate the input log', () => {
    const before = cloneFightLog(realLog)
    const firstUnitBefore = {
      team: realLog.frames[0].units[0].team,
      hexPos: { ...realLog.frames[0].units[0].hexPos },
    }

    mirrorFightLogForSeat(realLog, realLog.seatB)

    expect(realLog.winner).toBe(before.winner)
    expect(realLog.frames[0].units[0].team).toBe(firstUnitBefore.team)
    expect(realLog.frames[0].units[0].hexPos).toEqual(firstUnitBefore.hexPos)
    expect(realLog).toEqual(before)
  })
})
