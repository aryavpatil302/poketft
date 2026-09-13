import { describe, it, expect } from 'vitest'
import {
  readSavedTests,
  writeSavedTests,
  SAVED_TESTS_COOKIE,
  COOKIE_MAX_AGE_SECONDS,
  COOKIE_BYTE_BUDGET,
  type TestScenario,
  type CookieJar,
} from './testScenarioStore'

// A fake CookieJar that mirrors what a real browser retains: writing a
// `name=value; Path=/; ...` string only keeps the `name=value` pair (the
// attributes are consumed by the browser, never handed back on read).
function fakeJar(initial = ''): CookieJar & { writes: string[]; store: string } {
  const jar = {
    store: initial,
    writes: [] as string[],
    read: () => jar.store,
    write: (serialized: string) => {
      jar.writes.push(serialized)
      jar.store = serialized.split(';')[0]
    },
  }
  return jar
}

describe('testScenarioStore', () => {
  it('round trips saved scenarios through write then read', () => {
    const jar = fakeJar()
    const scenarios: TestScenario[] = [
      { label: 'a', units: [{ id: 'pikachu', tier: 1, col: 0, row: 4, team: 'player' }] },
    ]
    const result = writeSavedTests(scenarios, jar)
    expect(result).toEqual({ ok: true })
    expect(readSavedTests(jar)).toEqual(scenarios)
  })

  it('returns [] for an empty jar', () => {
    expect(readSavedTests(fakeJar())).toEqual([])
  })

  it('returns [] when the cookie value is not JSON', () => {
    const jar = fakeJar(`${SAVED_TESTS_COOKIE}=not-json`)
    expect(readSavedTests(jar)).toEqual([])
  })

  it('returns [] when the cookie value parses to a non-array', () => {
    const jar = fakeJar(`${SAVED_TESTS_COOKIE}=${encodeURIComponent(JSON.stringify({}))}`)
    expect(readSavedTests(jar)).toEqual([])
  })

  it('survives a label containing ";", "=" and ","', () => {
    const jar = fakeJar()
    const scenarios: TestScenario[] = [{ label: 'a;b=c,d', units: [] }]
    writeSavedTests(scenarios, jar)
    expect(readSavedTests(jar)).toEqual(scenarios)
  })

  it('selects the exact cookie name, not a decoy whose name contains it as a substring', () => {
    const scenarios: TestScenario[] = [{ label: 'real', units: [] }]
    const encoded = encodeURIComponent(JSON.stringify(scenarios))
    const decoy = `${SAVED_TESTS_COOKIE}_extra=decoyvalue`
    const jar = fakeJar(`${decoy}; ${SAVED_TESTS_COOKIE}=${encoded}`)
    expect(readSavedTests(jar)).toEqual(scenarios)
  })

  it('accepts a save exactly at the byte budget', () => {
    const jar = fakeJar()
    const zeroLengthEncoded = encodeURIComponent(JSON.stringify([{ label: '', units: [] }]))
    const overhead = SAVED_TESTS_COOKIE.length + 1 + zeroLengthEncoded.length
    const label = 'A'.repeat(COOKIE_BYTE_BUDGET - overhead)
    const result = writeSavedTests([{ label, units: [] }], jar)
    expect(result).toEqual({ ok: true })
  })

  it('rejects a save one byte over the budget', () => {
    const jar = fakeJar()
    const zeroLengthEncoded = encodeURIComponent(JSON.stringify([{ label: '', units: [] }]))
    const overhead = SAVED_TESTS_COOKIE.length + 1 + zeroLengthEncoded.length
    const label = 'A'.repeat(COOKIE_BYTE_BUDGET - overhead + 1)
    const result = writeSavedTests([{ label, units: [] }], jar)
    expect(result).toEqual({ ok: false, reason: 'too-large', bytes: COOKIE_BYTE_BUDGET + 1, budget: COOKIE_BYTE_BUDGET })
  })

  it('leaves an existing saved set byte-identical when an over-budget write is rejected', () => {
    const jar = fakeJar()
    const existing: TestScenario[] = [
      { label: 'keep-me', units: [{ id: 'pikachu', tier: 1, col: 0, row: 4, team: 'player' }] },
    ]
    writeSavedTests(existing, jar)
    const storeBefore = jar.store
    const writeCountBefore = jar.writes.length

    const huge: TestScenario[] = [{ label: 'A'.repeat(10000), units: [] }]
    const result = writeSavedTests(huge, jar)

    expect(result.ok).toBe(false)
    expect(jar.store).toBe(storeBefore)
    expect(jar.writes.length).toBe(writeCountBefore)
    expect(readSavedTests(jar)).toEqual(existing)
  })

  it('writes Path=/ and a Max-Age onto the cookie string', () => {
    const jar = fakeJar()
    writeSavedTests([{ label: 'x', units: [] }], jar)
    expect(jar.writes[0]).toContain('Path=/')
    expect(jar.writes[0]).toContain(`Max-Age=${COOKIE_MAX_AGE_SECONDS}`)
  })
})
