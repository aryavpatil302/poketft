import { describe, it, expect } from 'vitest'
import { emptyEcon, type RunState, type PlayerEcon } from './runState'
import { rollCrawlerEarthquakeRewards } from './caveCrawlerSpawn'

// Deterministic LCG so every roll is reproducible.
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

const CRAWLERS = ['zubat', 'druddigon', 'gible', 'sableye', 'ferrothorn', 'excadrill'] // cost 1,1,2,2,2,3

// Minimal RunState carrying only what the helper reads (state.pool), with a
// generous pool so exhaustion doesn't interfere unless a test wants it.
function makeState(copies = 1000): RunState {
  const pool: Record<string, number> = {}
  for (const id of CRAWLERS) pool[id] = copies
  return { pool } as RunState
}

function econWithCrawlers(n: number, tier: 1 | 2 | 3 = 1): PlayerEcon {
  const e = emptyEcon('t', null)
  e.gold = 0
  e.board = CRAWLERS.slice(0, n).map((id, i) => ({ definitionId: id, tier, hexPos: { col: i, row: 4 } }))
  return e
}

function poolTotal(state: RunState): number {
  return CRAWLERS.reduce((sum, id) => sum + (state.pool[id] ?? 0), 0)
}

describe('rollCrawlerEarthquakeRewards', () => {
  it('does nothing with fewer than 3 crawler species', () => {
    const state = makeState()
    const econ = econWithCrawlers(2)
    const before = poolTotal(state)
    const rw = rollCrawlerEarthquakeRewards(state, econ, 20, lcg(1))
    expect(rw.spawned).toHaveLength(0)
    expect(rw.gold).toBe(0)
    expect(poolTotal(state)).toBe(before)
    expect(econ.bench.every(b => b === null)).toBe(true)
  })

  it('does nothing with zero quakes', () => {
    const state = makeState()
    const rw = rollCrawlerEarthquakeRewards(state, econWithCrawlers(5), 0, lcg(1))
    expect(rw.spawned).toHaveLength(0)
    expect(rw.gold).toBe(0)
  })

  it('at 3+ species, each spawn draws exactly one copy from the pool', () => {
    const state = makeState()
    const econ = econWithCrawlers(3)
    const before = poolTotal(state)
    const rw = rollCrawlerEarthquakeRewards(state, econ, 50, lcg(7))
    expect(rw.spawned.length).toBeGreaterThan(0)          // some rolls hit over 50 quakes
    expect(poolTotal(state)).toBe(before - rw.spawned.length)   // conserved: pool down by exactly the spawns
    expect(rw.spawned.every(id => CRAWLERS.includes(id))).toBe(true)
  })

  it('picks cheap crawlers far more often than expensive ones', () => {
    const state = makeState(100000)   // never exhaust, so weighting is what we measure
    const econ = econWithCrawlers(6)
    const rw = rollCrawlerEarthquakeRewards(state, econ, 20000, lcg(42))
    const zubat = rw.spawned.filter(id => id === 'zubat').length      // cost 1, weight 6
    const excadrill = rw.spawned.filter(id => id === 'excadrill').length // cost 3, weight 2
    expect(zubat).toBeGreaterThan(excadrill * 2)   // ~3× weight → clearly more common
  })

  it('grants no gold below 5 species, and 1-5 gold per successful roll at 5+', () => {
    const noGold = rollCrawlerEarthquakeRewards(makeState(), econWithCrawlers(4), 40, lcg(3))
    expect(noGold.gold).toBe(0)

    const econ = econWithCrawlers(5)
    const rw = rollCrawlerEarthquakeRewards(makeState(), econ, 100, lcg(9))
    expect(rw.gold).toBeGreaterThan(0)
    expect(rw.gold).toBeLessThanOrEqual(100 * 5)   // never exceeds max-per-quake
    expect(econ.gold).toBe(rw.gold)
  })

  it('never spawns when the bench is full (and draws nothing from the pool)', () => {
    const state = makeState()
    const econ = econWithCrawlers(5)
    econ.bench = econ.bench.map(() => ({ definitionId: 'zubat', tier: 1 }))   // every slot taken
    const before = poolTotal(state)
    const rw = rollCrawlerEarthquakeRewards(state, econ, 50, lcg(5))
    expect(rw.spawned).toHaveLength(0)
    expect(poolTotal(state)).toBe(before)
  })

  it('fizzles when the pool is dry for every crawler', () => {
    const state = makeState(0)   // no copies anywhere
    const econ = econWithCrawlers(5)
    const rw = rollCrawlerEarthquakeRewards(state, econ, 50, lcg(5))
    expect(rw.spawned).toHaveLength(0)
    expect(econ.bench.every(b => b === null)).toBe(true)
  })

  it('a spawned third copy auto-combines to a 2★, like a buy', () => {
    // Only zubat has copies → every spawn is a zubat.
    const state = { pool: { zubat: 10 } } as unknown as RunState
    const econ = econWithCrawlers(5)
    econ.bench[0] = { definitionId: 'zubat', tier: 1 }
    econ.bench[1] = { definitionId: 'zubat', tier: 1 }
    // Force the very first quake to spawn (rng starts low), landing the 3rd zubat.
    rollCrawlerEarthquakeRewards(state, econ, 30, lcg(2))
    const twoStars = econ.bench.filter(b => b?.definitionId === 'zubat' && b.tier === 2)
    expect(twoStars.length).toBeGreaterThanOrEqual(1)
  })
})
