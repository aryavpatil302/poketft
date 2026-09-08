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
    targetId: null,
    attackTimer: 0,
    attackWindupTimer: 0,
    isInWindup: false,
    pendingCrit: false,
    abilityCastTimer: 0,
    attackCount: 0,
    attackModifiers: [],
    shields: [],
    statusEffects: [],
    marks: [],
    dmgDealt: { physical: 0, magic: 0, true: 0 },
    dmgTaken: { physical: 0, magic: 0, true: 0 },
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

// ─── Shiny round-trip ────────────────────────────────────────────────────────

describe('shiny round-trip (record → replay)', () => {
  it('a shiny board entry survives to the replayed live Unit', () => {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 }, isShiny: true }]
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]
    const log = recordFight(run, 0, 1, 1)

    const state = replayLog(log)
    const playerUnit = [...state.units.values()].find(u => u.team === 'player')
    expect(playerUnit).toBeDefined()
    expect(playerUnit!.isShiny).toBe(true)
  })

  it('the recorded UnitFrame carries isShiny independent of replay', () => {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 }, isShiny: true }]
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]
    const log = recordFight(run, 0, 1, 1)

    const playerFrame = log.frames[0].units.find(uf => uf.team === 'player')
    expect(playerFrame).toBeDefined()
    expect(playerFrame!.isShiny).toBe(true)
  })

  it('a non-shiny opponent does not leak isShiny in the same frame', () => {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 }, isShiny: true }]
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]
    const log = recordFight(run, 0, 1, 1)

    const enemyFrame = log.frames[0].units.find(uf => uf.team === 'enemy')
    expect(enemyFrame).toBeDefined()
    expect(enemyFrame!.isShiny).toBe(false)

    const state = replayLog(log)
    const enemyUnit = [...state.units.values()].find(u => u.team === 'enemy')
    expect(enemyUnit).toBeDefined()
    expect(enemyUnit!.isShiny).not.toBe(true)
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

// ─── History independence ────────────────────────────────────────────────────

// The invariant that licenses main.ts's catch-up jump. When a tab is
// backgrounded mid-fight, requestAnimationFrame stops firing and playback
// falls behind by however long the tab was away; on return it JUMPS straight
// to the frame wall-clock says the fight is on rather than replaying the
// thousands of frames it missed. That is only sound because applyFrame is an
// absolute reconcile — it rebuilds the unit set from the frame, overwrites
// every recorded field, clears and rebuilds occupancy, replaces the projectile
// map wholesale, and assigns rather than merges events/terrain/tailwind.
//
// If anyone ever makes applyFrame incremental (accumulating damage, appending
// events, retaining stale occupancy), the jump silently starts landing on a
// WRONG state and two players desync with no error raised anywhere. These
// tests fail loudly at that moment.
describe('history independence (catch-up jump safety)', () => {
  // Deliberately NOT realBoardsRun(): that fixture starts both units already
  // adjacent, so no unit ever changes hex and every occupancy bug hides. Here
  // the melee tangela must walk the length of the board to reach the ranged
  // zubat, so hexPos, occupancy and targeting all genuinely churn mid-fight.
  function movingBoardsRun(): ReturnType<typeof newRun> {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 7 } }]
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 5, row: 7 } }]
    return run
  }

  function stateAtViaReplay(log: FightLog, index: number): CombatState {
    const state = createPlaybackState(log)
    for (let i = 0; i <= index; i++) applyFrame(state, log.frames[i])
    return state
  }

  function stateAtViaJump(log: FightLog, index: number): CombatState {
    const state = createPlaybackState(log)
    applyFrame(state, log.frames[index])   // the skipped frames are never applied
    return state
  }

  // Everything the renderer and the fight's outcome actually read.
  function fullSnapshot(state: CombatState) {
    return {
      tick: state.tick,
      units: unitSnapshot(state),
      occupancy: [...state.hexOccupancy.entries()].sort(),
      projectiles: [...state.projectiles.keys()].sort(),
      terrain: state.terrain,
      tailwind: state.tailwind,
      events: state.events,
    }
  }

  function sampleIndices(log: FightLog): number[] {
    const last = playbackLength(log) - 1
    return [...new Set([0, 1, Math.floor(last / 4), Math.floor(last / 2),
                        Math.floor((last * 3) / 4), last - 1, last])]
      .filter(i => i >= 0 && i <= last)
  }

  it('the fixture really does move units between hexes (guards the tests below)', () => {
    const log = recordFight(movingBoardsRun(), 0, 1, 1)
    const configs = new Set(
      log.frames.map(f => f.units.map(u => `${u.id}@${u.hexPos.col},${u.hexPos.row}`).sort().join('|')),
    )
    expect(configs.size).toBeGreaterThan(1)
  })

  it('jumping straight to a frame lands on the same units as replaying every frame up to it', () => {
    const log = recordFight(movingBoardsRun(), 0, 1, 1)
    const target = Math.floor(playbackLength(log) / 2)

    expect(unitSnapshot(stateAtViaJump(log, target)))
      .toEqual(unitSnapshot(stateAtViaReplay(log, target)))
  })

  it('lands on a byte-identical state at every sampled point across the whole fight', () => {
    const log = recordFight(movingBoardsRun(), 0, 1, 1)

    for (const i of sampleIndices(log)) {
      expect(fullSnapshot(stateAtViaJump(log, i)), `frame ${i}`)
        .toEqual(fullSnapshot(stateAtViaReplay(log, i)))
    }
  })

  it('carries no stale hex occupancy from the frames it skipped', () => {
    const log = recordFight(movingBoardsRun(), 0, 1, 1)

    for (const i of sampleIndices(log)) {
      const jumped = stateAtViaJump(log, i)
      // Exactly one entry per unit in the frame, and every entry points at a
      // unit that is actually standing there right now.
      expect([...jumped.hexOccupancy.entries()].sort())
        .toEqual(log.frames[i].units.map(u => [`${u.hexPos.col},${u.hexPos.row}`, u.id]).sort())
    }
  })

  it('does not leak units that existed only in skipped frames', () => {
    // Summons and crawlers enter and leave mid-fight, so a jump that skipped a
    // summon's entire lifetime must not show it on the landing frame.
    const log = recordFight(movingBoardsRun(), 0, 1, 1)
    const last = playbackLength(log) - 1
    const jumped = stateAtViaJump(log, last)

    expect([...jumped.units.keys()].sort())
      .toEqual(log.frames[last].units.map(u => u.id).sort())
  })
})
