import { describe, it, expect } from 'vitest'
import { GUEST_NAMES, pickGuestName } from './guestNames'
// Imported from the real modules, not copied: the disjointness property is
// only worth anything if it is checked against the lists the game actually
// uses, so that adding a persona or a trainer name breaks this test rather
// than silently making a human seat look like a bot.
import { PERSONAS } from '../econ/bots'
import { HUMAN_CHARACTER_NAMES } from '../econ/botNames'

describe('GUEST_NAMES', () => {
  it('shares no entry with any bot persona name (case-insensitively)', () => {
    const personaNames = new Set(PERSONAS.map(p => p.name.toLowerCase()))
    const collisions = GUEST_NAMES.filter(n => personaNames.has(n.toLowerCase()))
    expect(collisions).toEqual([])
  })

  it('shares no entry with the bots\' trainer display names (case-insensitively)', () => {
    const trainerNames = new Set(HUMAN_CHARACTER_NAMES.map(n => n.toLowerCase()))
    const collisions = GUEST_NAMES.filter(n => trainerNames.has(n.toLowerCase()))
    expect(collisions).toEqual([])
  })

  it('has at least 8 entries so a 2-human lobby practically never collides', () => {
    expect(GUEST_NAMES.length).toBeGreaterThanOrEqual(8)
  })

  it('is made of short single words', () => {
    for (const name of GUEST_NAMES) {
      expect(name).toMatch(/^[A-Z][a-z]{2,11}$/)
    }
  })

  it('has no duplicate entries', () => {
    expect(new Set(GUEST_NAMES.map(n => n.toLowerCase())).size).toBe(GUEST_NAMES.length)
  })
})

describe('pickGuestName', () => {
  it('yields the first entry for an rng of 0', () => {
    expect(pickGuestName(() => 0)).toBe(GUEST_NAMES[0])
  })

  it('yields the last entry for an rng just under 1', () => {
    expect(pickGuestName(() => 0.999999)).toBe(GUEST_NAMES[GUEST_NAMES.length - 1])
  })

  it('never returns undefined for any rng output across [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const r = i / 1000
      const name = pickGuestName(() => r)
      expect(typeof name).toBe('string')
      expect(GUEST_NAMES).toContain(name)
    }
  })

  // An rng that returns exactly 1.0 is outside the contract but is exactly
  // the off-by-one that would append `undefined` to a lobby list.
  it('does not index past the end for a degenerate rng of exactly 1', () => {
    expect(GUEST_NAMES).toContain(pickGuestName(() => 1))
  })

  it('defaults to Math.random and still returns a pool entry', () => {
    for (let i = 0; i < 50; i++) expect(GUEST_NAMES).toContain(pickGuestName())
  })
})
