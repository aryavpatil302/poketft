import { describe, it, expect } from 'vitest'
import { newRun } from '../econ/runState'
import { botSeats } from '../econ/bots'
import { applyAction, startPlanning, resolveRound } from './round'
import '../core/systems/ability'   // register abilities for the headless sim

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
