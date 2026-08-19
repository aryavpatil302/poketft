import { describe, it, expect } from 'vitest'
import {
  LOBBY_CODE_ALPHABET, LOBBY_CODE_LENGTH,
  newLobbyCode, isLobbyCode, parseLobbyCode, shareableLobbyUrl,
} from './lobbyUrl'

// Same LCG idiom fightWire.test.ts uses — a reproducible generator so the
// alphabet property below is asserted over a fixed, replayable draw sequence
// rather than whatever Math.random happened to produce.
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('newLobbyCode', () => {
  it('returns a code of exactly LOBBY_CODE_LENGTH characters', () => {
    expect(newLobbyCode().length).toBe(LOBBY_CODE_LENGTH)
  })

  it('draws only from LOBBY_CODE_ALPHABET across 1000 seeded draws', () => {
    const rng = seededRng(20260819)
    const offenders: string[] = []
    for (let i = 0; i < 1000; i++) {
      const code = newLobbyCode(rng)
      expect(code.length).toBe(LOBBY_CODE_LENGTH)
      for (const ch of code) {
        if (!LOBBY_CODE_ALPHABET.includes(ch)) offenders.push(`${code}:${ch}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('produces codes its own validator accepts', () => {
    const rng = seededRng(7)
    for (let i = 0; i < 100; i++) expect(isLobbyCode(newLobbyCode(rng))).toBe(true)
  })
})

describe('isLobbyCode', () => {
  it('rejects the empty string', () => {
    expect(isLobbyCode('')).toBe(false)
  })

  it('rejects a code one character short', () => {
    expect(isLobbyCode('abc23')).toBe(false)
  })

  it('rejects a code one character long', () => {
    expect(isLobbyCode('abc2345')).toBe(false)
  })

  // The five characters the alphabet deliberately omits, because they are the
  // ones people mishear or mistype when a code is read aloud.
  it('rejects codes containing i, l, o, 0 or 1', () => {
    expect(isLobbyCode('abci23')).toBe(false)
    expect(isLobbyCode('abcl23')).toBe(false)
    expect(isLobbyCode('abco23')).toBe(false)
    expect(isLobbyCode('abc023')).toBe(false)
    expect(isLobbyCode('abc123')).toBe(false)
  })

  it('accepts a well-formed code', () => {
    expect(isLobbyCode('abc234')).toBe(true)
  })
})

describe('parseLobbyCode', () => {
  it('returns null for an empty search string', () => {
    expect(parseLobbyCode('')).toBeNull()
  })

  it('returns null for a present-but-empty lobby param', () => {
    expect(parseLobbyCode('?lobby=')).toBeNull()
  })

  it('lowercases a valid code', () => {
    expect(parseLobbyCode('?lobby=ABC234')).toBe('abc234')
  })

  it('returns null for a too-short code', () => {
    expect(parseLobbyCode('?lobby=zz')).toBeNull()
  })

  it('returns null when the lobby param is absent', () => {
    expect(parseLobbyCode('?other=abc234')).toBeNull()
  })

  // T-04-02: the parsed value becomes a PartyKit room name, so anything
  // carrying path or protocol characters must never survive this call.
  it('returns null for a code carrying path or protocol characters', () => {
    expect(parseLobbyCode('?lobby=../etc')).toBeNull()
    expect(parseLobbyCode('?lobby=' + encodeURIComponent('a/b/c1'))).toBeNull()
  })
})

describe('shareableLobbyUrl', () => {
  it('builds the link the host hands to a friend', () => {
    expect(shareableLobbyUrl('http://localhost:5173', 'abc234'))
      .toBe('http://localhost:5173/?lobby=abc234')
  })

  it('round-trips back through parseLobbyCode', () => {
    const code = 'qrs789'
    const url = shareableLobbyUrl('https://example.com', code)
    expect(parseLobbyCode(url.slice(url.indexOf('?')))).toBe(code)
  })
})
