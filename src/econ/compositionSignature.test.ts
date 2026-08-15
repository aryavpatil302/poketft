import { describe, it, expect } from 'vitest'
import {
  establishedTraits, boardTraitSignature, traitDepths,
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
