import { describe, it, expect } from 'vitest'
import { HUMAN_CHARACTER_NAMES, pickRandomNames } from './botNames'
import { botSeats, PERSONAS } from './bots'

describe('botNames', () => {
  it('has 50 distinct names', () => {
    expect(HUMAN_CHARACTER_NAMES.length).toBe(50)
    expect(new Set(HUMAN_CHARACTER_NAMES).size).toBe(50)
  })

  it('picks the requested count with no duplicates', () => {
    const picked = pickRandomNames(5, () => 0.5)
    expect(picked).toHaveLength(5)
    expect(new Set(picked).size).toBe(5)
    for (const name of picked) expect(HUMAN_CHARACTER_NAMES).toContain(name)
  })

  it('is deterministic for a fixed rng', () => {
    const a = pickRandomNames(5, () => 0.3)
    const b = pickRandomNames(5, () => 0.3)
    expect(a).toEqual(b)
  })
})

describe('botSeats', () => {
  it('keeps stable personaIds with randomized display names', () => {
    const seats = botSeats()
    expect(seats.map(s => s.personaId)).toEqual(PERSONAS.map(p => p.id))
    for (const seat of seats) expect(HUMAN_CHARACTER_NAMES).toContain(seat.name)
  })

  it('never assigns the same display name to two bots in one game', () => {
    const seats = botSeats()
    expect(new Set(seats.map(s => s.name)).size).toBe(seats.length)
  })
})
