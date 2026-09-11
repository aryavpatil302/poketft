import { describe, it, expect } from 'vitest'
import {
  newUTierAcc, addFightStat, recordShinyStageStat, buildShinyStageRows,
  MIN_SHINY_STAGE_SAMPLES, emptyTallies, zeroBreak, type FightUnitStat, type UTierAcc,
} from './unitStatAgg'

// Builds a fully-populated FightUnitStat with sane zero defaults, so each test
// only needs to override the fields it cares about.
function mkStat(overrides: Partial<FightUnitStat> = {}): FightUnitStat {
  return {
    defId: 'snorunt', tier: 1, team: 'a', isShiny: false,
    dealt: 0, taken: 0, casts: 0, kills: 0, deaths: 0,
    healSelf: 0, healAlly: 0, shieldSelf: 0, shieldAlly: 0,
    ...emptyTallies(), ...zeroBreak(),
    ...overrides,
  }
}

describe('unitStatAgg — separation', () => {
  it('keeps a shiny fight and a non-shiny fight of the same species+stage in separate buckets', () => {
    const agg = new Map<string, UTierAcc>()
    // Round 4 = stage 2 for both fights.
    recordShinyStageStat(agg, mkStat({ isShiny: true, dealt: 500 }), 4, true)
    recordShinyStageStat(agg, mkStat({ isShiny: false, dealt: 100 }), 4, true)
    const rows = buildShinyStageRows(agg, 1)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.shiny.fields).toBe(1)
    expect(row.shiny.avgDealt).toBe(500)
    expect(row.nonShiny).not.toBeNull()
    expect(row.nonShiny!.fields).toBe(1)
    expect(row.nonShiny!.avgDealt).toBe(100)
  })
})

describe('unitStatAgg — stage attribution', () => {
  it('produces two rows with different stages for the same shiny species at different rounds', () => {
    const agg = new Map<string, UTierAcc>()
    // Round 2 = stage 1, round 10 = stage 3.
    recordShinyStageStat(agg, mkStat({ isShiny: true, dealt: 200 }), 2, true)
    recordShinyStageStat(agg, mkStat({ isShiny: true, dealt: 900 }), 10, true)
    const rows = buildShinyStageRows(agg, 1)
    expect(rows).toHaveLength(2)
    const stages = rows.map(r => r.stage).sort((a, b) => a - b)
    expect(stages).toEqual([1, 3])
    const stage1Row = rows.find(r => r.stage === 1)!
    const stage3Row = rows.find(r => r.stage === 3)!
    expect(stage1Row.shiny.fields).toBe(1)
    expect(stage1Row.shiny.avgDealt).toBe(200)
    expect(stage3Row.shiny.fields).toBe(1)
    expect(stage3Row.shiny.avgDealt).toBe(900)
  })
})

describe('unitStatAgg — win-rate split', () => {
  it('gives the shiny side winRate 0.5 from one win and one loss at the same stage', () => {
    const agg = new Map<string, UTierAcc>()
    recordShinyStageStat(agg, mkStat({ isShiny: true }), 4, true)
    recordShinyStageStat(agg, mkStat({ isShiny: true }), 5, false)
    const rows = buildShinyStageRows(agg, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0].shiny.winRate).toBe(0.5)
  })
})

describe('unitStatAgg — no-shiny species produce no rows', () => {
  it('produces no rows for a species with plenty of ordinary fights but no shiny appearance', () => {
    const agg = new Map<string, UTierAcc>()
    for (let i = 0; i < 10; i++) {
      recordShinyStageStat(agg, mkStat({ defId: 'bellibolt', isShiny: false }), 4, true)
    }
    const rows = buildShinyStageRows(agg, 1)
    expect(rows).toHaveLength(0)
  })
})

describe('unitStatAgg — sample gating', () => {
  it('drops a species+stage whose shiny side has fewer fights than the minimum sample threshold', () => {
    const agg = new Map<string, UTierAcc>()
    recordShinyStageStat(agg, mkStat({ isShiny: true }), 4, true)
    const rowsBelow = buildShinyStageRows(agg, 2)
    expect(rowsBelow).toHaveLength(0)
    recordShinyStageStat(agg, mkStat({ isShiny: true }), 5, true)
    const rowsAt = buildShinyStageRows(agg, 2)
    expect(rowsAt).toHaveLength(1)
  })

  it('defaults to MIN_SHINY_STAGE_SAMPLES when no explicit threshold is passed', () => {
    const agg = new Map<string, UTierAcc>()
    for (let i = 0; i < MIN_SHINY_STAGE_SAMPLES - 1; i++) {
      recordShinyStageStat(agg, mkStat({ isShiny: true }), 4 + i, true)
    }
    expect(buildShinyStageRows(agg)).toHaveLength(0)
    recordShinyStageStat(agg, mkStat({ isShiny: true }), 4 + MIN_SHINY_STAGE_SAMPLES, true)
    expect(buildShinyStageRows(agg)).toHaveLength(1)
  })
})

describe('unitStatAgg — stat parity', () => {
  it('exposes exactly the same keys the per-star-level (perTier) block exposes', () => {
    const agg = new Map<string, UTierAcc>()
    recordShinyStageStat(agg, mkStat({ isShiny: true }), 4, true)
    recordShinyStageStat(agg, mkStat({ isShiny: true }), 5, true)
    const rows = buildShinyStageRows(agg, 1)
    const expectedKeys = [
      'fields', 'winRate', 'avgDealt', 'avgTaken', 'avgCasts', 'avgKills', 'avgDeaths',
      'avgHealSelf', 'avgHealAlly', 'avgShieldSelf', 'avgShieldAlly',
    ].sort()
    expect(Object.keys(rows[0].shiny).sort()).toEqual(expectedKeys)
  })
})

describe('unitStatAgg — full-stat carry-through', () => {
  it('carries heal/shield/casts/kills/deaths on the input stat to the correct avg* field', () => {
    const agg = new Map<string, UTierAcc>()
    recordShinyStageStat(agg, mkStat({
      isShiny: true, casts: 4, kills: 2, deaths: 1,
      healSelf: 30, healAlly: 20, shieldSelf: 10, shieldAlly: 5,
    }), 4, true)
    const rows = buildShinyStageRows(agg, 1)
    const side = rows[0].shiny
    expect(side.avgCasts).toBe(4)
    expect(side.avgKills).toBe(2)
    expect(side.avgDeaths).toBe(1)
    expect(side.avgHealSelf).toBe(30)
    expect(side.avgHealAlly).toBe(20)
    expect(side.avgShieldSelf).toBe(10)
    expect(side.avgShieldAlly).toBe(5)
  })
})

describe('unitStatAgg — addFightStat / newUTierAcc', () => {
  it('accumulates fights/wins/scalars/tallies/breaks identically regardless of caller', () => {
    const acc = newUTierAcc()
    addFightStat(acc, mkStat({ dealt: 100, taken: 50, casts: 1, kills: 1, deaths: 0 }), true)
    addFightStat(acc, mkStat({ dealt: 200, taken: 25, casts: 2, kills: 0, deaths: 1 }), false)
    expect(acc.fights).toBe(2)
    expect(acc.wins).toBe(1)
    expect(acc.dealt).toBe(300)
    expect(acc.taken).toBe(75)
    expect(acc.casts).toBe(3)
    expect(acc.kills).toBe(1)
    expect(acc.deaths).toBe(1)
  })
})
