import { describe, it, expect } from 'vitest'
import { emptyEcon } from './runState'
import { tierComposition, detectTierChanges } from './tierChanges'

describe('detectTierChanges', () => {
  it('a definitionId absent from before arriving at tier 1 is a spawn', () => {
    const before = new Map<string, number>()
    const after = new Map([['tangela', 1]])
    expect(detectTierChanges(before, after)).toEqual([
      { definitionId: 'tangela', tier: 1, kind: 'spawn' },
    ])
  })

  it('a definitionId at tier 1 arriving at tier 2 is a star-up', () => {
    const before = new Map([['tangela', 1]])
    const after = new Map([['tangela', 2]])
    expect(detectTierChanges(before, after)).toEqual([
      { definitionId: 'tangela', tier: 2, kind: 'star-up' },
    ])
  })

  it('a definitionId at tier 2 arriving at tier 3 is a star-up', () => {
    const before = new Map([['tangela', 2]])
    const after = new Map([['tangela', 3]])
    expect(detectTierChanges(before, after)).toEqual([
      { definitionId: 'tangela', tier: 3, kind: 'star-up' },
    ])
  })

  it('an unchanged tier yields no change (buying a second copy is silent)', () => {
    const before = new Map([['tangela', 1]])
    const after = new Map([['tangela', 1]])
    expect(detectTierChanges(before, after)).toEqual([])
  })

  it('a tier that went down (a sell) yields no change', () => {
    const before = new Map([['tangela', 2]])
    const after = new Map([['tangela', 1]])
    expect(detectTierChanges(before, after)).toEqual([])
  })

  it('an empty after yields an empty array', () => {
    const before = new Map([['tangela', 1]])
    const after = new Map<string, number>()
    expect(detectTierChanges(before, after)).toEqual([])
  })
})

describe('tierComposition', () => {
  it('highest tier wins when the same definitionId sits on bench and board at different tiers', () => {
    const e = emptyEcon('t', null)
    e.bench[0] = { definitionId: 'zubat', tier: 1 }
    e.board = [{ definitionId: 'zubat', tier: 2, hexPos: { col: 3, row: 5 } }]
    expect(tierComposition(e)).toEqual(new Map([['zubat', 2]]))
  })

  it('null bench slots are skipped without throwing', () => {
    const e = emptyEcon('t', null)
    e.bench[0] = null
    e.bench[1] = { definitionId: 'tangela', tier: 1 }
    expect(() => tierComposition(e)).not.toThrow()
    expect(tierComposition(e)).toEqual(new Map([['tangela', 1]]))
  })

  it('an undefined econ yields an empty map', () => {
    expect(tierComposition(undefined)).toEqual(new Map())
  })
})
