import { describe, it, expect } from 'vitest'
import {
  LOBBY_CODE_ALPHABET, LOBBY_CODE_LENGTH,
  newLobbyCode, isLobbyCode, parseLobbyCode, shareableLobbyUrl,
  isValidRoomHost, partyHost,
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

describe('isValidRoomHost', () => {
  it('accepts a deployed PartyKit host', () => {
    expect(isValidRoomHost('poketft.someuser.partykit.dev')).toBe(true)
  })

  // The two dev forms partyHost() falls back to, so the build guard can never
  // reject the very host the fallback would produce.
  it('accepts the dev host:port forms', () => {
    expect(isValidRoomHost('127.0.0.1:1999')).toBe(true)
    expect(isValidRoomHost('localhost:1999')).toBe(true)
  })

  it('rejects the empty string', () => {
    expect(isValidRoomHost('')).toBe(false)
  })

  // partysocket prepends its own ws:/wss:; a doubled scheme is unopenable.
  it('rejects a value carrying a scheme', () => {
    expect(isValidRoomHost('https://poketft.someuser.partykit.dev')).toBe(false)
  })

  // partysocket appends its own /parties/main/<room>, so any path the value
  // carries — even a bare trailing slash — corrupts the connection URL.
  it('rejects a trailing slash', () => {
    expect(isValidRoomHost('poketft.someuser.partykit.dev/')).toBe(false)
  })

  it('rejects a path segment', () => {
    expect(isValidRoomHost('poketft.someuser.partykit.dev/parties/main')).toBe(false)
  })

  it('rejects a value containing a space', () => {
    expect(isValidRoomHost('poketft.someuser partykit.dev')).toBe(false)
  })

  // Plan 05-02 writes this literal into netlify.toml as the value a deployer
  // must replace. Rejecting uppercase and underscores is what makes it
  // self-invalidating: an un-edited placeholder fails the build instead of
  // shipping a bundle that points nowhere. Not an arbitrary string — this is
  // the check that keeps that placeholder honest.
  it('rejects the netlify.toml placeholder Plan 05-02 writes', () => {
    expect(isValidRoomHost('REPLACE_ME_AFTER_PARTYKIT_DEPLOY')).toBe(false)
  })

  it('rejects every malformed form in one sweep', () => {
    const offenders = [
      '', 'https://x.partykit.dev', 'ws://x.partykit.dev', 'x.partykit.dev/',
      'x.partykit.dev/parties/main', 'x partykit.dev', 'x.partykit.dev\n',
      'X.PartyKit.dev', 'REPLACE_ME_AFTER_PARTYKIT_DEPLOY',
    ].filter(value => isValidRoomHost(value))
    expect(offenders).toEqual([])
  })
})

// partyHost is driven by an explicit argument rather than vitest's env
// stubbing: Vite substitutes the `import.meta.env` expression at transform
// time, so a stub mutates a different object and never reaches it. The
// defaulted parameter exists precisely so both branches are testable without
// touching the environment — which is also what keeps this suite's result
// independent of whether VITE_PARTY_HOST happens to be set in the shell. The
// configured branch's real end-to-end proof is Plan 05-01's bundle grep.
describe('partyHost', () => {
  it('returns a configured host unchanged', () => {
    expect(partyHost('poketft.someuser.partykit.dev')).toBe('poketft.someuser.partykit.dev')
  })

  // globalThis.location is absent under vitest, so the fallback resolves to
  // loopback rather than throwing.
  it('falls back to loopback rather than returning an empty host', () => {
    expect(partyHost('')).toBe('127.0.0.1:1999')
  })

  // src/main.ts calls partyHost() with no argument. Asserting the two spellings
  // agree pins that production call site to the same default-parameter path
  // these tests drive, without asserting a literal that would depend on whether
  // VITE_PARTY_HOST happens to be set in the shell running vitest — it is, in
  // fact, ambient-dependent here, because vitest surfaces VITE_-prefixed
  // process.env vars on import.meta.env. The exact fallback host is pinned by
  // the partyHost('') case above instead.
  it('treats an omitted argument and an explicit undefined identically', () => {
    expect(partyHost()).toBe(partyHost(undefined))
  })

  it('produces a host its own validator accepts on both branches', () => {
    expect(isValidRoomHost(partyHost('poketft.someuser.partykit.dev'))).toBe(true)
    expect(isValidRoomHost(partyHost(''))).toBe(true)
  })
})
