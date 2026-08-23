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

// The ONE validator for a room host, with TWO callers: this module at runtime
// and the `require-room-host` build guard in vite.config.ts. Living in one
// place is what stops the guard and the client ever disagreeing about what a
// valid host looks like.
//
// A room host is a bare `host[:port]` and nothing more — roomClient.ts hands
// the value straight to `new PartySocket({ host, ... })`, which derives the
// rest itself. Each rejection below is load-bearing:
//   - a `://` scheme     partysocket prepends its own ws:/wss:, and a doubled
//                        scheme produces an unopenable URL.
//   - a `/` path segment partysocket appends its own `/parties/main/<room>`.
//   - whitespace         a stray space or newline from a copy-pasted env value
//                        would otherwise survive into the connection URL.
//   - uppercase and `_`  neither is legal in a hostname, and rejecting them is
//                        what makes Plan 05-02's netlify.toml placeholder
//                        REPLACE_ME_AFTER_PARTYKIT_DEPLOY self-invalidating:
//                        an un-edited placeholder fails the build rather than
//                        shipping a bundle that points nowhere.
export function isValidRoomHost(value: string): boolean {
  return /^[a-z0-9.-]+(:\d+)?$/.test(value)
}

// VITE_PARTY_HOST is set at build time (Phase 5) to the deployed room host.
//
// TWO properties of this signature are load-bearing. Do not "tidy" either one:
//
// 1. The env read must stay ONE un-aliased `import.meta.env.VITE_PARTY_HOST`
//    expression, because Vite substitutes that exact source text at transform
//    time. Assigning `import.meta` (or `import.meta.env`) to a local first
//    defeats the substitution: the alias is emitted verbatim into the bundle,
//    a browser's `import.meta` has no `env`, the optional chain yields
//    undefined, and every deployed client silently falls back to
//    `<deployed-domain>:1999`. That was this file's previous shape and the
//    exact defect Plan 05-01 fixes. Written as below, `vite build` inlines the
//    literal instead — pinned end-to-end by that plan's bundle grep.
// 2. Taking the value as a defaulted PARAMETER is what makes both branches
//    unit-testable — the same idiom `newLobbyCode(rng = Math.random)` above
//    uses, for the same reason. It is not optional here: `vi.stubEnv` cannot
//    reach the expression at all (Vite has already replaced it by the time the
//    stub exists), so an explicit argument is the only way a test can drive
//    the configured branch.
//
// The optional chaining keeps a non-Vite runtime — tsx running scripts/, or
// vitest — seeing `undefined` rather than throwing on a missing `env`.
export function partyHost(
  configured = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PARTY_HOST,
): string {
  if (configured) return configured
  // globalThis.location is absent outside a browser; fall back to loopback
  // rather than throwing, so importing this module from Node stays safe.
  const hostname = globalThis.location?.hostname ?? '127.0.0.1'
  return `${hostname}:${PARTY_DEV_PORT}`
}
