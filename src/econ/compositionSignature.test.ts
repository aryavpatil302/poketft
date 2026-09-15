import { describe, it, expect } from 'vitest'
import {
  establishedTraits, boardTraitSignature, traitDepths, traitCostWeight,
  catalogEntryLevelNeeded, nearMissCatalogEntries,
} from './compositionSignature'
import { UNIT_MAP } from '../data/units'
import { getThresholds } from '../enemy/boardPower'

describe('splash-trait exclusion', () => {
  // A board with a splash-trait legendary (Tapu Koko: shock_spirit + quickclaw)
  // plus enough other units to make quickclaw (threshold 2) and crashout
  // (threshold 2) genuinely active, with crashout the clear leader by count.
  const board = [
    { definitionId: 'tapu_koko' },   // shock_spirit + quickclaw
    { definitionId: 'blastoise' },   // beachy + quickclaw → quickclaw reaches 2
    { definitionId: 'vigoroth' },    // crashout
    { definitionId: 'talonflame' },  // crashout
    { definitionId: 'drednaw' },     // crashout + river → crashout reaches 3
  ]

  it('excludes shock_spirit from established (active) traits', () => {
    const active = establishedTraits(board)
    expect(active).toContain('quickclaw')
    expect(active).toContain('crashout')
    expect(active).not.toContain('shock_spirit')
  })

  it('excludes shock_spirit from the board trait signature', () => {
    expect(boardTraitSignature(board)).toBe('crashout+quickclaw')
  })

  it('excludes shock_spirit from trait-depth tracking', () => {
    const depths = traitDepths(board)
    expect(depths.some(d => d.trait === 'shock_spirit')).toBe(false)
    expect(depths.some(d => d.trait === 'quickclaw')).toBe(true)
    expect(depths.some(d => d.trait === 'crashout')).toBe(true)
  })

  it('does not exclude a real trait with a small-but-legitimate roster (river, 4 carriers)', () => {
    // river's carriers: drednaw, bellibolt, quagsire, barraskewda — 4 species,
    // well clear of the ≤2-carrier splash-trait threshold.
    const riverBoard = [
      { definitionId: 'drednaw' },
      { definitionId: 'bellibolt' },
    ]
    expect(establishedTraits(riverBoard)).toContain('river')
  })

  it('canary: the splash-trait set is exactly the expected 7 traits', () => {
    // Re-derives the same rule the module uses internally (≤2 carrier
    // species, active at count 1) so this fails loudly — instead of the
    // exclusion silently drifting — if a future trait is added shaped the
    // same way (or an existing one's roster changes).
    const carriers = new Map<string, Set<string>>()
    for (const def of UNIT_MAP.values()) {
      for (const t of def.types) {
        if (!carriers.has(t)) carriers.set(t, new Set())
        carriers.get(t)!.add(def.id)
      }
    }
    const splash = new Set<string>()
    for (const [t, species] of carriers) {
      if (species.size <= 2 && getThresholds(t)[0] === 1) splash.add(t)
    }
    expect([...splash].sort()).toEqual([
      'earth_spirit', 'mind_spirit', 'rogue', 'shock_spirit', 'soul_bonded', 'wave_spirit', 'zen',
    ])
  })
})

describe('traitCostWeight', () => {
  // jungle carriers span the full cost range: tangela(1)/ribombee(1) ...
  // tapu_bulu(5) — good spread for testing the cost interpolation.
  it('weights a trait built entirely from cheap units near 1.0', () => {
    const board = [{ definitionId: 'tangela' }, { definitionId: 'ribombee' }]
    expect(traitCostWeight('jungle', board)).toBeCloseTo(1.0)
  })

  it('weights a trait built entirely from 5-cost units at the discount floor', () => {
    const board = [{ definitionId: 'tapu_bulu' }]
    expect(traitCostWeight('jungle', board)).toBeCloseTo(0.35)
  })

  it('interpolates for a mixed-cost trait', () => {
    // tangela(1) + tapu_bulu(5) → avg cost 3 → halfway between 1.0 and 0.35
    const board = [{ definitionId: 'tangela' }, { definitionId: 'tapu_bulu' }]
    expect(traitCostWeight('jungle', board)).toBeCloseTo(0.675)
  })

  it('defaults to full weight when the trait has no members on the board', () => {
    const board = [{ definitionId: 'tangela' }]
    expect(traitCostWeight('beachy', board)).toBe(1.0)
  })

  it('does not double-count duplicate copies of the same species', () => {
    const single = traitCostWeight('jungle', [{ definitionId: 'tapu_bulu' }])
    const doubled = traitCostWeight('jungle', [{ definitionId: 'tapu_bulu' }, { definitionId: 'tapu_bulu' }])
    expect(doubled).toBeCloseTo(single)
  })
})

describe('catalogEntryLevelNeeded', () => {
  it('a cost-1 core needs level 1', () => {
    expect(catalogEntryLevelNeeded({ coreUnitIds: ['tangela'] })).toBe(1)
  })

  it('a cost-5 core needs level 9', () => {
    expect(catalogEntryLevelNeeded({ coreUnitIds: ['latios'] })).toBe(9)
  })

  it('takes the max across multiple core units', () => {
    expect(catalogEntryLevelNeeded({ coreUnitIds: ['tangela', 'latios'] })).toBe(9)
  })
})

describe('nearMissCatalogEntries', () => {
  it('never counts a single-core entry as a near miss (no partial progress is possible)', () => {
    // An empty board trivially "misses 1" of every single-core entry — that's
    // not genuine progress, so it must never surface as a tempo opportunity.
    const results = nearMissCatalogEntries(new Set(), 1)
    expect(results.some(r => r.entry.id === 'carry|latios')).toBe(false)
  })

  it('excludes a fully-owned entry (nothing missing)', () => {
    const results = nearMissCatalogEntries(new Set(['latios']), 1)
    expect(results.some(r => r.entry.id === 'carry|latios')).toBe(false)
  })

  it('excludes a two-core entry missing both units when maxMissing is 1', () => {
    const results = nearMissCatalogEntries(new Set(), 1)
    expect(results.some(r => r.entry.id === 'carry|latios|var|charizard')).toBe(false)
  })

  it('includes a two-core entry missing exactly one unit', () => {
    const results = nearMissCatalogEntries(new Set(['latios']), 1)
    const hit = results.find(r => r.entry.id === 'carry|latios|var|charizard')
    expect(hit?.missing).toEqual(['charizard'])
  })
})
