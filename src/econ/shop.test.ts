import { describe, it, expect } from 'vitest'
import { newRun, emptyEcon, freshPool, shopEligibleUnits } from './runState'
import { rollShop, reroll, buyUnit, sellFromBench, sellFromBoard, returnAllToPool, hasShinyOwned } from './shop'
import { UNIT_MAP } from '../data/units'
import { REROLL_COST, SHOP_SLOTS, POOL_COPIES, SHINY_COST_ODDS, SHINY_TIER, copiesHeld } from './constants'

const BOT_SEATS = [
  { personaId: 'a', name: 'A' }, { personaId: 'b', name: 'B' },
  { personaId: 'c', name: 'C' }, { personaId: 'd', name: 'D' },
  { personaId: 'e', name: 'E' },
]

// Deterministic rng from a simple LCG
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// Scripted rng: delegates to seededRng(seed) on every call, except that a
// call whose zero-based index has an entry in `overrides` returns the forced
// value instead. Exposes a live `callCount` so a test can assert exactly how
// many draws a path consumed (e.g. proving the shiny ownership gate returns
// before the chance draw, rather than merely that no shiny appeared).
//
// Call-index map with a fresh pool (established once here, reused by every
// shiny test below): the existing per-slot loop draws exactly 2 per slot
// (one cost pick, one within-bucket id pick), so the normal pass consumes
// 2 * SHOP_SLOTS draws and the shiny pass begins at index 2 * SHOP_SLOTS.
// The shiny pass's four draws, in order: [chance check, cost-tier pick,
// within-tier id pick, slot index].
function scriptedRng(seed: number, overrides: Record<number, number>): (() => number) & { callCount: number } {
  const base = seededRng(seed)
  const rng = (() => {
    const idx = rng.callCount++
    return idx in overrides ? overrides[idx] : base()
  }) as (() => number) & { callCount: number }
  rng.callCount = 0
  return rng
}

const SHINY_PASS_START = 2 * SHOP_SLOTS

describe('shop', () => {
  it('level 1 shops contain only 1-cost units', () => {
    const pool = freshPool()
    const e = emptyEcon('t', null)   // level 1
    const rng = seededRng(42)
    for (let i = 0; i < 30; i++) {
      rollShop(e, pool, rng)
      for (const id of e.shop) {
        expect(id).not.toBeNull()
        expect(UNIT_MAP.get(id!)!.cost).toBe(1)
      }
    }
  })

  it('odds distribution roughly matches the level-7 table over many rolls', () => {
    const pool = freshPool()
    const e = emptyEcon('t', null)
    e.level = 7   // 19/30/40/10/1
    const rng = seededRng(7)
    const counts = [0, 0, 0, 0, 0]
    const N = 4000
    for (let i = 0; i < N / SHOP_SLOTS; i++) {
      rollShop(e, pool, rng)
      for (const id of e.shop) counts[UNIT_MAP.get(id!)!.cost - 1]++
    }
    const pct = counts.map(c => (c / N) * 100)
    expect(pct[0]).toBeGreaterThan(13); expect(pct[0]).toBeLessThan(25)
    expect(pct[1]).toBeGreaterThan(24); expect(pct[1]).toBeLessThan(36)
    expect(pct[2]).toBeGreaterThan(34); expect(pct[2]).toBeLessThan(46)
    expect(pct[3]).toBeGreaterThan(6);  expect(pct[3]).toBeLessThan(14)
    expect(pct[4]).toBeGreaterThan(0.2); expect(pct[4]).toBeLessThan(3)
  })

  it('depleted cost buckets renormalize to other buckets', () => {
    const pool = freshPool()
    // Empty ALL 1-cost units from the pool
    for (const def of shopEligibleUnits()) if (def.cost === 1) pool[def.id] = 0
    const e = emptyEcon('t', null)
    e.level = 3   // 75/25 over 1c/2c → all rolls must be 2-cost now
    const rng = seededRng(3)
    rollShop(e, pool, rng)
    for (const id of e.shop) {
      expect(UNIT_MAP.get(id!)!.cost).toBe(2)
    }
  })

  it('reroll charges gold, free reroll does not, both clear the lock', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    e.gold = 5
    e.shopLocked = true
    expect(reroll(e, run.pool, seededRng(1))).toBe(true)
    expect(e.gold).toBe(5 - REROLL_COST)
    expect(e.shopLocked).toBe(false)

    e.shopLocked = true
    expect(reroll(e, run.pool, seededRng(2), true)).toBe(true)
    expect(e.gold).toBe(5 - REROLL_COST)   // unchanged
    expect(e.shopLocked).toBe(false)

    e.gold = 1
    expect(reroll(e, run.pool, seededRng(3))).toBe(false)
  })

  it('buying moves a copy from pool to bench and charges cost', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    e.gold = 10
    e.shop[0] = 'tangela'
    const res = buyUnit(run, e, 0)
    expect(res.ok).toBe(true)
    expect(e.gold).toBe(9)
    expect(run.pool['tangela']).toBe(POOL_COPIES[1] - 1)
    expect(e.shop[0]).toBeNull()
    expect(e.bench.filter(b => b?.definitionId === 'tangela')).toHaveLength(1)
  })

  it('rejects buys without gold, on empty slots, and with a full unrelated bench', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    e.shop[0] = 'charizard'
    e.gold = 3
    expect(buyUnit(run, e, 0)).toEqual({ ok: false, reason: 'no-gold' })
    expect(buyUnit(run, e, 1)).toEqual({ ok: false, reason: 'empty-slot' })

    e.gold = 50
    e.bench = e.bench.map(() => ({ definitionId: 'zubat', tier: 1 as const }))
    // bench is 9× zubat — buying charizard has nowhere to go
    expect(buyUnit(run, e, 0)).toEqual({ ok: false, reason: 'bench-full' })
  })

  it('buy that completes a triple is allowed even with a full bench', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    e.gold = 10
    // Bench full: 7 fillers + 2 tangela copies
    e.bench = [
      { definitionId: 'tangela', tier: 1 }, { definitionId: 'tangela', tier: 1 },
      ...Array(7).fill({ definitionId: 'zubat', tier: 1 }),
    ]
    e.shop[0] = 'tangela'
    const res = buyUnit(run, e, 0)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.combined?.upgrades[0]).toMatchObject({ definitionId: 'tangela', from: 1, to: 2 })
    }
    const tangelas = e.bench.filter(b => b?.definitionId === 'tangela')
    expect(tangelas).toHaveLength(1)
    expect(tangelas[0]!.tier).toBe(2)
  })

  it('buying a third copy combines and prefers keeping a real board position', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    e.gold = 10
    e.bench[0] = { definitionId: 'kingler', tier: 1 }
    e.board.push({ definitionId: 'kingler', tier: 1, hexPos: { col: 2, row: 6 } })
    e.shop[2] = 'kingler'
    const res = buyUnit(run, e, 2)
    expect(res.ok).toBe(true)
    expect(e.board).toHaveLength(1)
    expect(e.board[0]).toEqual({ definitionId: 'kingler', tier: 2, hexPos: { col: 2, row: 6 } })
    expect(e.bench.every(b => b?.definitionId !== 'kingler')).toBe(true)
  })

  it('selling returns copies to the pool: 2★ returns 3', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    run.pool['drednaw'] = 10
    e.bench[4] = { definitionId: 'drednaw', tier: 2 }
    sellFromBench(run, e, 4)
    expect(e.gold).toBe(2 * 3 - 1)   // cost 2, 2★
    expect(run.pool['drednaw']).toBe(13)
    expect(e.bench[4]).toBeNull()

    e.board.push({ definitionId: 'unown', tier: 1, hexPos: { col: 1, row: 7 } })
    const before = run.pool['unown']
    sellFromBoard(run, e, 0)
    expect(run.pool['unown']).toBe(before + 1)
    expect(e.board).toHaveLength(0)
  })

  it('returnAllToPool empties a player and credits every held copy', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[1]
    const t0 = run.pool['tangela']
    e.bench[0] = { definitionId: 'tangela', tier: 3 }   // 9 copies
    e.board.push({ definitionId: 'tangela', tier: 1, hexPos: { col: 0, row: 4 } })
    returnAllToPool(run, e)
    expect(run.pool['tangela']).toBe(t0 + 10)
    expect(e.bench.every(b => b === null)).toBe(true)
    expect(e.board).toHaveLength(0)
  })

  it('selling a unit returns its equipped item to the item bench', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[1]
    e.itemBench = []
    e.board.push({ definitionId: 'unown', tier: 1, hexPos: { col: 1, row: 7 }, item: 'metronome' })
    sellFromBoard(run, e, 0)
    expect(e.itemBench).toEqual(['metronome'])

    e.bench[0] = { definitionId: 'unown', tier: 1, item: 'metronome' }
    sellFromBench(run, e, 0)
    expect(e.itemBench).toEqual(['metronome', 'metronome'])
  })

  describe('shiny shop roll', () => {
    it('(a) forces a shiny at the forced chance and cost-tier draws', () => {
      const pool = freshPool()
      const e = emptyEcon('t', null)
      e.level = 5
      const level5Odds = SHINY_COST_ODDS[5]   // [40, 55, 5, 0, 0]
      // Derive a draw that lands inside tier 2's cumulative range from the
      // table itself, rather than hardcoding a magic number: tier 1 covers
      // [0, cum1), tier 2 covers [cum1, cum2) — the midpoint always selects
      // tier 2 regardless of the exact weights in that row.
      const cum1 = level5Odds[0] / 100
      const cum2 = (level5Odds[0] + level5Odds[1]) / 100
      const tier2Draw = (cum1 + cum2) / 2
      const rng = scriptedRng(9, {
        [SHINY_PASS_START]: 0.01,       // chance check: below SHINY_ROLL_CHANCE
        [SHINY_PASS_START + 1]: tier2Draw,   // cost-tier pick: forced to tier 2
      })

      rollShop(e, pool, rng)

      const shinySlots = e.shopShiny.map((s, i) => (s ? i : -1)).filter(i => i >= 0)
      expect(shinySlots).toHaveLength(1)
      const def = UNIT_MAP.get(e.shop[shinySlots[0]]!)!
      expect(def.cost).toBe(2)
      expect(pool[def.id]).toBeGreaterThanOrEqual(copiesHeld(SHINY_TIER))
    })

    // Shared by (b)-(f): the same forced-tier-2 draw pair from (a), derived
    // from the level-5 SHINY_COST_ODDS row's cumulative weights.
    function tier2DrawAtLevel5(): number {
      const level5Odds = SHINY_COST_ODDS[5]   // [40, 55, 5, 0, 0]
      const cum1 = level5Odds[0] / 100
      const cum2 = (level5Odds[0] + level5Odds[1]) / 100
      return (cum1 + cum2) / 2
    }

    it('(b) ownership gate short-circuits before any shiny rng draw', () => {
      const tier2Draw = tier2DrawAtLevel5()

      const benchEcon = emptyEcon('t', null)
      benchEcon.level = 5
      benchEcon.bench[0] = { definitionId: 'tangela', tier: 2, isShiny: true }
      const benchRng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2Draw })
      expect(hasShinyOwned(benchEcon)).toBe(true)
      rollShop(benchEcon, freshPool(), benchRng)
      expect(benchEcon.shopShiny.every(s => s === false)).toBe(true)
      // The gate returns before the chance draw: rng was consumed only by
      // the normal per-slot loop (2 * SHOP_SLOTS), never reaching SHINY_PASS_START.
      expect(benchRng.callCount).toBe(SHINY_PASS_START)

      const boardEcon = emptyEcon('t', null)
      boardEcon.level = 5
      boardEcon.board.push({ definitionId: 'tangela', tier: 2, hexPos: { col: 0, row: 4 }, isShiny: true })
      const boardRng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2Draw })
      expect(hasShinyOwned(boardEcon)).toBe(true)
      rollShop(boardEcon, freshPool(), boardRng)
      expect(boardEcon.shopShiny.every(s => s === false)).toBe(true)
      expect(boardRng.callCount).toBe(SHINY_PASS_START)
    })

    it('(c) a depleted cost tier yields no shiny and no cross-tier fallback', () => {
      const pool = freshPool()
      // Every 2-cost id's pool set to 2: enough for the normal per-slot roll
      // (which only needs > 0) but below copiesHeld(SHINY_TIER) = 3, so no
      // 2-cost id is shiny-eligible. 2 rather than 0 keeps the normal roll's
      // rng consumption identical to test (a) — 0 would also zero the bucket
      // for the normal roll and change what this test is measuring.
      for (const def of shopEligibleUnits()) if (def.cost === 2) pool[def.id] = 2
      const e = emptyEcon('t', null)
      e.level = 5
      const rng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2DrawAtLevel5() })

      rollShop(e, pool, rng)

      expect(e.shopShiny.every(s => s === false)).toBe(true)
    })

    it('(d) shopShiny resets on every call regardless of prior contents', () => {
      const e = emptyEcon('t', null)
      e.level = 5

      e.shopShiny = e.shopShiny.map(() => true)   // stale all-true
      const failRng = scriptedRng(9, { [SHINY_PASS_START]: 0.99 })   // forced above SHINY_ROLL_CHANCE
      rollShop(e, freshPool(), failRng)
      expect(e.shopShiny).toHaveLength(SHOP_SLOTS)
      expect(e.shopShiny.every(s => s === false)).toBe(true)

      e.shopShiny = e.shopShiny.map(() => true)   // stale all-true again
      const successRng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2DrawAtLevel5() })
      rollShop(e, freshPool(), successRng)
      expect(e.shopShiny.filter(Boolean)).toHaveLength(1)
    })

    it('(e) level 10 reuses the level-9 SHINY_COST_ODDS row without crashing', () => {
      const pool = freshPool()
      const e = emptyEcon('t', null)
      e.level = 10
      const level9Odds = SHINY_COST_ODDS[9]   // [0, 0, 0, 60, 40]
      // Derive a draw inside tier 4's cumulative range — the row's first
      // nonzero bucket.
      const cum3 = (level9Odds[0] + level9Odds[1] + level9Odds[2]) / 100
      const cum4 = (level9Odds[0] + level9Odds[1] + level9Odds[2] + level9Odds[3]) / 100
      const tier4Draw = (cum3 + cum4) / 2
      const rng = scriptedRng(11, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier4Draw })

      expect(() => rollShop(e, pool, rng)).not.toThrow()

      const shinySlots = e.shopShiny.map((s, i) => (s ? i : -1)).filter(i => i >= 0)
      expect(shinySlots).toHaveLength(1)
      const def = UNIT_MAP.get(e.shop[shinySlots[0]]!)!
      expect(def.cost).toBe(4)
    })

    it('(f) reroll inherits the shiny pass with no shiny-specific code of its own', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.level = 5
      e.gold = REROLL_COST
      const rng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2DrawAtLevel5() })

      const ok = reroll(e, run.pool, rng)

      expect(ok).toBe(true)
      expect(e.shopShiny.filter(Boolean)).toHaveLength(1)
    })
  })
})
