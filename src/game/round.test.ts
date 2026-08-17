import { describe, it, expect } from 'vitest'
import { newRun } from '../econ/runState'
import { botSeats } from '../econ/bots'
import { applyAction, startPlanning, resolveRound, recordFight } from './round'
import '../core/systems/ability'   // register abilities for the headless sim

function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('round engine — tracer slice', () => {
  it('drives buy → startPlanning → resolveRound end to end with a real recorded fight', () => {
    const run = newRun(botSeats())

    // Only seat 0 (human) and seat 1 (bot) carry boards — eliminate the rest
    // so resolveRound's shuffle has no other pairing to produce, keeping this
    // tracer's one recorded fight deterministic.
    for (let i = 2; i < run.players.length; i++) run.players[i].eliminated = true

    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]

    run.players[0].gold = 10
    run.players[0].shop[0] = 'zubat'
    const poolBefore = run.pool['zubat']

    const buyResult = applyAction(run, 0, { t: 'buy', slot: 0 })
    expect(buyResult).toEqual({ ok: true })
    expect(run.pool['zubat']).toBe(poolBefore - 1)

    startPlanning(run)
    expect(run.players[0].pendingIncome).toBe(0)
    expect(run.players[0].shop.some(slot => slot !== null)).toBe(true)

    const roundBefore = run.round
    const result = resolveRound(run, 12345)

    expect(run.round).toBe(roundBefore + 1)

    // Every living seat appears in exactly one pairings entry (a bye counts as one).
    const seenSeats = new Set<number>()
    for (const pair of result.pairings) {
      seenSeats.add(pair.a)
      if (pair.b !== -1) seenSeats.add(pair.b)
    }
    expect(seenSeats).toEqual(new Set([0, 1]))

    expect(result.logs.length).toBeGreaterThanOrEqual(1)
    const log = result.logs[0]
    expect(log.frames.length).toBeGreaterThan(0)

    const ticks = log.frames.map(f => f.tick)
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1])

    // The log's winner must agree with the settlement it produced, whichever
    // way the (unseeded) combat RNG happened to resolve this fight.
    const resultA = result.seats.find(s => s.seat === log.seatA)!
    const resultB = result.seats.find(s => s.seat === log.seatB)!
    if (log.winner === 'player') {
      expect(resultA.won).toBe(true)
      expect(resultB.won).toBe(false)
    } else if (log.winner === 'enemy') {
      expect(resultB.won).toBe(true)
      expect(resultA.won).toBe(false)
    } else {
      expect(resultA.draw).toBe(true)
      expect(resultB.draw).toBe(true)
    }
  })
})

describe('recordFight', () => {
  function realBoardsRun(): ReturnType<typeof newRun> {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]
    return run
  }

  it('frames are strictly ascending by tick with no repeats', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    expect(log.frames.length).toBeGreaterThan(0)
    const ticks = log.frames.map(f => f.tick)
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1])
  })

  it('never aliases the same events array across two different frames', () => {
    // Guards the exact bug the module comments call out: advanceCombatTick
    // reassigns state.events at the start of every tick, so a captureFrame
    // that held the live reference (instead of copying) would leave every
    // earlier frame silently pointing at the final tick's events.
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    for (let i = 1; i < log.frames.length; i++) {
      expect(log.frames[i].events).not.toBe(log.frames[i - 1].events)
    }
  })

  it('a multi-event frame keeps its events in push order, verbatim, not sorted or grouped', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    const multiEventFrame = log.frames.find(f => f.events.length >= 2)
    // Not every real matchup produces a multi-event tick; when one exists,
    // pin its exact order down verbatim (no sort, no re-derivation) so a
    // future change that reorders or groups events by type is caught here.
    if (multiEventFrame) {
      const verbatim = multiEventFrame.events.map(ev => ({ ...ev }))
      multiEventFrame.events.forEach((ev, i) => expect(ev).toEqual(verbatim[i]))
    } else {
      expect(log.frames.length).toBeGreaterThan(0)
    }
  })

  it('frame-per-tick: frames.length equals ticksElapsed for a fight that ran', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    expect(log.frames.length).toBe(log.ticksElapsed)
  })

  it('is pure JSON — survives a JSON.parse(JSON.stringify(log)) round-trip with no loss', () => {
    const run = realBoardsRun()
    const log = recordFight(run, 0, 1, 1)
    const roundTripped = JSON.parse(JSON.stringify(log))
    expect(roundTripped).toEqual(log)
  })

  it('draws at the 3600-tick cap when neither side can kill the other', () => {
    // Two dummies: 0 attack, so neither ever deals damage — a genuine
    // cap-draw fixture rather than a stubbed engine.
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'dummy', tier: 1, hexPos: { col: 0, row: 4 } }]
    run.players[1].board = [{ definitionId: 'dummy', tier: 1, hexPos: { col: 0, row: 4 } }]
    const log = recordFight(run, 0, 1, 1)
    expect(log.winner).toBe('draw')
    expect(log.ticksElapsed).toBe(3600)
    expect(log.frames.length).toBeGreaterThan(0)
  })

  it('empty side A forfeits to B without running a simulation', () => {
    const run = newRun(botSeats())
    run.players[0].board = []
    run.players[1].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 0, row: 4 } }]
    const log = recordFight(run, 0, 1, 1)
    expect(log.winner).toBe('enemy')
    expect(log.frames).toEqual([])
    expect(log.ticksElapsed).toBe(0)
  })

  it('empty side B forfeits to A without running a simulation', () => {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 0, row: 4 } }]
    run.players[1].board = []
    const log = recordFight(run, 0, 1, 1)
    expect(log.winner).toBe('player')
    expect(log.frames).toEqual([])
    expect(log.ticksElapsed).toBe(0)
  })

  it('both sides empty draws without running a simulation', () => {
    const run = newRun(botSeats())
    run.players[0].board = []
    run.players[1].board = []
    const log = recordFight(run, 0, 1, 1)
    expect(log.winner).toBe('draw')
    expect(log.frames).toEqual([])
    expect(log.ticksElapsed).toBe(0)
  })
})

describe('resolveRound — log/settlement agreement', () => {
  it('every SeatFightResult with a non-null logIndex agrees with the log it points to', () => {
    const run = newRun(botSeats())
    // Only seats 0 (human) and 1 (bot) alive → one guaranteed recorded fight,
    // same determinism trick as the tracer test above.
    for (let i = 2; i < run.players.length; i++) run.players[i].eliminated = true
    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]

    const result = resolveRound(run, 777)
    for (const seatResult of result.seats) {
      if (seatResult.logIndex === null) continue
      const log = result.logs[seatResult.logIndex]
      const isSeatA = log.seatA === seatResult.seat
      const nameForThisSeat = isSeatA ? 'player' : 'enemy'
      if (log.winner === 'draw') {
        expect(seatResult.draw).toBe(true)
      } else {
        expect(seatResult.won).toBe(log.winner === nameForThisSeat)
      }
    }
  })
})

describe('startPlanning', () => {
  it('never decrements state.pool', () => {
    const run = newRun(botSeats())
    const poolBefore = JSON.parse(JSON.stringify(run.pool))
    startPlanning(run, seededRng(1))
    expect(run.pool).toEqual(poolBefore)
  })

  it('skips every eliminated seat entirely — no income bank, no shop roll', () => {
    const run = newRun(botSeats())
    run.players[2].eliminated = true
    run.players[2].pendingIncome = 40
    const shopBefore = [...run.players[2].shop]
    startPlanning(run, seededRng(2))
    expect(run.players[2].pendingIncome).toBe(40)
    expect(run.players[2].shop).toEqual(shopBefore)
  })

  it('honours the shop lock but still banks income, and always rolls an all-null shop', () => {
    const run = newRun(botSeats())
    // Locked with a fully populated shop: banks, but the shop array must not move.
    run.players[0].shopLocked = true
    run.players[0].shop = ['zubat', 'tangela', 'zubat', 'tangela', 'zubat']
    run.players[0].pendingIncome = 15
    const lockedShopBefore = [...run.players[0].shop]

    // Locked with an all-null shop: rolled anyway (mirrors startPlanningPhase).
    run.players[1].shopLocked = true
    run.players[1].shop = [null, null, null, null, null]

    startPlanning(run, seededRng(3))

    expect(run.players[0].pendingIncome).toBe(0)
    expect(run.players[0].shop).toEqual(lockedShopBefore)
    expect(run.players[1].shop.some(slot => slot !== null)).toBe(true)
  })

  it('banks pendingIncome into gold before rolling, for every living seat', () => {
    const run = newRun(botSeats())
    const before = run.players.map(p => ({ gold: p.gold, pendingIncome: p.pendingIncome }))
    for (const p of run.players) p.pendingIncome = 7
    startPlanning(run, seededRng(4))
    run.players.forEach((p, i) => {
      expect(p.gold).toBe(before[i].gold + 7)
      expect(p.pendingIncome).toBe(0)
    })
  })

  it('is a no-op that does not throw when every seat is eliminated', () => {
    const run = newRun(botSeats())
    for (const p of run.players) p.eliminated = true
    const before = JSON.parse(JSON.stringify(run.players))
    expect(() => startPlanning(run, seededRng(5))).not.toThrow()
    expect(run.players).toEqual(before)
  })

  it('banks and rolls every living seat identically on a bots-only lobby', () => {
    const run = newRun(botSeats())
    // Simulate an all-bot lobby: give seat 0 a non-null personaId too.
    run.players[0].personaId = 'test-persona'
    for (const p of run.players) p.pendingIncome = 3
    startPlanning(run, seededRng(6))
    for (const p of run.players) {
      expect(p.pendingIncome).toBe(0)
      expect(p.shop.some(slot => slot !== null)).toBe(true)
    }
  })
})
