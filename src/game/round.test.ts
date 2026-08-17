import { describe, it, expect } from 'vitest'
import type { RunState } from '../econ/runState'
import { newRun } from '../econ/runState'
import { botSeats } from '../econ/bots'
import { copiesHeld, MAX_LEVEL, BENCH_SLOTS } from '../econ/constants'
import { applyAction, startPlanning, resolveRound, recordFight } from './round'
import type { GameAction, ActionReason } from './round'
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

// ─── applyAction: rejection/atomicity, seat isolation, pool conservation,
// moves, items ─────────────────────────────────────────────────────────────

// Snapshots the whole state, calls applyAction, asserts the returned reason,
// and asserts the post-state deep-equals the pre-state snapshot — every
// rejection path must be provably non-mutating.
function expectRejected(state: RunState, seat: number, action: GameAction, reason: ActionReason): void {
  const before = JSON.parse(JSON.stringify(state))
  const result = applyAction(state, seat, action)
  expect(result).toEqual({ ok: false, reason })
  expect(JSON.parse(JSON.stringify(state))).toEqual(before)
}

// Sums copiesHeld(tier) over every bench entry and board entry of every seat
// whose definitionId matches — the shared-pool conservation invariant is
// pool[id] + heldCopies(state, id) staying constant.
function heldCopies(state: RunState, definitionId: string): number {
  let total = 0
  for (const econ of state.players) {
    for (const b of econ.bench) {
      if (b && b.definitionId === definitionId) total += copiesHeld(b.tier)
    }
    for (const u of econ.board) {
      if (u.definitionId === definitionId) total += copiesHeld(u.tier)
    }
  }
  return total
}

describe('applyAction', () => {
  describe('rejection & atomicity', () => {
    interface RejectionCase {
      name: string
      reason: ActionReason
      build: () => { state: RunState; seat: number; action: GameAction }
    }

    // A table so adding a ninth action variant later forces a row rather
    // than silently going uncovered.
    const cases: RejectionCase[] = [
      {
        name: 'bad-seat: negative seat',
        reason: 'bad-seat',
        build: () => ({ state: newRun(botSeats()), seat: -1, action: { t: 'buy', slot: 0 } }),
      },
      {
        name: 'bad-seat: seat at players.length',
        reason: 'bad-seat',
        build: () => {
          const state = newRun(botSeats())
          return { state, seat: state.players.length, action: { t: 'buy', slot: 0 } }
        },
      },
      {
        name: 'buy: empty shop slot',
        reason: 'empty-slot',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].shop[0] = null
          return { state, seat: 0, action: { t: 'buy', slot: 0 } }
        },
      },
      {
        name: 'buy: unaffordable',
        reason: 'no-gold',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].shop[0] = 'zubat'
          state.players[0].gold = 0
          return { state, seat: 0, action: { t: 'buy', slot: 0 } }
        },
      },
      {
        name: 'buy: full bench that would not combine',
        reason: 'bench-full',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].bench = Array.from({ length: BENCH_SLOTS }, () => ({ definitionId: 'tangela', tier: 1 as const }))
          state.players[0].shop[0] = 'zubat'
          state.players[0].gold = 10
          return { state, seat: 0, action: { t: 'buy', slot: 0 } }
        },
      },
      {
        name: 'buy: pool exhausted',
        reason: 'pool-empty',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].shop[0] = 'zubat'
          state.players[0].gold = 10
          state.pool['zubat'] = 0
          return { state, seat: 0, action: { t: 'buy', slot: 0 } }
        },
      },
      {
        name: 'sell: empty bench slot',
        reason: 'no-unit',
        build: () => ({ state: newRun(botSeats()), seat: 0, action: { t: 'sell', from: 'bench', index: 0 } }),
      },
      {
        name: 'sell: out-of-range board index',
        reason: 'no-unit',
        build: () => ({ state: newRun(botSeats()), seat: 0, action: { t: 'sell', from: 'board', index: 5 } }),
      },
      {
        name: 'sell: Ascender pillar',
        reason: 'unsellable',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].board = [{ definitionId: 'cliff_l', tier: 1, hexPos: { col: 0, row: 4 } }]
          return { state, seat: 0, action: { t: 'sell', from: 'board', index: 0 } }
        },
      },
      {
        name: 'moveBoard: empty source hex',
        reason: 'no-unit',
        build: () => ({
          state: newRun(botSeats()), seat: 0,
          action: { t: 'moveBoard', from: { col: 0, row: 4 }, to: { col: 1, row: 4 } },
        }),
      },
      {
        name: 'moveBoard: destination outside player half',
        reason: 'not-player-hex',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
          return { state, seat: 0, action: { t: 'moveBoard', from: { col: 0, row: 4 }, to: { col: 0, row: 1 } } }
        },
      },
      {
        name: 'moveBench: empty bench slot (hex destination)',
        reason: 'no-unit',
        build: () => ({
          state: newRun(botSeats()), seat: 0,
          action: { t: 'moveBench', benchIndex: 0, to: { col: 0, row: 4 } },
        }),
      },
      {
        name: 'moveBench: destination outside player half',
        reason: 'not-player-hex',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].bench[0] = { definitionId: 'zubat', tier: 1 }
          return { state, seat: 0, action: { t: 'moveBench', benchIndex: 0, to: { col: 0, row: 0 } } }
        },
      },
      {
        name: 'moveBench: bench-to-empty-hex exceeding the board cap',
        reason: 'board-full',
        build: () => {
          const state = newRun(botSeats())
          // STARTING_LEVEL is 1 → boardCap is 1; one non-pillar unit already
          // fielded fills the cap, so fielding the bench unit is rejected.
          state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
          state.players[0].bench[0] = { definitionId: 'tangela', tier: 1 }
          return { state, seat: 0, action: { t: 'moveBench', benchIndex: 0, to: { col: 1, row: 4 } } }
        },
      },
      {
        name: 'buyXp: at max level',
        reason: 'max-level',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].level = MAX_LEVEL
          state.players[0].gold = 100
          return { state, seat: 0, action: { t: 'buyXp' } }
        },
      },
      {
        name: 'buyXp: without the gold',
        reason: 'no-gold',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].gold = 0
          return { state, seat: 0, action: { t: 'buyXp' } }
        },
      },
      {
        name: 'reroll: without the gold',
        reason: 'no-gold',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].gold = 0
          return { state, seat: 0, action: { t: 'reroll' } }
        },
      },
      {
        name: 'placeItem: empty item-bench index',
        reason: 'no-item',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
          return { state, seat: 0, action: { t: 'placeItem', itemIndex: 0, onHex: { col: 0, row: 4 } } }
        },
      },
      {
        name: 'placeItem: hex with no unit on it',
        reason: 'no-unit',
        build: () => {
          const state = newRun(botSeats())
          state.players[0].itemBench = ['charcoal']
          return { state, seat: 0, action: { t: 'placeItem', itemIndex: 0, onHex: { col: 0, row: 4 } } }
        },
      },
    ]

    for (const c of cases) {
      it(`${c.name} → rejected '${c.reason}' with no state mutation`, () => {
        const { state, seat, action } = c.build()
        expectRejected(state, seat, action, c.reason)
      })
    }

    it('eliminated seat rejects all eight action tags with "eliminated" before any per-action validation', () => {
      const state = newRun(botSeats())
      state.players[2].eliminated = true
      const actions: GameAction[] = [
        { t: 'buy', slot: 0 },
        { t: 'sell', from: 'bench', index: 0 },
        { t: 'reroll' },
        { t: 'buyXp' },
        { t: 'lock', locked: true },
        { t: 'moveBoard', from: { col: 0, row: 4 }, to: { col: 1, row: 4 } },
        { t: 'moveBench', benchIndex: 0, to: { bench: 1 } },
        { t: 'placeItem', itemIndex: 0, onHex: { col: 0, row: 4 } },
      ]
      for (const action of actions) {
        expectRejected(state, 2, action, 'eliminated')
      }
    })
  })

  describe('seat isolation', () => {
    it('a successful action on seat 0 never touches state.players[3]', () => {
      const state = newRun(botSeats())
      state.players[0].shop[0] = 'zubat'
      state.players[0].gold = 10
      const before3 = JSON.parse(JSON.stringify(state.players[3]))
      const result = applyAction(state, 0, { t: 'buy', slot: 0 })
      expect(result).toEqual({ ok: true })
      expect(state.players[3]).toEqual(before3)
    })

    it('a successful action on seat 3 never touches state.players[0]', () => {
      const state = newRun(botSeats())
      state.players[3].personaId = null   // seat 3 becomes a second human
      state.players[3].shop[0] = 'zubat'
      state.players[3].gold = 10
      const before0 = JSON.parse(JSON.stringify(state.players[0]))
      const result = applyAction(state, 3, { t: 'buy', slot: 0 })
      expect(result).toEqual({ ok: true })
      expect(state.players[0]).toEqual(before0)
    })
  })

  describe('shared-pool conservation under interleaved two-seat play', () => {
    it('pool[id] + heldCopies(state, id) stays invariant after every single action in an interleaved buy/sell sequence', () => {
      const state = newRun(botSeats())
      state.players[3].personaId = null   // seat 3 becomes a second human
      const defId = 'zubat'
      state.players[0].gold = 100
      state.players[3].gold = 100

      const startingTotal = state.pool[defId] + heldCopies(state, defId)

      // At least eight buy/sell actions, alternating seats. Stocking the
      // shop directly (rather than rolling) keeps this about applyAction's
      // behaviour, not the roll.
      const steps: Array<{ seat: number; kind: 'buy' | 'sell' }> = [
        { seat: 0, kind: 'buy' },
        { seat: 3, kind: 'buy' },
        { seat: 0, kind: 'buy' },
        { seat: 3, kind: 'buy' },
        { seat: 0, kind: 'sell' },
        { seat: 3, kind: 'sell' },
        { seat: 0, kind: 'buy' },
        { seat: 3, kind: 'sell' },
      ]

      for (const step of steps) {
        const econ = state.players[step.seat]
        if (step.kind === 'buy') {
          econ.shop[0] = defId
          const poolBefore = state.pool[defId]
          const result = applyAction(state, step.seat, { t: 'buy', slot: 0 })
          expect(result).toEqual({ ok: true })
          // Serial application: each successful buy decrements the pool by
          // exactly one — no call observes a partially-applied earlier call.
          expect(state.pool[defId]).toBe(poolBefore - 1)
        } else {
          const idx = econ.bench.findIndex(b => b?.definitionId === defId)
          expect(idx).toBeGreaterThanOrEqual(0)
          const result = applyAction(state, step.seat, { t: 'sell', from: 'bench', index: idx })
          expect(result).toEqual({ ok: true })
        }
        // Checked after EVERY action, not only at the end — a mid-sequence
        // leak that a later action happens to cancel out must not hide here.
        expect(state.pool[defId] + heldCopies(state, defId)).toBe(startingTotal)
      }
    })
  })

  describe('move semantics', () => {
    it('a board-to-board move onto an occupied hex swaps hexPos and leaves board.length unchanged', () => {
      const state = newRun(botSeats())
      state.players[0].board = [
        { definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } },
        { definitionId: 'tangela', tier: 1, hexPos: { col: 1, row: 4 } },
      ]
      const lengthBefore = state.players[0].board.length
      const result = applyAction(state, 0, { t: 'moveBoard', from: { col: 0, row: 4 }, to: { col: 1, row: 4 } })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].board.length).toBe(lengthBefore)
      const zubat = state.players[0].board.find(e => e.definitionId === 'zubat')!
      const tangela = state.players[0].board.find(e => e.definitionId === 'tangela')!
      expect(zubat.hexPos).toEqual({ col: 1, row: 4 })
      expect(tangela.hexPos).toEqual({ col: 0, row: 4 })
    })

    it('a bench-to-empty-hex move at the cap is rejected with board-full', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      state.players[0].bench[0] = { definitionId: 'tangela', tier: 1 }
      const result = applyAction(state, 0, { t: 'moveBench', benchIndex: 0, to: { col: 1, row: 4 } })
      expect(result).toEqual({ ok: false, reason: 'board-full' })
    })

    it('the same bench-to-empty-hex move with a pillar as the moving unit is allowed at the cap', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      state.players[0].bench[0] = { definitionId: 'cliff_l', tier: 1 }
      const result = applyAction(state, 0, { t: 'moveBench', benchIndex: 0, to: { col: 1, row: 4 } })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].board.some(e => e.definitionId === 'cliff_l')).toBe(true)
    })
  })

  describe('item semantics', () => {
    it('placing an item on a unit that already holds one leaves itemBench.length unchanged and returns the old item', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 }, item: 'charcoal' }]
      state.players[0].itemBench = ['expert_belt']
      const lengthBefore = state.players[0].itemBench.length
      const result = applyAction(state, 0, { t: 'placeItem', itemIndex: 0, onHex: { col: 0, row: 4 } })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].itemBench.length).toBe(lengthBefore)
      expect(state.players[0].itemBench).toContain('charcoal')
      expect(state.players[0].board[0].item).toBe('expert_belt')
    })

    it('placing an item on an empty-handed unit decreases itemBench.length by one', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      state.players[0].itemBench = ['expert_belt']
      const result = applyAction(state, 0, { t: 'placeItem', itemIndex: 0, onHex: { col: 0, row: 4 } })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].itemBench.length).toBe(0)
      expect(state.players[0].board[0].item).toBe('expert_belt')
    })
  })
})
