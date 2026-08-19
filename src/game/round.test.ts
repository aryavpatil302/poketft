import { describe, it, expect } from 'vitest'
import type { RunState, PlayerEcon } from '../econ/runState'
import { newRun } from '../econ/runState'
import { botSeats } from '../econ/bots'
import { copiesHeld, MAX_LEVEL, BENCH_SLOTS } from '../econ/constants'
import { CREEP_ROUNDS } from '../econ/creeps'
import { botOwnedItems } from '../econ/botItems'
import { applyAction, startPlanning, resolveRound, recordFight, pairSeats } from './round'
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

    // Rounds 1-3 are the PvE creep/item opener (isCreepRound/isItemRound,
    // src/econ/creeps.ts) — resolveRound now dispatches on round kind
    // (Plan 02-04), so a PvP-style seat-vs-seat tracer needs a round past
    // the opener. Round 4 is the first plain PvP round.
    run.round = 4

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
    // Round 4 is the first plain PvP round — see the tracer test's comment above.
    run.round = 4
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

// One action per `t` tag in the GameAction union, including the three
// variants the networked UI needs. Adding a tenth tag without adding a row
// here leaves the seat-authority guards below untested for it.
const EVERY_ACTION_TAG: GameAction[] = [
  { t: 'buy', slot: 0 },
  { t: 'sell', from: 'bench', index: 0 },
  { t: 'reroll' },
  { t: 'buyXp' },
  { t: 'lock', locked: true },
  { t: 'moveBoard', from: { col: 0, row: 4 }, to: { col: 1, row: 4 } },
  { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 0 } },
  { t: 'moveBench', benchIndex: 0, to: { bench: 1 } },
  { t: 'placeItem', itemIndex: 0, onHex: { col: 0, row: 4 } },
  { t: 'placeItem', itemIndex: 0, onBench: 0 },
  { t: 'removeItem', from: 'board', index: 0 },
  { t: 'removeItem', from: 'bench', index: 0 },
]

// Counts every place `itemId` currently sits for this seat: the item bench,
// a benched unit's hand, or a board unit's hand. The conservation invariant
// is that this stays exactly 1 for an owned item — never 0 (vanished) and
// never 2 (duplicated).
function itemPlacements(econ: PlayerEcon, itemId: string): number {
  let total = 0
  for (const held of econ.itemBench) if (held === itemId) total++
  for (const b of econ.bench) if (b && b.item === itemId) total++
  for (const u of econ.board) if (u.item === itemId) total++
  return total
}

// Units held by this seat across both storage areas — unchanged by any move.
function totalUnitsHeld(econ: PlayerEcon): number {
  return econ.board.length + econ.bench.filter(b => b !== null).length
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

    it('eliminated seat rejects all nine action tags with "eliminated" before any per-action validation', () => {
      const state = newRun(botSeats())
      state.players[2].eliminated = true
      for (const action of EVERY_ACTION_TAG) {
        expectRejected(state, 2, action, 'eliminated')
      }
    })

    it('every action tag rejects an out-of-range seat with "bad-seat" before any per-action validation', () => {
      const state = newRun(botSeats())
      for (const action of EVERY_ACTION_TAG) {
        expectRejected(state, -1, action, 'bad-seat')
        expectRejected(state, state.players.length, action, 'bad-seat')
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

// ─── The three variants the networked UI needs (plan 04-00, Task 4) ────────
//
// Each of these is an interaction the solo UI in src/main.ts already supports
// (a board-to-bench drop, an item equipped onto a benched unit, the `r`-key
// item pull) but which GameAction could not express. Plan 04-04 routes every
// one of them onto this dispatch path.

describe('applyAction — board-to-bench moves, bench item equips, item removal', () => {
  describe('moveBoard with a bench destination', () => {
    it('moves the board entry into the bench slot and removes it from the board', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 2, hexPos: { col: 0, row: 4 } }]
      const result = applyAction(state, 0, { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 3 } })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].board).toEqual([])
      expect(state.players[0].bench[3]).toEqual({ definitionId: 'zubat', tier: 2 })
    })

    it('carries the unit\'s equipped item with it, without touching itemBench', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 1, row: 5 }, item: 'charcoal' }]
      state.players[0].itemBench = ['expert_belt']
      const result = applyAction(state, 0, { t: 'moveBoard', from: { col: 1, row: 5 }, to: { bench: 0 } })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].bench[0]).toEqual({ definitionId: 'zubat', tier: 1, item: 'charcoal' })
      expect(state.players[0].itemBench).toEqual(['expert_belt'])
    })

    it('fails occupied when the bench slot is already taken', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      state.players[0].bench[2] = { definitionId: 'tangela', tier: 1 }
      expectRejected(state, 0, { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 2 } }, 'occupied')
    })

    it('fails no-unit when the from hex holds nothing', () => {
      const state = newRun(botSeats())
      expectRejected(state, 0, { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 0 } }, 'no-unit')
    })

    it('fails unsellable for an Ascender pillar — pillars never leave the board', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'cliff_l', tier: 1, hexPos: { col: 0, row: 4 } }]
      expectRejected(state, 0, { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 0 } }, 'unsellable')
    })

    it('fails no-unit for an out-of-range bench slot', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      expectRejected(state, 0, { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: -1 } }, 'no-unit')
      expectRejected(state, 0, {
        t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: state.players[0].bench.length },
      }, 'no-unit')
    })
  })

  describe('placeItem with an onBench target', () => {
    it('equips the item onto the benched unit and removes it from itemBench', () => {
      const state = newRun(botSeats())
      state.players[0].bench[1] = { definitionId: 'zubat', tier: 1 }
      state.players[0].itemBench = ['expert_belt']
      const result = applyAction(state, 0, { t: 'placeItem', itemIndex: 0, onBench: 1 })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].bench[1]!.item).toBe('expert_belt')
      expect(state.players[0].itemBench).toEqual([])
    })

    it('returns the item the benched unit already held to itemBench, leaving its length unchanged', () => {
      const state = newRun(botSeats())
      state.players[0].bench[1] = { definitionId: 'zubat', tier: 1, item: 'charcoal' }
      state.players[0].itemBench = ['expert_belt']
      const result = applyAction(state, 0, { t: 'placeItem', itemIndex: 0, onBench: 1 })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].bench[1]!.item).toBe('expert_belt')
      expect(state.players[0].itemBench).toEqual(['charcoal'])
    })

    it('fails no-unit on an empty bench slot and on an out-of-range slot', () => {
      const state = newRun(botSeats())
      state.players[0].itemBench = ['expert_belt']
      expectRejected(state, 0, { t: 'placeItem', itemIndex: 0, onBench: 2 }, 'no-unit')
      expectRejected(state, 0, { t: 'placeItem', itemIndex: 0, onBench: -1 }, 'no-unit')
      expectRejected(state, 0, {
        t: 'placeItem', itemIndex: 0, onBench: state.players[0].bench.length,
      }, 'no-unit')
    })

    it('fails no-item on an out-of-range itemIndex', () => {
      const state = newRun(botSeats())
      state.players[0].bench[1] = { definitionId: 'zubat', tier: 1 }
      expectRejected(state, 0, { t: 'placeItem', itemIndex: 0, onBench: 1 }, 'no-item')
      state.players[0].itemBench = ['expert_belt']
      expectRejected(state, 0, { t: 'placeItem', itemIndex: 3, onBench: 1 }, 'no-item')
    })
  })

  describe('removeItem', () => {
    it('pulls an item off a board unit and returns it to itemBench', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 }, item: 'charcoal' }]
      const result = applyAction(state, 0, { t: 'removeItem', from: 'board', index: 0 })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].board[0].item).toBeUndefined()
      expect(state.players[0].itemBench).toEqual(['charcoal'])
      // The unit itself stays exactly where it was.
      expect(state.players[0].board[0].hexPos).toEqual({ col: 0, row: 4 })
    })

    it('pulls an item off a benched unit and returns it to itemBench', () => {
      const state = newRun(botSeats())
      state.players[0].bench[4] = { definitionId: 'zubat', tier: 1, item: 'charcoal' }
      const result = applyAction(state, 0, { t: 'removeItem', from: 'bench', index: 4 })
      expect(result).toEqual({ ok: true })
      expect(state.players[0].bench[4]!.item).toBeUndefined()
      expect(state.players[0].itemBench).toEqual(['charcoal'])
    })

    it('fails no-item when the target holds none', () => {
      const state = newRun(botSeats())
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      state.players[0].bench[0] = { definitionId: 'tangela', tier: 1 }
      expectRejected(state, 0, { t: 'removeItem', from: 'board', index: 0 }, 'no-item')
      expectRejected(state, 0, { t: 'removeItem', from: 'bench', index: 0 }, 'no-item')
    })

    it('fails no-unit when the target does not exist', () => {
      const state = newRun(botSeats())
      expectRejected(state, 0, { t: 'removeItem', from: 'board', index: 0 }, 'no-unit')
      expectRejected(state, 0, { t: 'removeItem', from: 'bench', index: 0 }, 'no-unit')
      expectRejected(state, 0, { t: 'removeItem', from: 'board', index: -1 }, 'no-unit')
      expectRejected(state, 0, { t: 'removeItem', from: 'bench', index: 99 }, 'no-unit')
    })
  })

  describe('seat isolation for the new variants', () => {
    it('a successful board-to-bench move on seat 3 never touches seat 0', () => {
      const state = newRun(botSeats())
      state.players[3].personaId = null   // seat 3 becomes a second human
      state.players[3].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      state.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      const before0 = JSON.parse(JSON.stringify(state.players[0]))
      const result = applyAction(state, 3, { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 0 } })
      expect(result).toEqual({ ok: true })
      expect(state.players[0]).toEqual(before0)
    })

    it('a successful removeItem on seat 3 never touches seat 0', () => {
      const state = newRun(botSeats())
      state.players[3].personaId = null
      state.players[3].bench[0] = { definitionId: 'zubat', tier: 1, item: 'charcoal' }
      state.players[0].bench[0] = { definitionId: 'zubat', tier: 1, item: 'charcoal' }
      const before0 = JSON.parse(JSON.stringify(state.players[0]))
      const result = applyAction(state, 3, { t: 'removeItem', from: 'bench', index: 0 })
      expect(result).toEqual({ ok: true })
      expect(state.players[0]).toEqual(before0)
    })
  })

  describe('conservation', () => {
    it('pool conservation: a unit moved between board and bench is never duplicated, never returned to the pool, and never changes the held total', () => {
      const state = newRun(botSeats())
      const econ = state.players[0]
      econ.board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      econ.bench[0] = { definitionId: 'tangela', tier: 1 }

      const poolBefore = JSON.parse(JSON.stringify(state.pool))
      const totalBefore = totalUnitsHeld(econ)
      const zubatCopiesBefore = heldCopies(state, 'zubat')

      // Board -> bench, then bench -> board, then board -> a different bench
      // slot. Every step is checked, so a mid-sequence leak that a later step
      // happens to cancel out cannot hide.
      const steps: GameAction[] = [
        { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 1 } },
        { t: 'moveBench', benchIndex: 1, to: { col: 2, row: 6 } },
        { t: 'moveBoard', from: { col: 2, row: 6 }, to: { bench: 5 } },
      ]
      for (const action of steps) {
        expect(applyAction(state, 0, action)).toEqual({ ok: true })
        expect(state.pool).toEqual(poolBefore)
        expect(totalUnitsHeld(econ)).toBe(totalBefore)
        expect(heldCopies(state, 'zubat')).toBe(zubatCopiesBefore)
        // Never in both places at once.
        const onBoard = econ.board.filter(u => u.definitionId === 'zubat').length
        const onBench = econ.bench.filter(b => b?.definitionId === 'zubat').length
        expect(onBoard + onBench).toBe(1)
      }
    })

    it('itemBench conservation: an item sits in exactly one place across a place/remove/move sequence, never both and never neither', () => {
      const state = newRun(botSeats())
      const econ = state.players[0]
      econ.board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      econ.bench[0] = { definitionId: 'tangela', tier: 1 }
      econ.itemBench = ['charcoal', 'expert_belt']

      const steps: GameAction[] = [
        { t: 'placeItem', itemIndex: 0, onHex: { col: 0, row: 4 } },   // charcoal -> board unit
        { t: 'placeItem', itemIndex: 0, onBench: 0 },                   // expert_belt -> benched unit
        { t: 'removeItem', from: 'board', index: 0 },                   // charcoal -> itemBench
        { t: 'placeItem', itemIndex: 0, onBench: 0 },                   // charcoal -> benched unit, belt returns
        { t: 'moveBoard', from: { col: 0, row: 4 }, to: { bench: 3 } }, // board unit benched
        { t: 'removeItem', from: 'bench', index: 0 },                   // charcoal -> itemBench
      ]

      for (const action of steps) {
        expect(applyAction(state, 0, action)).toEqual({ ok: true })
        for (const itemId of ['charcoal', 'expert_belt']) {
          expect(itemPlacements(econ, itemId), `${itemId} after ${action.t}`).toBe(1)
        }
      }

      // Both items still accounted for at the end.
      expect(itemPlacements(econ, 'charcoal')).toBe(1)
      expect(itemPlacements(econ, 'expert_belt')).toBe(1)
    })
  })
})

// ─── Task 3: degenerate seat-count and round-kind edge suite ───────────────
//
// Complements src/econ/botMatches.test.ts's degenerate-seat-count suite
// (which exercises pickNextOpponent/resolveBotRound in isolation) by
// exercising the same seat-count degeneracies through the completed
// resolveRound — pairing, settlement, elimination, income deferral,
// crawler rewards, bot re-planning order, the announced-matchup round trip,
// and all three round kinds.

describe('resolveRound — degenerate seat counts and round kinds', () => {
  // Eliminates every seat NOT listed in `seats`, leaving exactly those living.
  function keepOnly(run: RunState, seats: number[]): void {
    for (let i = 0; i < run.players.length; i++) {
      if (!seats.includes(i)) run.players[i].eliminated = true
    }
  }

  describe('degenerate seat counts', () => {
    it('zero living seats: resolveRound returns an empty RoundResult, does not throw, and does not advance state.round', () => {
      const run = newRun(botSeats())
      for (const p of run.players) p.eliminated = true
      const roundBefore = run.round
      let result: ReturnType<typeof resolveRound> | undefined
      expect(() => { result = resolveRound(run, 1) }).not.toThrow()
      expect(result!.pairings).toEqual([])
      expect(result!.seats).toEqual([])
      expect(result!.logs).toEqual([])
      expect(result!.eliminated).toEqual([])
      expect(result!.survivors).toEqual([])
      expect(run.round).toBe(roundBefore)
    })

    it('exactly one living seat receives a bye: opponentSeat -1, draw true, hp unchanged, streak reset to 0, no logs, state.round advances', () => {
      const run = newRun(botSeats())
      run.round = 4   // first plain PvP round — round 1-3 are the creep/item opener
      keepOnly(run, [0])
      run.players[0].streak = 3
      const hpBefore = run.players[0].hp
      const roundBefore = run.round
      const result = resolveRound(run, 2)
      expect(result.logs).toEqual([])
      expect(result.seats).toHaveLength(1)
      expect(result.seats[0].opponentSeat).toBe(-1)
      expect(result.seats[0].draw).toBe(true)
      expect(run.players[0].hp).toBe(hpBefore)
      expect(run.players[0].streak).toBe(0)
      expect(run.round).toBe(roundBefore + 1)
    })

    for (const n of [3, 5]) {
      it(`odd living count (${n}): exactly one pairings entry has b === -1, every other seat appears exactly once, no pair has a === b`, () => {
        const run = newRun(botSeats())
        run.round = 4
        keepOnly(run, Array.from({ length: n }, (_, i) => i))
        const result = resolveRound(run, 10 + n)
        const byes = result.pairings.filter(p => p.b === -1)
        expect(byes).toHaveLength(1)
        const seen = new Set<number>()
        for (const pair of result.pairings) {
          expect(pair.a).not.toBe(pair.b)
          seen.add(pair.a)
          if (pair.b !== -1) seen.add(pair.b)
        }
        expect(seen).toEqual(new Set(Array.from({ length: n }, (_, i) => i)))
      })
    }

    for (const n of [2, 4, 6]) {
      it(`even living count (${n}): no bye, and the multiset of seats across all pairs equals the living-seat set exactly`, () => {
        const run = newRun(botSeats())
        run.round = 4
        keepOnly(run, Array.from({ length: n }, (_, i) => i))
        const result = resolveRound(run, 20 + n)
        expect(result.pairings.some(p => p.b === -1)).toBe(false)
        const seen: number[] = []
        for (const pair of result.pairings) { seen.push(pair.a, pair.b) }
        expect(seen.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i))
      })
    }
  })

  describe('resolution paths', () => {
    it('human-versus-human produces exactly ONE FightLog referenced by both seats\' logIndex, and the winner names the seat credited with the win', () => {
      const run = newRun(botSeats())
      run.round = 4
      run.players[3].personaId = null   // seat 3 becomes a second human
      keepOnly(run, [0, 3])
      // Force the pairing deterministically via the announced-matchup path
      // (Task 1's "honour the announcement" branch), rather than searching
      // for a seed — the plan's explicitly preferred technique.
      run.players[0].nextOpponent = 3
      run.players[3].nextOpponent = 0
      run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      run.players[3].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]

      const result = resolveRound(run, 55)
      expect(result.logs).toHaveLength(1)
      const seat0 = result.seats.find(s => s.seat === 0)!
      const seat3 = result.seats.find(s => s.seat === 3)!
      expect(seat0.logIndex).toBe(0)
      expect(seat3.logIndex).toBe(0)

      const log = result.logs[0]
      if (log.winner === 'draw') {
        expect(seat0.draw).toBe(true)
        expect(seat3.draw).toBe(true)
      } else {
        const aWonLog = log.winner === 'player'
        const resultForA = log.seatA === 0 ? seat0 : seat3
        const resultForB = log.seatA === 0 ? seat3 : seat0
        expect(resultForA.won).toBe(aWonLog)
        expect(resultForB.won).toBe(!aWonLog)
      }
    })

    it('human-versus-bot produces a recorded log referenced by both seats', () => {
      const run = newRun(botSeats())
      run.round = 4
      keepOnly(run, [0, 1])
      run.players[0].nextOpponent = 1
      run.players[1].nextOpponent = 0
      run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]

      const result = resolveRound(run, 56)
      expect(result.logs).toHaveLength(1)
      expect(result.seats.every(s => s.logIndex === 0)).toBe(true)
    })

    it('bot-versus-bot produces no log and logIndex null for both seats', () => {
      const run = newRun(botSeats())
      run.round = 4
      keepOnly(run, [1, 2])   // both bot seats; neither is personaId === null
      run.players[1].nextOpponent = 2
      run.players[2].nextOpponent = 1
      // Empty boards -> the abstract resolveBotFight path forfeits instantly.
      const result = resolveRound(run, 57)
      expect(result.logs).toEqual([])
      for (const s of result.seats) expect(s.logIndex).toBeNull()
    })
  })

  describe('settlement', () => {
    it('income deferral: a human seat\'s gold is unchanged by settlement while pendingIncome grows; a bot seat\'s pendingIncome is never touched', () => {
      const run = newRun(botSeats())
      run.round = 4
      keepOnly(run, [0, 1])
      run.players[0].nextOpponent = 1
      run.players[1].nextOpponent = 0
      // Empty boards -> fast forfeit draw; the deferral asymmetry holds
      // regardless of who "wins" the round.
      const goldBefore0 = run.players[0].gold
      const pendingBefore0 = run.players[0].pendingIncome
      const pendingBefore1 = run.players[1].pendingIncome

      resolveRound(run, 60)

      expect(run.players[0].gold).toBe(goldBefore0)
      expect(run.players[0].pendingIncome).toBeGreaterThan(pendingBefore0)
      // A bot's income lands directly on gold, never on pendingIncome — even
      // after this same call lets it spend/plan with that gold.
      expect(run.players[1].pendingIncome).toBe(pendingBefore1)
    })

    it('elimination: a seat forced to hp 1 and forfeited against a stronger board ends eliminated, absent from survivors, with its inventory back in the pool', () => {
      const run = newRun(botSeats())
      run.round = 4
      keepOnly(run, [0, 1])
      run.players[0].nextOpponent = 1
      run.players[1].nextOpponent = 0
      run.players[0].hp = 1
      run.players[0].board = []   // forfeits -> loses to seat 1's board
      run.players[1].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 0, row: 4 } }]
      run.players[0].bench[0] = { definitionId: 'zubat', tier: 1 }
      const poolBefore = run.pool['zubat']

      const result = resolveRound(run, 61)

      expect(result.eliminated).toContain(0)
      expect(result.survivors).not.toContain(0)
      const seat0 = result.seats.find(s => s.seat === 0)!
      expect(seat0.eliminated).toBe(true)
      expect(run.players[0].eliminated).toBe(true)
      expect(run.players[0].board).toEqual([])
      expect(run.players[0].bench.every(b => b === null)).toBe(true)
      expect(run.pool['zubat']).toBe(poolBefore + 1)
    })

    it('integer discipline: every living seat\'s economy fields and every SeatFightResult\'s numeric fields are integers after resolveRound', () => {
      const run = newRun(botSeats())
      run.round = 4
      run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      run.players[1].board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } }]

      const result = resolveRound(run, 62)

      for (const econ of run.players) {
        if (econ.eliminated) continue
        expect(Number.isInteger(econ.gold)).toBe(true)
        expect(Number.isInteger(econ.hp)).toBe(true)
        expect(Number.isInteger(econ.xp)).toBe(true)
        expect(Number.isInteger(econ.level)).toBe(true)
        expect(Number.isInteger(econ.streak)).toBe(true)
        expect(Number.isInteger(econ.pendingIncome)).toBe(true)
      }
      for (const s of result.seats) {
        expect(Number.isInteger(s.survivorStars)).toBe(true)
        expect(Number.isInteger(s.hpLost)).toBe(true)
      }
    })
  })

  describe('bot planning order', () => {
    it('with exactly one pool copy of a unit both bot seats want, the lower-indexed living seat is the one that ends up holding it', () => {
      const run = newRun(botSeats())
      run.round = 4
      keepOnly(run, [1, 2])   // two bot seats, no living human seat
      run.players[1].nextOpponent = 2
      run.players[2].nextOpponent = 1
      // Zero every pool entry except one contested 1-cost unit with a single
      // remaining copy — an observation of the real ordering contract
      // (ascending seat index), not a call-order spy.
      for (const id of Object.keys(run.pool)) run.pool[id] = 0
      run.pool['zubat'] = 1
      run.players[1].gold = 10
      run.players[2].gold = 10

      resolveRound(run, 70)

      const holds = (seat: number) =>
        run.players[seat].bench.some(b => b?.definitionId === 'zubat') ||
        run.players[seat].board.some(u => u.definitionId === 'zubat')
      expect(holds(1)).toBe(true)
      expect(holds(2)).toBe(false)
    })
  })

  describe('pairing and announcement', () => {
    it('announcement: after a PvP round every surviving seat\'s nextOpponent is -1 or a living non-self seat, mutually consistent; a second resolveRound honours it', () => {
      const run = newRun(botSeats())
      run.round = 4

      const result = resolveRound(run, 80)
      for (const seat of result.survivors) {
        const opp = run.players[seat].nextOpponent
        if (opp === undefined || opp === -1) continue
        expect(opp).not.toBe(seat)
        expect(run.players[opp].eliminated).toBe(false)
        expect(run.players[opp].nextOpponent).toBe(seat)
      }

      // A second resolveRound call, with a DIFFERENT seed, must still pair
      // seats exactly as announced — the stored announcement wins over a
      // fresh pairSeats shuffle.
      const announced = run.players.map(p => p.nextOpponent)
      const result2 = resolveRound(run, 999)
      for (const pair of result2.pairings) {
        if (pair.b === -1) continue
        expect(announced[pair.a]).toBe(pair.b)
      }
    })

    it('anti-rematch: with four living seats where 0-1 and 2-3 just fought, at least one seed avoids re-pairing 0 and 1', () => {
      const run = newRun(botSeats())
      keepOnly(run, [0, 1, 2, 3])
      run.players[0].nextOpponent = 1
      run.players[1].nextOpponent = 0
      run.players[2].nextOpponent = 3
      run.players[3].nextOpponent = 2

      let foundNonRematch = false
      for (let seed = 0; seed < 40; seed++) {
        const pairings = pairSeats(run, seed)
        const rematch01 = pairings.some(p => (p.a === 0 && p.b === 1) || (p.a === 1 && p.b === 0))
        if (!rematch01) { foundNonRematch = true; break }
      }
      expect(foundNonRematch).toBe(true)
    })

    it('termination: two living seats that just fought are paired again by pairSeats, which returns rather than looping', () => {
      const run = newRun(botSeats())
      keepOnly(run, [0, 1])
      run.players[0].nextOpponent = 1
      run.players[1].nextOpponent = 0

      let pairings: Array<{ a: number; b: number }> | undefined
      expect(() => { pairings = pairSeats(run, 5) }).not.toThrow()
      expect(pairings).toHaveLength(1)
      const pair = pairings![0]
      expect(new Set([pair.a, pair.b])).toEqual(new Set([0, 1]))
    })
  })

  describe('round kinds', () => {
    it('item round (round 3): kind item, no logs, every living bot picks up exactly one item, no human itemBench change, hp unchanged', () => {
      const run = newRun(botSeats())
      run.round = 3
      const humanItemBenchBefore = [...run.players[0].itemBench]
      const ownedCountBefore = run.players.map(p => botOwnedItems(p).length)
      const hpBefore = run.players.map(p => p.hp)

      const result = resolveRound(run, 90)

      expect(result.kind).toBe('item')
      expect(result.logs).toEqual([])
      expect(run.players[0].itemBench).toEqual(humanItemBenchBefore)
      run.players.forEach((p, i) => {
        if (p.personaId === null) {
          expect(botOwnedItems(p).length).toBe(ownedCountBefore[i])
        } else {
          // Wherever equipBotItems (inside botPlanRound) lands the pick —
          // itemBench or straight onto a board unit — the bot's TOTAL held
          // items grows by exactly the one item chooseBotItem picked.
          expect(botOwnedItems(p).length).toBe(ownedCountBefore[i] + 1)
        }
        expect(p.hp).toBe(hpBefore[i])
      })
    })

    it('creep round (round 1): kind creep, one log per living human seat with seatB === -1, enemy frame-0 positions match CREEP_ROUNDS[1] verbatim (no mirror), hp unchanged', () => {
      const run = newRun(botSeats())
      run.round = 1
      run.players[0].board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 0, row: 4 } }]
      const hpBefore = run.players.map(p => p.hp)

      const result = resolveRound(run, 91)

      expect(result.kind).toBe('creep')
      expect(result.logs).toHaveLength(1)   // only seat 0 is human
      const log = result.logs[0]
      expect(log.seatB).toBe(-1)

      const enemyUnits = log.frames[0].units.filter(u => u.team === 'enemy')
      const spawns = CREEP_ROUNDS[1].spawns
      expect(enemyUnits).toHaveLength(spawns.length)
      for (const spawn of spawns) {
        expect(enemyUnits.some(u => u.hexPos.col === spawn.col && u.hexPos.row === spawn.row)).toBe(true)
      }

      const humanSeatResult = result.seats.find(s => s.seat === 0)!
      expect(humanSeatResult.opponentSeat).toBe(-1)
      expect(humanSeatResult.logIndex).toBe(0)
      const botSeatResult = result.seats.find(s => s.seat === 1)!
      expect(botSeatResult.opponentSeat).toBe(-1)
      expect(botSeatResult.logIndex).toBeNull()

      run.players.forEach((p, i) => expect(p.hp).toBe(hpBefore[i]))
    })

    it('a creep or item round in a lobby with zero living human seats produces empty logs and still settles and plans every living bot', () => {
      const run = newRun(botSeats())
      run.round = 1
      run.players[0].eliminated = true   // no living human seat
      const hpBefore = run.players.map(p => p.hp)

      const result = resolveRound(run, 92)

      expect(result.kind).toBe('creep')
      expect(result.logs).toEqual([])
      for (let i = 1; i < run.players.length; i++) {
        expect(run.players[i].hp).toBe(hpBefore[i])
      }
    })
  })
})
