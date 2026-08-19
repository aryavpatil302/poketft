// Lobby codes and the shareable link that carries them. Pure string work —
// nothing here reads the DOM, so every function is testable in vitest with
// no browser (parseLobbyCode takes the search string as a parameter for
// exactly that reason). partyHost() is the one exception and degrades
// gracefully outside a browser.

// ─── Lobby codes ──────────────────────────────────────────────────────────────

// Deliberately omits i, l, o, 0 and 1: a code gets read aloud over voice chat
// and retyped by hand, and those five are the characters people confuse. 31
// symbols over 6 positions is ~887M combinations — far more than enough for
// concurrent rooms, and short enough to dictate.
export const LOBBY_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const LOBBY_CODE_LENGTH = 6

// rng is a parameter (defaulting to Math.random) so a test can drive this
// from a seeded generator and assert the alphabet constraint over many draws.
export function newLobbyCode(rng: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < LOBBY_CODE_LENGTH; i++) {
    // The modulo is a guard, not arithmetic: an rng returning exactly 1.0
    // would otherwise index one past the end and append `undefined`.
    const index = Math.floor(rng() * LOBBY_CODE_ALPHABET.length) % LOBBY_CODE_ALPHABET.length
    code += LOBBY_CODE_ALPHABET[index]
  }
  return code
}

export function isLobbyCode(value: string): boolean {
  if (value.length !== LOBBY_CODE_LENGTH) return false
  for (const ch of value) {
    if (!LOBBY_CODE_ALPHABET.includes(ch)) return false
  }
  return true
}

// Trust boundary (T-04-02): the returned value becomes a PartyKit room name,
// so it is validated against the fixed alphabet BEFORE it is ever used. A
// crafted `?lobby=` cannot inject path separators, protocol characters, or
// anything else into the connection URL — it either matches the alphabet
// exactly or this returns null and the client stays on the solo path.
export function parseLobbyCode(search: string): string | null {
  const raw = new URLSearchParams(search).get('lobby')
  if (raw === null) return null
  const code = raw.toLowerCase()
  return isLobbyCode(code) ? code : null
}

export function shareableLobbyUrl(origin: string, code: string): string {
  return `${origin}/?lobby=${code}`
}

// ─── Room host ────────────────────────────────────────────────────────────────

// `partykit dev` serves on port 1999 of whatever host the page came from, so
// the default works for localhost and a LAN address alike with no config.
const PARTY_DEV_PORT = 1999

// VITE_PARTY_HOST is set in Phase 5 to the deployed room host. Read through a
// locally-widened `import.meta` (this project does not pull in vite/client
// types) with optional chaining throughout, so a non-Vite runtime — tsx
// running scripts/, or vitest — sees `undefined` rather than throwing on a
// missing `env`.
export function partyHost(): string {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  const configured = meta.env?.VITE_PARTY_HOST
  if (configured) return configured
  // globalThis.location is absent outside a browser; fall back to loopback
  // rather than throwing, so importing this module from Node stays safe.
  const hostname = globalThis.location?.hostname ?? '127.0.0.1'
  return `${hostname}:${PARTY_DEV_PORT}`
}
