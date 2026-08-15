import { describe, it, expect } from 'vitest'
import { newRun } from './runState'
import { botSeats } from './bots'
import { boardToSpecs, pickNextOpponent, resolveBotRound, checkGameOver } from './botMatches'
import '../core/systems/ability'   // register abilities for the headless sim

function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('botMatches', () => {
  it('boardToSpecs mirrors rows for the enemy side', () => {
    const run = newRun(botSeats())
    run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 3, row: 4 } }]
    expect(boardToSpecs(run.players[1], false)[0].row).toBe(4)
    expect(boardToSpecs(run.players[1], true)[0].row).toBe(3)
  })

  it('pickNextOpponent avoids immediate rematches and skips the eliminated', () => {
    const run = newRun(botSeats())
    run.nextOpponent = 2
    run.players[3].eliminated = true
    const rng = seededRng(1)
    for (let i = 0; i < 20; i++) {
      const pick = pickNextOpponent(run, rng)
      expect(pick).not.toBe(2)
      expect(pick).not.toBe(3)
      expect(pick).toBeGreaterThan(0)
    }
    // Only one bot left → rematch allowed
    for (const i of [1, 2, 3, 4]) run.players[i].eliminated = true
    run.nextOpponent = 5
    expect(pickNextOpponent(run, rng)).toBe(5)
  })

  it('resolveBotRound settles the human opponent, fights the rest, and plans next round', () => {
    const run = newRun(botSeats())
    run.round = 4
    // Give two bots small boards so a real sim runs
    run.players[2].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 3, row: 4 } }]
    run.players[3].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 3, row: 4 } }]

    const hpBefore = run.players.map(p => p.hp)
    const outcomes = resolveBotRound(run, { botIndex: 1, botWon: false, draw: false, survivorStars: 3 }, seededRng(9))

    // Opponent bot lost to the human → lost HP
    expect(run.players[1].hp).toBeLessThan(hpBefore[1])
    // Two pairings among bots 2,3,4,5 → 2 outcomes
    expect(outcomes).toHaveLength(2)
    // All living bots collected income and planned (gold spent or board formed)
    for (let i = 1; i < 6; i++) {
      const bot = run.players[i]
      expect(bot.eliminated).toBe(false)
      // every bot at least got income (gold or spent it on units)
      const holdings = bot.board.length + bot.bench.filter(Boolean).length
      expect(bot.gold + holdings).toBeGreaterThan(0)
    }
    // Next opponent picked, not an immediate rematch
    expect(run.nextOpponent).toBeGreaterThan(0)
    expect(run.nextOpponent).not.toBe(1)
  })

  it('elimination returns a bot inventory to the pool', () => {
    const run = newRun(botSeats())
    run.round = 20                      // stage 4: heavy hp loss
    // Eliminate the other bots up front so their shopping doesn't re-drain
    // the pool copies we're asserting on
    for (const i of [2, 3, 4, 5]) run.players[i].eliminated = true
    const bot = run.players[1]
    bot.hp = 1
    bot.board = [{ definitionId: 'kingler', tier: 2, hexPos: { col: 3, row: 4 } }]
    run.pool['kingler'] -= 3            // as if he bought them
    const before = run.pool['kingler']

    resolveBotRound(run, { botIndex: 1, botWon: false, draw: false, survivorStars: 5 }, seededRng(3))

    expect(bot.eliminated).toBe(true)
    expect(bot.board).toHaveLength(0)
    expect(run.pool['kingler']).toBe(before + 3)
  })

  it('checkGameOver: loss when human dies, win when all bots die', () => {
    const run = newRun(botSeats())
    expect(checkGameOver(run)).toBeNull()
    run.players[0].eliminated = true
    expect(checkGameOver(run)).toBe('loss')
    run.players[0].eliminated = false
    for (let i = 1; i < 6; i++) run.players[i].eliminated = true
    expect(checkGameOver(run)).toBe('win')
  })
})
