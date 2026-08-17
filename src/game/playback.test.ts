import { describe, it, expect } from 'vitest'
import type { CombatState } from '../core/types'
import { newRun } from '../econ/runState'
import { botSeats } from '../econ/bots'
import { recordFight } from './round'
import type { FightFrame, FightLog } from './round'
import { createPlaybackState, applyFrame, playbackLength, playbackWinner } from './playback'
import '../core/systems/ability'   // register abilities for the headless sim

// zubat (range 4) vs tangela (melee) — the same fixture round.test.ts uses,
// picked here so at least one recorded fight produces a real projectile.
function realBoardsRun(): ReturnType<typeof newRun> {
  const run = newRun(botSeats())
  run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
  run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]
  return run
}

function unitSnapshot(state: CombatState): Array<{ id: string; currentHp: number; hexPos: { col: number; row: number }; state: string }> {
  return [...state.units.values()]
    .map(u => ({ id: u.id, currentHp: u.currentHp, hexPos: { col: u.hexPos.col, row: u.hexPos.row }, state: u.state }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function replayLog(log: FightLog): CombatState {
  const state = createPlaybackState(log)
  for (const frame of log.frames) applyFrame(state, frame)
  return state
}

const EMPTY_TERRAIN = { electric: false, psychic: false, grassy: false, misty: false, sunny: false }
const EMPTY_TAILWIND = { player: false, enemy: false }

function makeUnitFrame(overrides: Partial<FightFrame['units'][number]> & { id: string }): FightFrame['units'][number] {
  return {
    definitionId: 'zubat',
    team: 'player',
    tier: 1,
    hexPos: { col: 0, row: 4 },
    visualPos: { x: 0, y: 0 },
    currentHp: 100,
    maxHp: 450,
    currentMana: 0,
    maxMana: 30,
    state: 'idle',
    items: [],
    ...overrides,
  }
}

// ─── Reconstruction ─────────────────────────────────────────────────────────

describe('createPlaybackState', () => {
  it('returns a drawable empty CombatState for a log with frames', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    const state = createPlaybackState(log)

    expect(state.tick).toBe(0)
    expect(state.phase).toBe('combat')
    expect(state.units.size).toBe(0)
    expect(state.projectiles.size).toBe(0)
    expect(state.events).toEqual([])
    expect(state.stage).toBe(log.stage)
    expect(state.hexOccupancy).toBeInstanceOf(Map)
    expect(state.hexOccupancy.size).toBe(0)
    expect(state.earthquakeCounts).toBeInstanceOf(Map)
    expect(state.spellBuffCounters).toBeInstanceOf(Map)
    expect(state.persistentAoEZones).toEqual([])
    expect(state.terrain).toBeDefined()
    expect(state.tailwind).toBeDefined()
  })

  it('returns a valid drawable state with zero units for an empty (forfeit) log', () => {
    const run = newRun(botSeats())
    run.players[0].board = []
    run.players[1].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 0, row: 4 } }]
    const log = recordFight(run, 0, 1, 1)
    expect(log.frames).toEqual([])

    const state = createPlaybackState(log)
    expect(state.units.size).toBe(0)
    expect(state.tick).toBe(0)
    expect(playbackLength(log)).toBe(0)
  })
})

// ─── Reconciliation (applyFrame bookkeeping) ────────────────────────────────

describe('applyFrame — reconciliation', () => {
  it('creates a unit on first sight and overwrites its recorded fields', () => {
    const frame: FightFrame = {
      tick: 1,
      units: [makeUnitFrame({ id: 'u1', currentHp: 300, hexPos: { col: 2, row: 5 }, state: 'attacking' })],
      projectiles: [],
      events: [],
      terrain: EMPTY_TERRAIN,
      tailwind: EMPTY_TAILWIND,
    }
    const log: FightLog = {
      seatA: 0, seatB: 1, stage: 1, winner: 'player', ticksElapsed: 1,
      survivorStarsA: 1, survivorStarsB: 0, quakesA: 0, quakesB: 0,
      frames: [frame],
    }
    const state = createPlaybackState(log)
    applyFrame(state, frame)

    expect(state.units.size).toBe(1)
    const unit = state.units.get('u1')!
    expect(unit.id).toBe('u1')
    expect(unit.currentHp).toBe(300)
    expect(unit.hexPos).toEqual({ col: 2, row: 5 })
    expect(unit.state).toBe('attacking')
    expect(state.tick).toBe(1)
    expect(state.hexOccupancy.size).toBe(1)
  })

  it('mid-fight arrival: a unit absent from frame 0 exists only after the frame that introduces it', () => {
    // Hand-built: no natural summon fixture is guaranteed available, so this
    // uses a synthetic two-frame FightLog per the plan's fallback.
    const frame0: FightFrame = {
      tick: 1,
      units: [makeUnitFrame({ id: 'u1' })],
      projectiles: [], events: [], terrain: EMPTY_TERRAIN, tailwind: EMPTY_TAILWIND,
    }
    const frame1: FightFrame = {
      tick: 2,
      units: [makeUnitFrame({ id: 'u1' }), makeUnitFrame({ id: 'u2', team: 'enemy', hexPos: { col: 3, row: 2 } })],
      projectiles: [], events: [], terrain: EMPTY_TERRAIN, tailwind: EMPTY_TAILWIND,
    }
    const log: FightLog = {
      seatA: 0, seatB: 1, stage: 1, winner: 'draw', ticksElapsed: 2,
      survivorStarsA: 0, survivorStarsB: 0, quakesA: 0, quakesB: 0,
      frames: [frame0, frame1],
    }

    const state = createPlaybackState(log)
    applyFrame(state, frame0)
    expect(state.units.has('u2')).toBe(false)

    applyFrame(state, frame1)
    expect(state.units.has('u2')).toBe(true)
    expect(state.units.size).toBe(2)
  })

  it('mid-fight departure: a unit omitted from a later frame is removed from units and hexOccupancy', () => {
    const frame0: FightFrame = {
      tick: 1,
      units: [makeUnitFrame({ id: 'u1' }), makeUnitFrame({ id: 'u2', team: 'enemy', hexPos: { col: 3, row: 2 } })],
      projectiles: [], events: [], terrain: EMPTY_TERRAIN, tailwind: EMPTY_TAILWIND,
    }
    const frame1: FightFrame = {
      tick: 2,
      units: [makeUnitFrame({ id: 'u1' })],
      projectiles: [], events: [], terrain: EMPTY_TERRAIN, tailwind: EMPTY_TAILWIND,
    }
    const log: FightLog = {
      seatA: 0, seatB: 1, stage: 1, winner: 'player', ticksElapsed: 2,
      survivorStarsA: 1, survivorStarsB: 0, quakesA: 0, quakesB: 0,
      frames: [frame0, frame1],
    }

    const state = createPlaybackState(log)
    applyFrame(state, frame0)
    expect(state.units.size).toBe(2)
    expect(state.hexOccupancy.size).toBe(2)

    applyFrame(state, frame1)
    expect(state.units.has('u2')).toBe(false)
    expect(state.units.size).toBe(1)
    expect([...state.hexOccupancy.values()]).not.toContain('u2')
    expect(state.hexOccupancy.size).toBe(1)
  })

  it('is idempotent for a fixed frame: applying the same frame twice equals applying it once', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    const midFrame = log.frames[Math.floor(log.frames.length / 2)]

    const stateOnce = createPlaybackState(log)
    applyFrame(stateOnce, midFrame)
    const snapshotOnce = unitSnapshot(stateOnce)

    const stateTwice = createPlaybackState(log)
    applyFrame(stateTwice, midFrame)
    applyFrame(stateTwice, midFrame)
    const snapshotTwice = unitSnapshot(stateTwice)

    expect(snapshotTwice).toEqual(snapshotOnce)
    expect(stateTwice.tick).toBe(stateOnce.tick)
    expect(stateTwice.projectiles.size).toBe(stateOnce.projectiles.size)
  })
})

// ─── Replay fidelity ─────────────────────────────────────────────────────────

describe('replay fidelity', () => {
  it('replaying a real recorded log reproduces the final frame exactly', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    expect(log.frames.length).toBeGreaterThan(0)

    const state = replayLog(log)
    const finalFrame = log.frames[log.frames.length - 1]
    const finalFrameSnapshot = [...finalFrame.units]
      .map(uf => ({ id: uf.id, currentHp: uf.currentHp, hexPos: uf.hexPos, state: uf.state }))
      .sort((a, b) => a.id.localeCompare(b.id))

    expect(unitSnapshot(state)).toEqual(finalFrameSnapshot)
    expect(state.tick).toBe(finalFrame.tick)
  })

  it('winner agreement: the only team with non-dead units is the team log.winner names', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    const state = replayLog(log)

    if (log.winner !== 'draw') {
      const winningTeam = log.winner
      const losingTeam = winningTeam === 'player' ? 'enemy' : 'player'
      const aliveByTeam = new Map<string, boolean>([['player', false], ['enemy', false]])
      for (const u of state.units.values()) {
        if (u.state !== 'dead') aliveByTeam.set(u.team, true)
      }
      expect(aliveByTeam.get(winningTeam)).toBe(true)
      expect(aliveByTeam.get(losingTeam)).toBe(false)
    } else {
      expect(log.winner).toBe('draw')
    }
  })

  it('playbackWinner returns log.winner verbatim without inspecting reconstructed state', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    expect(playbackWinner(log)).toBe(log.winner)
  })

  it('projectiles: a frame with a non-empty projectiles array reconstructs matching entries', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    const frameWithProjectiles = log.frames.find(f => f.projectiles.length > 0)
    expect(frameWithProjectiles).toBeDefined()

    const state = createPlaybackState(log)
    applyFrame(state, frameWithProjectiles!)

    expect(state.projectiles.size).toBe(frameWithProjectiles!.projectiles.length)
    for (const pf of frameWithProjectiles!.projectiles) {
      const proj = state.projectiles.get(pf.id)
      expect(proj).toBeDefined()
      expect(proj!.currentPos).toEqual(pf.currentPos)
      expect(proj!.onHit).toBeUndefined()
      expect(proj!.onTick).toBeUndefined()
    }
  })
})

// ─── Wire survival ───────────────────────────────────────────────────────────

describe('wire survival', () => {
  it('replaying a log that has been through JSON.parse(JSON.stringify(...)) matches the original', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    const wire: FightLog = JSON.parse(JSON.stringify(log))

    const stateFromOriginal = replayLog(log)
    const stateFromWire = replayLog(wire)

    expect(unitSnapshot(stateFromWire)).toEqual(unitSnapshot(stateFromOriginal))
  })
})
