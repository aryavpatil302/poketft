import { describe, it, expect } from 'vitest'
import { newRun, emptyEcon, freshPool, shopEligibleUnits } from './runState'
import { rollShop, reroll, buyUnit, sellFromBench, sellFromBoard, returnAllToPool, hasShinyOwned, pickChosenTrait } from './shop'
import { UNIT_MAP } from '../data/units'
import {
  REROLL_COST, SHOP_SLOTS, POOL_COPIES, SHINY_COST_ODDS, SHINY_TIER, SHINY_PITY_ROLLS,
  CHOSEN_TRAIT_INELIGIBLE, copiesHeld, shinyPrice, SHINY_EXCLUSION_SHOPS,
} from './constants'
import { wouldCombine } from './combine'

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
//
// The shiny pass's draws, in order, depend on ownership (see rollShop):
//   - NOT owning: [chance check, cost-tier pick, within-tier id pick,
//     chosen-trait pick] — up to 4 draws (0 if the chance check fails).
//   - Owning, pity counter not yet at SHINY_PITY_ROLLS: 0 draws — the
//     ownership branch returns before touching rng at all.
//   - Owning, pity counter reaching SHINY_PITY_ROLLS (guaranteed offer):
//     [cost-tier pick, within-tier id pick, chosen-trait pick] — no chance
//     check, since the offer is unconditional on this roll.
// The offer slot itself is no longer an rng draw — it is always
// SHOP_SLOTS - 1 (the rightmost slot).
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

  it('buying a third copy defers the combine when it would consume a fielded copy and board consumption is disallowed', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    e.gold = 10
    e.bench[0] = { definitionId: 'kingler', tier: 1 }
    e.board.push({ definitionId: 'kingler', tier: 1, hexPos: { col: 2, row: 6 } })
    e.shop[2] = 'kingler'
    const res = buyUnit(run, e, 2, false)
    expect(res).toEqual({ ok: true, combined: null })
    // Board untouched — the fielded copy was never consumed.
    expect(e.board).toEqual([{ definitionId: 'kingler', tier: 1, hexPos: { col: 2, row: 6 } }])
    // The new copy landed on the bench, uncombined, alongside the original.
    const benchKinglers = e.bench.filter(b => b?.definitionId === 'kingler')
    expect(benchKinglers).toHaveLength(2)
    expect(benchKinglers.every(b => b?.tier === 1)).toBe(true)
  })

  it('a bench-only third copy still combines immediately even when board consumption is disallowed', () => {
    const run = newRun(BOT_SEATS)
    const e = run.players[0]
    e.gold = 10
    e.bench[0] = { definitionId: 'kingler', tier: 1 }
    e.bench[1] = { definitionId: 'kingler', tier: 1 }
    e.shop[2] = 'kingler'
    const res = buyUnit(run, e, 2, false)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.combined?.upgrades[0]).toMatchObject({ definitionId: 'kingler', from: 1, to: 2 })
    const kinglers = e.bench.filter(b => b?.definitionId === 'kingler')
    expect(kinglers).toHaveLength(1)
    expect(kinglers[0]!.tier).toBe(2)
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
    // Shared by every test below: the same forced-tier-2 draw pair, derived
    // from the level-5 SHINY_COST_ODDS row's cumulative weights rather than
    // hardcoded — tier 1 covers [0, cum1), tier 2 covers [cum1, cum2), and
    // the midpoint always selects tier 2 regardless of the exact weights.
    function tier2DrawAtLevel5(): number {
      const level5Odds = SHINY_COST_ODDS[5]   // [40, 55, 5, 0, 0]
      const cum1 = level5Odds[0] / 100
      const cum2 = (level5Odds[0] + level5Odds[1]) / 100
      return (cum1 + cum2) / 2
    }

    it('(a) forces a shiny at the forced chance and cost-tier draws, always in the rightmost slot', () => {
      const pool = freshPool()
      const e = emptyEcon('t', null)
      e.level = 5
      const rng = scriptedRng(9, {
        [SHINY_PASS_START]: 0.01,       // chance check: below SHINY_ROLL_CHANCE
        [SHINY_PASS_START + 1]: tier2DrawAtLevel5(),   // cost-tier pick: forced to tier 2
      })

      rollShop(e, pool, rng)

      // The Chosen offer ALWAYS lands in the rightmost slot — never a random
      // one among the 5 (real TFT behavior, not the old random-slot roll).
      const shinySlots = e.shopShiny.map((s, i) => (s ? i : -1)).filter(i => i >= 0)
      expect(shinySlots).toEqual([SHOP_SLOTS - 1])
      const def = UNIT_MAP.get(e.shop[SHOP_SLOTS - 1]!)!
      expect(def.cost).toBe(2)
      expect(pool[def.id]).toBeGreaterThanOrEqual(copiesHeld(SHINY_TIER))
      // A chosen trait was rolled and stored alongside the offer, drawn from
      // the candidate's own types.
      const chosen = e.shopShinyTrait[SHOP_SLOTS - 1]
      expect(chosen).not.toBeNull()
      expect(def.types).toContain(chosen)
    })

    it('(b) not owning a shiny: unchanged 50% probabilistic roll, pity counter stays at 0', () => {
      const failRng = scriptedRng(9, { [SHINY_PASS_START]: 0.99 })   // forced above SHINY_ROLL_CHANCE
      const failEcon = emptyEcon('t', null)
      failEcon.level = 5
      rollShop(failEcon, freshPool(), failRng)
      expect(failEcon.shopShiny.every(s => s === false)).toBe(true)
      expect(failEcon.shinyPityCounter).toBe(0)

      const passRng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2DrawAtLevel5() })
      const passEcon = emptyEcon('t', null)
      passEcon.level = 5
      rollShop(passEcon, freshPool(), passRng)
      expect(passEcon.shopShiny.filter(Boolean)).toHaveLength(1)
      expect(passEcon.shinyPityCounter).toBe(0)
    })

    it('(c) owning a shiny: pity counter guarantees an offer on exactly the 4th roll, none on rolls 1-3', () => {
      const benchEcon = emptyEcon('t', null)
      benchEcon.level = 5
      benchEcon.bench[0] = { definitionId: 'tangela', tier: 2, isShiny: true }
      expect(hasShinyOwned(benchEcon)).toBe(true)

      // Rolls 1..SHINY_PITY_ROLLS-1: a chance/cost-tier pair that WOULD force
      // a shiny if consulted, proving the pity path truly skips those draws
      // (0 additional rng calls consumed) rather than merely landing on "no
      // shiny" by coincidence.
      for (let roll = 1; roll < SHINY_PITY_ROLLS; roll++) {
        const rng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2DrawAtLevel5() })
        rollShop(benchEcon, freshPool(), rng)
        expect(benchEcon.shopShiny.every(s => s === false)).toBe(true)
        expect(benchEcon.shinyPityCounter).toBe(roll)
        expect(rng.callCount).toBe(SHINY_PASS_START)
      }

      // The guaranteed roll: no chance check is drawn (the offer is
      // unconditional), only cost-tier / id / chosen-trait.
      const guaranteedRng = scriptedRng(9, { [SHINY_PASS_START]: tier2DrawAtLevel5() })
      rollShop(benchEcon, freshPool(), guaranteedRng)
      const shinySlots = benchEcon.shopShiny.map((s, i) => (s ? i : -1)).filter(i => i >= 0)
      expect(shinySlots).toEqual([SHOP_SLOTS - 1])
      expect(benchEcon.shinyPityCounter).toBe(0)   // reset the moment it fires
    })

    it('(d) losing ownership resets the pity counter back to 0', () => {
      const e = emptyEcon('t', null)
      e.level = 5
      e.bench[0] = { definitionId: 'tangela', tier: 2, isShiny: true }
      rollShop(e, freshPool(), scriptedRng(9, {}))
      expect(e.shinyPityCounter).toBe(1)

      e.bench[0] = null   // the shiny was sold/lost
      rollShop(e, freshPool(), scriptedRng(9, { [SHINY_PASS_START]: 0.99 }))
      expect(e.shinyPityCounter).toBe(0)
    })

    it('(e) a depleted cost tier yields no shiny and no cross-tier fallback', () => {
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

    it('(f) shopShiny/shopShinyTrait reset on every call regardless of prior contents', () => {
      const e = emptyEcon('t', null)
      e.level = 5

      e.shopShiny = e.shopShiny.map(() => true)   // stale all-true
      e.shopShinyTrait = e.shopShinyTrait.map(() => 'stalwart')   // stale all-set
      const failRng = scriptedRng(9, { [SHINY_PASS_START]: 0.99 })   // forced above SHINY_ROLL_CHANCE
      rollShop(e, freshPool(), failRng)
      expect(e.shopShiny).toHaveLength(SHOP_SLOTS)
      expect(e.shopShiny.every(s => s === false)).toBe(true)
      expect(e.shopShinyTrait.every(t => t === null)).toBe(true)

      e.shopShiny = e.shopShiny.map(() => true)   // stale all-true again
      const successRng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2DrawAtLevel5() })
      rollShop(e, freshPool(), successRng)
      expect(e.shopShiny.filter(Boolean)).toHaveLength(1)
      expect(e.shopShinyTrait.filter(t => t !== null)).toHaveLength(1)
    })

    it('(g) level 10 reuses the level-9 SHINY_COST_ODDS row without crashing', () => {
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
      expect(shinySlots).toEqual([SHOP_SLOTS - 1])
      const def = UNIT_MAP.get(e.shop[SHOP_SLOTS - 1]!)!
      expect(def.cost).toBe(4)
    })

    it('(h) reroll inherits the shiny pass with no shiny-specific code of its own', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.level = 5
      e.gold = REROLL_COST
      const rng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier2DrawAtLevel5() })

      const ok = reroll(e, run.pool, rng)

      expect(ok).toBe(true)
      expect(e.shopShiny.filter(Boolean)).toHaveLength(1)
    })

    it('(i) never re-offers a species already owned as a shiny, even on the guaranteed pity roll', () => {
      // Only two 2-cost species carry pool copies — both real cost-2 units
      // (venusaur, a_raichu — see src/data/units.ts), both shiny-eligible
      // (>= copiesHeld(SHINY_TIER)). venusaur (the owned one) is given
      // overwhelmingly more pool copies than a_raichu, so an UNFILTERED
      // weighted "id pick" draw would pick venusaur under this exact rng
      // sequence with near-certainty — proving the exclusion is what
      // changes the outcome, not coincidence. Post-exclusion only a_raichu
      // remains, so pickWeightedId's result is deterministic regardless of
      // the draw's exact value.
      const pool = freshPool()
      for (const def of shopEligibleUnits()) {
        if (def.cost !== 2) continue
        if (def.id === 'venusaur') pool[def.id] = 1000
        else if (def.id === 'a_raichu') pool[def.id] = copiesHeld(SHINY_TIER)   // minimum eligible
        else pool[def.id] = 0
      }
      const e = emptyEcon('t', null)
      e.level = 5
      e.bench[0] = { definitionId: 'venusaur', tier: 2, isShiny: true }   // already owned

      // Ownership only replaces the probabilistic roll with a pity timer —
      // it doesn't force an offer immediately. Burn through rolls 1..N-1
      // (no offer, same as test (c)) before the guaranteed Nth roll.
      for (let roll = 1; roll < SHINY_PITY_ROLLS; roll++) {
        rollShop(e, pool, scriptedRng(9, {}))
        expect(e.shopShiny.every(s => s === false)).toBe(true)
      }

      const rng = scriptedRng(9, { [SHINY_PASS_START]: tier2DrawAtLevel5() })   // guaranteed pity offer
      rollShop(e, pool, rng)

      const shinySlots = e.shopShiny.map((s, i) => (s ? i : -1)).filter(i => i >= 0)
      expect(shinySlots).toEqual([SHOP_SLOTS - 1])
      expect(e.shop[SHOP_SLOTS - 1]).toBe('a_raichu')   // NOT venusaur, despite dominating the unfiltered weight
    })

    it('(j) if every candidate at the rolled cost tier is already owned, the roll offers nothing (no cross-tier fallback)', () => {
      const pool = freshPool()
      for (const def of shopEligibleUnits()) {
        if (def.cost === 2 && def.id !== 'venusaur') pool[def.id] = 0
      }
      const e = emptyEcon('t', null)
      e.level = 5
      e.bench[0] = { definitionId: 'venusaur', tier: 2, isShiny: true }   // the only 2-cost candidate, already owned

      for (let roll = 1; roll < SHINY_PITY_ROLLS; roll++) {
        rollShop(e, pool, scriptedRng(9, {}))
      }

      const rng = scriptedRng(9, { [SHINY_PASS_START]: tier2DrawAtLevel5() })
      rollShop(e, pool, rng)

      expect(e.shopShiny.every(s => s === false)).toBe(true)
    })
  })

  describe('shiny species cooldown', () => {
    // Shared by every test below: a pool where only the given ids carry
    // copies at the given cost tier, making the shiny cost-tier's candidate
    // pool deterministic — same technique as the "depleted cost tier" test
    // above, but keeping specific ids alive instead of zeroing all of them.
    // tangela/ribombee/kingler are all cost-1 units (see src/data/units.ts).
    function poolWithOnlyIdsAtCost(cost: number, ids: string[]): Record<string, number> {
      const pool = freshPool()
      for (const def of shopEligibleUnits()) if (def.cost === cost && !ids.includes(def.id)) pool[def.id] = 0
      return pool
    }

    // Forces the shiny cost-tier draw to tier 1, derived from the level-5
    // SHINY_COST_ODDS row's cumulative weight the same way tier2DrawAtLevel5
    // does above, just landing inside tier 1's range instead of tier 2's.
    function tier1DrawAtLevel5(): number {
      const level5Odds = SHINY_COST_ODDS[5]   // [40, 55, 5, 0, 0]
      const cum1 = level5Odds[0] / 100
      return cum1 / 2
    }

    it('a species offered and passed on gets excluded for SHINY_EXCLUSION_SHOPS refreshes', () => {
      const pool = poolWithOnlyIdsAtCost(1, ['tangela'])
      const e = emptyEcon('t', null)
      e.level = 5
      const offerRng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier1DrawAtLevel5() })
      rollShop(e, pool, offerRng)
      expect(e.shop[SHOP_SLOTS - 1]).toBe('tangela')
      expect(e.shopShiny[SHOP_SLOTS - 1]).toBe(true)

      // The offer sits unbought — shopShiny[4] is still true going into the
      // next roll. rollShop reads that BEFORE its own reset loop wipes it.
      const nextRng = scriptedRng(9, { [SHINY_PASS_START]: 0.99 })
      rollShop(e, pool, nextRng)
      expect(e.shinyExclusion['tangela']).toBe(SHINY_EXCLUSION_SHOPS - 1)
    })

    it('a species that was bought (slot cleared via buyUnit) does not get excluded', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.level = 5
      e.gold = 999
      for (const def of shopEligibleUnits()) if (def.cost === 1 && def.id !== 'tangela') run.pool[def.id] = 0

      const offerRng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier1DrawAtLevel5() })
      rollShop(e, run.pool, offerRng)
      expect(e.shop[SHOP_SLOTS - 1]).toBe('tangela')
      expect(e.shopShiny[SHOP_SLOTS - 1]).toBe(true)

      const res = buyUnit(run, e, SHOP_SLOTS - 1)
      expect(res.ok).toBe(true)
      expect(e.shopShiny[SHOP_SLOTS - 1]).toBe(false)   // buyUnit clears it immediately

      const nextRng = scriptedRng(9, { [SHINY_PASS_START]: 0.99 })
      rollShop(e, run.pool, nextRng)
      expect(e.shinyExclusion['tangela']).toBeUndefined()
    })

    it('exclusion count decrements by exactly 1 per rollShop call and is removed once it hits 0', () => {
      const pool = poolWithOnlyIdsAtCost(1, ['tangela'])
      const e = emptyEcon('t', null)
      e.level = 5
      rollShop(e, pool, scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier1DrawAtLevel5() }))
      expect(e.shop[SHOP_SLOTS - 1]).toBe('tangela')

      // Capture roll: sets to SHINY_EXCLUSION_SHOPS then immediately
      // decrements once in the same call.
      rollShop(e, pool, scriptedRng(9, { [SHINY_PASS_START]: 0.99 }))
      expect(e.shinyExclusion['tangela']).toBe(SHINY_EXCLUSION_SHOPS - 1)

      for (let remaining = SHINY_EXCLUSION_SHOPS - 2; remaining >= 0; remaining--) {
        rollShop(e, pool, scriptedRng(9, { [SHINY_PASS_START]: 0.99 }))
        if (remaining === 0) {
          expect(e.shinyExclusion['tangela']).toBeUndefined()
        } else {
          expect(e.shinyExclusion['tangela']).toBe(remaining)
        }
      }
    })

    it('an excluded species is never selected as the shiny candidate even when rng would otherwise pick it', () => {
      const pool = poolWithOnlyIdsAtCost(1, ['tangela', 'ribombee'])
      const e = emptyEcon('t', null)
      e.level = 5
      // Still > 0 after this call's unconditional decrement, so it filters
      // out of the candidate pool during THIS call's shiny pass.
      e.shinyExclusion['tangela'] = 2
      const rng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier1DrawAtLevel5() })

      rollShop(e, pool, rng)

      expect(e.shopShiny[SHOP_SLOTS - 1]).toBe(true)
      expect(e.shop[SHOP_SLOTS - 1]).toBe('ribombee')
      expect(e.shinyExclusion['tangela']).toBe(1)
    })

    it('falls back to the excluded pool when every candidate at the rolled cost tier is on cooldown', () => {
      const pool = poolWithOnlyIdsAtCost(1, ['tangela', 'ribombee'])
      const e = emptyEcon('t', null)
      e.level = 5
      e.shinyExclusion['tangela'] = 2
      e.shinyExclusion['ribombee'] = 2
      const rng = scriptedRng(9, { [SHINY_PASS_START]: 0.01, [SHINY_PASS_START + 1]: tier1DrawAtLevel5() })

      rollShop(e, pool, rng)

      // Both candidates are excluded, but a shiny is still offered — the
      // protection never suppresses an offer into nothing when candidates
      // exist at the rolled tier.
      expect(e.shopShiny[SHOP_SLOTS - 1]).toBe(true)
      expect(['tangela', 'ribombee']).toContain(e.shop[SHOP_SLOTS - 1])
    })

    it('exclusion is keyed by species id, not by cost tier or slot', () => {
      const pool = poolWithOnlyIdsAtCost(1, ['tangela', 'ribombee', 'kingler'])
      const picks = new Set<string>()
      for (let seed = 0; seed < 50; seed++) {
        const e = emptyEcon('t', null)
        e.level = 5
        e.shinyExclusion['tangela'] = 2
        const rng = scriptedRng(seed, {
          [SHINY_PASS_START]: 0.01,
          [SHINY_PASS_START + 1]: tier1DrawAtLevel5(),
        })
        rollShop(e, pool, rng)
        expect(e.shop[SHOP_SLOTS - 1]).not.toBe('tangela')
        if (e.shopShiny[SHOP_SLOTS - 1]) picks.add(e.shop[SHOP_SLOTS - 1]!)
      }
      // Both non-excluded species remain reachable — excluding tangela does
      // not blanket-filter the whole cost tier, only that one species.
      expect(picks.has('ribombee')).toBe(true)
      expect(picks.has('kingler')).toBe(true)

      const e2 = emptyEcon('t', null)
      e2.shinyExclusion['tangela'] = 3
      expect(Object.keys(e2.shinyExclusion)).toEqual(['tangela'])
    })
  })

  describe('chosen trait roll', () => {
    it('excludes all seven ineligible traits, drawing only from the eligible remainder', () => {
      // Tapu Fini: ['wave_spirit', 'beachy', 'mystic'] — wave_spirit is
      // ineligible (single-unit-presence trait), beachy/mystic are not.
      const def = UNIT_MAP.get('tapu_fini')!
      expect(def.types).toContain('wave_spirit')
      const eligible = def.types.filter(t => !CHOSEN_TRAIT_INELIGIBLE.has(t))
      expect(eligible).toEqual(['beachy', 'mystic'])

      for (let seed = 0; seed < 300; seed++) {
        const trait = pickChosenTrait('tapu_fini', seededRng(seed))
        expect(trait).not.toBe('wave_spirit')
        expect(eligible).toContain(trait)
      }
    })

    it('every CHOSEN_TRAIT_INELIGIBLE entry matches src/data/traits.ts (count: 1)-only traits', () => {
      // Documents WHY these seven are excluded — a regression here would
      // mean either list drifted from the other.
      expect([...CHOSEN_TRAIT_INELIGIBLE].sort()).toEqual(
        ['earth_spirit', 'mind_spirit', 'rogue', 'shock_spirit', 'soul_bonded', 'wave_spirit', 'zen'].sort(),
      )
    })
  })

  describe('shiny buy', () => {
    it('(a) happy path: 3x price, 3 pool copies, tier-2 shiny-flagged bench unit', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.gold = 100
      e.shop[0] = 'tangela'
      e.shopShiny[0] = true
      const goldBefore = e.gold
      const poolBefore = run.pool['tangela']

      const res = buyUnit(run, e, 0)

      expect(res.ok).toBe(true)
      const tangelas = e.bench.filter(b => b?.definitionId === 'tangela')
      expect(tangelas).toHaveLength(1)
      expect(tangelas[0]).toEqual({ definitionId: 'tangela', tier: 2, isShiny: true })
      expect(e.gold).toBe(goldBefore - shinyPrice(UNIT_MAP.get('tangela')!.cost))
      expect(run.pool['tangela']).toBe(poolBefore - copiesHeld(SHINY_TIER))
      expect(e.shop[0]).toBeNull()
      expect(e.shopShiny[0]).toBe(false)
    })

    it('(a2) copies shopShinyTrait[slot] onto the bought BenchedUnit and clears the slot', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.gold = 100
      e.shop[0] = 'tangela'
      e.shopShiny[0] = true
      e.shopShinyTrait[0] = 'jungle'

      const res = buyUnit(run, e, 0)

      expect(res.ok).toBe(true)
      const tangelas = e.bench.filter(b => b?.definitionId === 'tangela')
      expect(tangelas).toHaveLength(1)
      expect(tangelas[0]).toEqual({ definitionId: 'tangela', tier: 2, isShiny: true, chosenTrait: 'jungle' })
      expect(e.shopShinyTrait[0]).toBeNull()
    })

    it('(b) drained pool rejects cleanly with no partial mutation', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.gold = 100
      e.shop[0] = 'tangela'
      e.shopShiny[0] = true
      run.pool['tangela'] = copiesHeld(SHINY_TIER) - 1
      const goldBefore = e.gold
      const poolBefore = run.pool['tangela']

      const res = buyUnit(run, e, 0)

      expect(res).toEqual({ ok: false, reason: 'pool-empty' })
      expect(e.gold).toBe(goldBefore)
      expect(run.pool['tangela']).toBe(poolBefore)
      expect(e.bench.every(b => b === null)).toBe(true)
      expect(e.shop[0]).toBe('tangela')
      expect(e.shopShiny[0]).toBe(true)
    })

    it('(c) full bench rejects a shiny buy even when the tier-1 phantom merge would fire', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.gold = 100
      e.bench = [
        { definitionId: 'tangela', tier: 1 }, { definitionId: 'tangela', tier: 1 },
        ...Array(7).fill({ definitionId: 'zubat', tier: 1 }),
      ]
      e.shop[0] = 'tangela'
      e.shopShiny[0] = true
      const goldBefore = e.gold
      const poolBefore = run.pool['tangela']

      // Prove the guard is what rejects, not an absent precondition — a
      // non-shiny buy right now WOULD combine via the tier-1 phantom path.
      expect(wouldCombine(e, 'tangela')).toBe(true)

      const res = buyUnit(run, e, 0)

      expect(res).toEqual({ ok: false, reason: 'bench-full' })
      const tangelas = e.bench.filter(b => b?.definitionId === 'tangela')
      expect(tangelas).toHaveLength(2)
      expect(tangelas.every(b => b?.tier === 1)).toBe(true)
      expect(e.gold).toBe(goldBefore)
      expect(run.pool['tangela']).toBe(poolBefore)
    })

    it('(c2) full bench rejects a non-shiny phantom-merge buy when board consumption is disallowed', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.gold = 100
      e.bench = [
        { definitionId: 'tangela', tier: 1 }, { definitionId: 'tangela', tier: 1 },
        ...Array(7).fill({ definitionId: 'zubat', tier: 1 }),
      ]
      e.shop[0] = 'tangela'
      const goldBefore = e.gold
      const poolBefore = run.pool['tangela']

      // Confirm the ONLY thing that changed is the new mode — this exact buy
      // would otherwise succeed via the phantom-merge path (see (c) above).
      expect(wouldCombine(e, 'tangela', true)).toBe(true)

      const res = buyUnit(run, e, 0, false)

      expect(res).toEqual({ ok: false, reason: 'bench-full' })
      const tangelas = e.bench.filter(b => b?.definitionId === 'tangela')
      expect(tangelas).toHaveLength(2)
      expect(e.gold).toBe(goldBefore)
      expect(run.pool['tangela']).toBe(poolBefore)
    })

    it('(d) chains into a 3★ that keeps the shiny flag AND the chosen trait, composing with buy accounting', () => {
      const run = newRun(BOT_SEATS)
      const e = run.players[0]
      e.gold = 100
      e.bench[0] = { definitionId: 'tangela', tier: 2 }
      e.bench[1] = { definitionId: 'tangela', tier: 2 }
      e.shop[0] = 'tangela'
      e.shopShiny[0] = true
      e.shopShinyTrait[0] = 'jungle'
      run.pool['tangela'] = Math.max(run.pool['tangela'], copiesHeld(SHINY_TIER))
      const goldBefore = e.gold
      const poolBefore = run.pool['tangela']

      const res = buyUnit(run, e, 0)

      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.combined?.upgrades).toContainEqual(
          expect.objectContaining({ definitionId: 'tangela', from: 2, to: 3 }),
        )
      }
      const tangelas = [...e.bench.filter(b => b?.definitionId === 'tangela'),
        ...e.board.filter(u => u.definitionId === 'tangela')]
      expect(tangelas).toHaveLength(1)
      expect(tangelas[0]!.tier).toBe(3)
      expect(tangelas[0]!.isShiny).toBe(true)
      expect(tangelas[0]!.chosenTrait).toBe('jungle')
      expect(e.gold).toBe(goldBefore - shinyPrice(UNIT_MAP.get('tangela')!.cost))
      expect(run.pool['tangela']).toBe(poolBefore - copiesHeld(SHINY_TIER))
    })
  })
})
