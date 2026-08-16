import { describe, it, expect } from 'vitest'
import { newRun } from './runState'
import { botSeats, econBoardPower } from './bots'
import { boardToSpecs, pickNextOpponent, resolveBotRound, resolveBotCreepRound, checkGameOver, humanTablePower } from './botMatches'
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
      const pick = pickNextOpponent(run, 0, rng)
      expect(pick).not.toBe(2)
      expect(pick).not.toBe(3)
      expect(pick).toBeGreaterThan(0)
    }
    // Only one bot left → rematch allowed
    for (const i of [1, 2, 3, 4]) run.players[i].eliminated = true
    run.nextOpponent = 5
    expect(pickNextOpponent(run, 0, rng)).toBe(5)
  })

  it('pickNextOpponent works for a non-zero local seat', () => {
    const run = newRun(botSeats())
    const rng = seededRng(7)
    for (let i = 0; i < 20; i++) {
      const pick = pickNextOpponent(run, 3, rng)
      expect(pick).not.toBe(3)
      expect(pick).not.toBe(-1)
      expect(run.players[pick].eliminated).toBe(false)
    }
  })

  it('resolveBotRound settles the human opponent, fights the rest, and plans next round', () => {
    const run = newRun(botSeats())
    run.round = 4
    // Give two bots small boards so a real sim runs
    run.players[2].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 3, row: 4 } }]
    run.players[3].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 3, row: 4 } }]

    const hpBefore = run.players.map(p => p.hp)
    const outcomes = resolveBotRound(run, { seat: 0, opponentSeat: 1, opponentWon: false, draw: false, survivorStars: 3 }, seededRng(9))

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

    resolveBotRound(run, { seat: 0, opponentSeat: 1, opponentWon: false, draw: false, survivorStars: 5 }, seededRng(3))

    expect(bot.eliminated).toBe(true)
    expect(bot.board).toHaveLength(0)
    expect(run.pool['kingler']).toBe(before + 3)
  })

  it('checkGameOver: loss when human dies, win when all bots die', () => {
    const run = newRun(botSeats())
    expect(checkGameOver(run, 0)).toBeNull()
    run.players[0].eliminated = true
    expect(checkGameOver(run, 0)).toBe('loss')
    run.players[0].eliminated = false
    for (let i = 1; i < 6; i++) run.players[i].eliminated = true
    expect(checkGameOver(run, 0)).toBe('win')
  })

  // ─── Seat symmetry: degenerate seat counts and ordering stability ──────────

  it('pickNextOpponent never self-pairs and never picks an eliminated seat, for every seat', () => {
    for (let forSeat = 0; forSeat < 6; forSeat++) {
      const run = newRun(botSeats())
      const rng = seededRng(100 + forSeat)
      for (let i = 0; i < 20; i++) {
        const pick = pickNextOpponent(run, forSeat, rng)
        expect(pick).not.toBe(forSeat)
        expect(run.players[pick].eliminated).toBe(false)
      }
    }
  })

  it('pickNextOpponent returns the -1 sentinel and checkGameOver returns win when forSeat is the last seat standing', () => {
    const run = newRun(botSeats())
    for (let i = 1; i < 6; i++) run.players[i].eliminated = true
    const rng = seededRng(5)
    for (let i = 0; i < 5; i++) expect(pickNextOpponent(run, 0, rng)).toBe(-1)
    expect(checkGameOver(run, 0)).toBe('win')
  })

  it('pickNextOpponent returns the only other living seat every call when exactly two seats are alive', () => {
    const run = newRun(botSeats())
    for (const i of [0, 1, 3, 5]) run.players[i].eliminated = true   // seats 2 and 4 remain
    const rngFrom2 = seededRng(11)
    for (let i = 0; i < 20; i++) expect(pickNextOpponent(run, 2, rngFrom2)).toBe(4)
    const rngFrom4 = seededRng(13)
    for (let i = 0; i < 20; i++) expect(pickNextOpponent(run, 4, rngFrom4)).toBe(2)
  })

  it('eliminating seats one at a time never yields a pick that is eliminated', () => {
    const run = newRun(botSeats())
    const rng = seededRng(21)
    const picks = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const eliminateIdx = 1 + Math.floor(i / 8)   // eliminate one more seat every 8 calls
      if (eliminateIdx <= 5) run.players[eliminateIdx].eliminated = true
      const pick = pickNextOpponent(run, 0, rng)
      if (pick === -1) continue
      expect(run.players[pick].eliminated).toBe(false)
      expect(pick).not.toBe(0)
      picks.add(pick)
    }
  })

  it('pickNextOpponent ordering is stable under a fixed seed across structurally identical states', () => {
    const runA = newRun(botSeats())
    const runB = newRun(botSeats())
    runA.players[2].eliminated = true
    runB.players[2].eliminated = true
    const rngA = seededRng(11)
    const rngB = seededRng(11)
    const seqA = Array.from({ length: 10 }, () => pickNextOpponent(runA, 3, rngA))
    const seqB = Array.from({ length: 10 }, () => pickNextOpponent(runB, 3, rngB))
    expect(seqA).toEqual(seqB)
  })

  it('selection is not influenced by board power', () => {
    const run = newRun(botSeats())
    // Seat 1 gets a large board; seat 2 stays empty. Both remain eligible for seat 0.
    run.players[1].board = [
      { definitionId: 'tangela', tier: 3, hexPos: { col: 0, row: 4 } },
      { definitionId: 'zubat', tier: 2, hexPos: { col: 1, row: 4 } },
      { definitionId: 'kingler', tier: 2, hexPos: { col: 2, row: 4 } },
    ]
    for (const i of [3, 4, 5]) run.players[i].eliminated = true
    const rng = seededRng(31)
    const picks = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const pick = pickNextOpponent(run, 0, rng)
      picks.add(pick)
      run.nextOpponent = pick   // mirror real usage so the anti-rematch filter can rotate
    }
    expect(picks.has(1)).toBe(true)   // the large board
    expect(picks.has(2)).toBe(true)   // the empty board
  })

  it('checkGameOver answers correctly for a non-zero seat', () => {
    const run = newRun(botSeats())
    expect(checkGameOver(run, 3)).toBeNull()
    run.players[3].eliminated = true
    expect(checkGameOver(run, 3)).toBe('loss')
    run.players[3].eliminated = false
    for (const i of [0, 1, 2, 4, 5]) run.players[i].eliminated = true
    expect(checkGameOver(run, 3)).toBe('win')
  })

  it('checkGameOver returns loss for every seat when all seats are eliminated simultaneously', () => {
    const run = newRun(botSeats())
    for (const p of run.players) p.eliminated = true
    for (let i = 0; i < run.players.length; i++) {
      expect(checkGameOver(run, i)).toBe('loss')
    }
  })

  // ─── humanTablePower / two-human settlement (Plan 02) ──────────────────────

  it('humanTablePower is parity-exact for a single-human lobby', () => {
    const run = newRun(botSeats())
    run.players[0].board = [
      { definitionId: 'tangela', tier: 2, hexPos: { col: 3, row: 4 } },
      { definitionId: 'zubat', tier: 1, hexPos: { col: 2, row: 4 } },
    ]
    expect(humanTablePower(run)).toBe(econBoardPower(run.players[0]))
  })

  it('humanTablePower is stable across the human seat\'s own elimination', () => {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 3, row: 4 } }]
    const before = humanTablePower(run)
    run.players[0].eliminated = true
    expect(humanTablePower(run)).toBe(before)
  })

  it('humanTablePower with two humans returns the stronger board\'s power', () => {
    const run = newRun(botSeats())
    run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 2, row: 4 } }]
    run.players[3].personaId = null   // seat 3 becomes a second human
    run.players[3].board = [
      { definitionId: 'tangela', tier: 3, hexPos: { col: 3, row: 4 } },
      { definitionId: 'kingler', tier: 2, hexPos: { col: 1, row: 4 } },
    ]
    expect(humanTablePower(run)).toBe(econBoardPower(run.players[3]))
  })

  it('humanTablePower with no human seats returns 0', () => {
    const run = newRun(botSeats())
    for (const p of run.players) p.personaId = 'some-persona'
    expect(humanTablePower(run)).toBe(0)
  })

  it('two humans settle symmetrically: neither live seat is double-settled, and the abstract path covers everyone else', () => {
    const run = newRun(botSeats())
    run.players[3].personaId = null   // seat 3 becomes a second human
    const before0 = { gold: run.players[0].gold, hp: run.players[0].hp }

    const outcomes = resolveBotRound(
      run,
      { seat: 0, opponentSeat: 1, opponentWon: false, draw: false, survivorStars: 2 },
      seededRng(17),
    )

    // Seat 0 (the live seat) is untouched by resolveBotRound — main.ts settles it separately.
    expect(run.players[0].gold).toBe(before0.gold)
    expect(run.players[0].hp).toBe(before0.hp)
    // Seat 1 (the live opponent) was settled once in step 1 — it must never appear
    // in an abstract-pairing outcome (that would double-settle it).
    for (const o of outcomes) {
      expect(o.aIndex).not.toBe(1)
      expect(o.bIndex).not.toBe(1)
    }
    // Seats 2, 3, 4, 5 go through the abstract path: 4 seats -> 2 pairs -> 2 outcomes.
    expect(outcomes).toHaveLength(2)
    const involved = new Set(outcomes.flatMap(o => [o.aIndex, o.bIndex]))
    expect(involved).toEqual(new Set([2, 3, 4, 5]))
    for (const o of outcomes) expect(o.aIndex).not.toBe(o.bIndex)
  })

  it('eliminating seats before resolveBotRound yields strictly fewer abstract pairings', () => {
    const runA = newRun(botSeats())
    const outcomesA = resolveBotRound(
      runA,
      { seat: 0, opponentSeat: 1, opponentWon: false, draw: false, survivorStars: 1 },
      seededRng(23),
    )

    const runB = newRun(botSeats())
    runB.players[4].eliminated = true
    runB.players[5].eliminated = true
    const outcomesB = resolveBotRound(
      runB,
      { seat: 0, opponentSeat: 1, opponentWon: false, draw: false, survivorStars: 1 },
      seededRng(23),
    )

    expect(outcomesB.length).toBeLessThan(outcomesA.length)
  })

  it('resolveBotCreepRound for a non-zero human seat sets nextOpponent to a valid living seat', () => {
    const run = newRun(botSeats())
    run.players[3].personaId = null   // seat 3 becomes a second human
    resolveBotCreepRound(run, 3, seededRng(5))
    expect(run.nextOpponent).not.toBe(3)
    expect(run.players[run.nextOpponent].eliminated).toBe(false)
  })
})
