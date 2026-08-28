import { describe, it, expect } from 'vitest'
import { displayedOpponentSeat, displayedRound } from './opponentView'

describe('displayedOpponentSeat', () => {
  it('planning returns the pairing preview value', () => {
    expect(displayedOpponentSeat(false, 0, 4, 2)).toBe(4)
  })

  it('combat returns the captured fight seat (regression case: deliberately differs from the preview)', () => {
    expect(displayedOpponentSeat(true, 0, 4, 2)).toBe(2)
  })

  it('combat with no fight opponent (bye, creep round, Delibird round) is -1', () => {
    expect(displayedOpponentSeat(true, 0, 4, -1)).toBe(-1)
  })

  it('planning with an undefined pairing preview is -1', () => {
    expect(displayedOpponentSeat(false, 0, undefined, 3)).toBe(-1)
  })

  it('a seat equal to localSeat is rejected', () => {
    expect(displayedOpponentSeat(true, 2, 5, 2)).toBe(-1)
  })

  it('a non-zero local seat facing seat 0 is accepted', () => {
    expect(displayedOpponentSeat(true, 1, 3, 0)).toBe(0)
  })
})

describe('displayedRound', () => {
  it('planning returns the live value', () => {
    expect(displayedRound(false, 7, 6)).toBe(7)
  })

  it('combat returns the captured value', () => {
    expect(displayedRound(true, 7, 6)).toBe(6)
  })

  it('combat before any round has been captured falls back to the live value', () => {
    expect(displayedRound(true, 7, -1)).toBe(7)
  })
})
