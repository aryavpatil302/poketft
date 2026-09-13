// ─── Test scenario persistence (cookie-backed) ────────────────────────────────
//
// Saved test-mode boards used to live in localStorage; they now live in a
// single cookie. This module owns both the scenario shapes and the cookie
// read/write boundary so main.ts never touches `document.cookie` directly.

// Each unit stores its own team so snapshots and built-in tests share one
// format. Byte-identical to the shape main.ts used to declare inline, so
// src/repoTests.ts's structurally-typed RepoTestUnit/RepoTestScenario keep
// compiling untouched.
export interface TestUnit { id: string; tier: 1|2|3; col: number; row: number; team: 'player'|'enemy' }
export interface TestScenario { label: string; units: TestUnit[] }

// The jar is injected rather than reaching for `document` directly, because
// Vitest runs with `environment: 'node'` (vite.config.ts) and neither jsdom
// nor happy-dom is installed — there is no `document` in tests. The default
// jar below only touches `document` inside its arrow-function bodies (never
// at module scope), so importing this file under Vitest cannot throw.
export interface CookieJar { read(): string; write(serialized: string): void }

export const SAVED_TESTS_COOKIE = 'pokeTFT_saved_tests'

// 400 days: comfortably past the ceiling (~400 days) modern browsers clamp
// `Max-Age` to anyway, so this reads as "as long as the browser will allow"
// without lying about a longer lifetime.
export const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

// 4000, not 4096: headroom for the `Path=/; Max-Age=...; SameSite=Lax`
// attributes, which some browsers count against the same per-cookie budget
// as the name=value pair itself.
export const COOKIE_BYTE_BUDGET = 4000

export type SaveResult = { ok: true } | { ok: false; reason: 'too-large'; bytes: number; budget: number }

const defaultJar: CookieJar = {
  read: () => document.cookie,
  write: (serialized: string) => { document.cookie = serialized },
}

function readCookieValue(jarString: string, name: string): string | null {
  for (const part of jarString.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1)
  }
  return null
}

export function readSavedTests(jar: CookieJar = defaultJar): TestScenario[] {
  const raw = readCookieValue(jar.read(), SAVED_TESTS_COOKIE)
  if (raw === null || raw === '') return []
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeSavedTests(scenarios: TestScenario[], jar: CookieJar = defaultJar): SaveResult {
  const encoded = encodeURIComponent(JSON.stringify(scenarios))
  // Budget is measured on the encoded string: encodeURIComponent output is
  // pure ASCII, so its character length equals its byte count, and it's the
  // encoded form that actually decides whether the board fits in the cookie.
  const bytes = SAVED_TESTS_COOKIE.length + 1 + encoded.length
  if (bytes > COOKIE_BYTE_BUDGET) {
    // Refuse rather than attempt: a browser silently dropping an over-long
    // cookie would destroy every previously saved board, not just the new
    // one, so we bail out before calling jar.write at all.
    return { ok: false, reason: 'too-large', bytes, budget: COOKIE_BYTE_BUDGET }
  }
  jar.write(`${SAVED_TESTS_COOKIE}=${encoded}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`)
  return { ok: true }
}
