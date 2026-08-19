import { describe, it, expect } from 'vitest'
import { captureDeadline, remainingMs, remainingSeconds, fractionRemaining } from './roomClock'
import type { RoomClock } from './roomClock'

// A canonical `phase` broadcast: a 30s planning budget, expressed the way
// party/lobby.ts's broadcastPhase expresses it — an absolute epoch deadline
// paired with the server's own Date.now() at send time.
const SERVER_NOW = 1_700_000_000_000
const BUDGET = 30_000
const PHASE_MSG = { deadline: SERVER_NOW + BUDGET, serverNow: SERVER_NOW }

describe('captureDeadline', () => {
  it('stores the server-side remaining budget and the local monotonic reading, never the absolute server timestamp', () => {
    const clock = captureDeadline(PHASE_MSG, 1234)!
    expect(clock.budgetMs).toBe(BUDGET)
    expect(clock.capturedAtMono).toBe(1234)
    // The absolute epoch timestamp must not survive into the clock — holding
    // it would invite a later comparison against a local Date.now().
    expect(Object.values(clock)).not.toContain(PHASE_MSG.deadline)
    expect(Object.values(clock)).not.toContain(PHASE_MSG.serverNow)
  })

  it('returns null for a phase message with deadline: null (any non-planning phase)', () => {
    expect(captureDeadline({ deadline: null, serverNow: SERVER_NOW }, 0)).toBeNull()
  })

  it('returns null rather than a NaN clock for non-finite timestamps', () => {
    expect(captureDeadline({ deadline: NaN, serverNow: SERVER_NOW }, 0)).toBeNull()
    expect(captureDeadline({ deadline: SERVER_NOW + BUDGET, serverNow: NaN }, 0)).toBeNull()
    expect(captureDeadline(PHASE_MSG, NaN)).toBeNull()
  })
})

describe('remainingMs', () => {
  it('counts the captured budget down against elapsed monotonic time', () => {
    const clock = captureDeadline(PHASE_MSG, 0)!
    expect(remainingMs(clock, 0)).toBe(30_000)
    expect(remainingMs(clock, 15_000)).toBe(15_000)
    expect(remainingMs(clock, 30_000)).toBe(0)
  })

  it('clamps at 0 and is never negative past the deadline', () => {
    const clock = captureDeadline(PHASE_MSG, 0)!
    expect(remainingMs(clock, 31_000)).toBe(0)
    expect(remainingMs(clock, 10_000_000)).toBe(0)
  })

  it('clamps a server deadline that has already passed to 0 rather than reporting negative time', () => {
    const stale = captureDeadline({ deadline: SERVER_NOW - 5_000, serverNow: SERVER_NOW }, 0)!
    expect(remainingMs(stale, 0)).toBe(0)
  })

  it('is identical for two clients whose local monotonic origins differ by an hour (clock skew)', () => {
    // The same `phase` message received by two machines whose clocks disagree
    // wildly. Only the LOCAL elapsed interval may influence the answer.
    const HOUR = 3_600_000
    const onTime = captureDeadline(PHASE_MSG, 0)!
    const skewed = captureDeadline(PHASE_MSG, HOUR)!

    for (const elapsed of [0, 1, 999, 15_000, 29_999, 30_000, 45_000]) {
      expect(remainingMs(skewed, HOUR + elapsed)).toBe(remainingMs(onTime, elapsed))
      expect(remainingSeconds(skewed, HOUR + elapsed)).toBe(remainingSeconds(onTime, elapsed))
      expect(fractionRemaining(skewed, HOUR + elapsed)).toBe(fractionRemaining(onTime, elapsed))
    }
  })

  it('returns 0 for a null clock', () => {
    expect(remainingMs(null, 12_345)).toBe(0)
  })
})

describe('remainingSeconds', () => {
  it('reads the full budget the instant the phase opens and only reaches 0 when the budget is genuinely spent', () => {
    const clock = captureDeadline(PHASE_MSG, 0)!
    expect(remainingSeconds(clock, 0)).toBe(30)
    expect(remainingSeconds(clock, 1)).toBe(30)
    expect(remainingSeconds(clock, 29_001)).toBe(1)
    expect(remainingSeconds(clock, 29_999)).toBe(1)
    expect(remainingSeconds(clock, 30_000)).toBe(0)
    expect(remainingSeconds(clock, 31_000)).toBe(0)
  })

  it('returns 0 for a null clock', () => {
    expect(remainingSeconds(null, 12_345)).toBe(0)
  })
})

describe('fractionRemaining', () => {
  it('is 1 at capture, 0 at the deadline, and never leaves [0, 1]', () => {
    const clock = captureDeadline(PHASE_MSG, 0)!
    expect(fractionRemaining(clock, 0)).toBe(1)
    expect(fractionRemaining(clock, 15_000)).toBeCloseTo(0.5, 10)
    expect(fractionRemaining(clock, 30_000)).toBe(0)
    expect(fractionRemaining(clock, 60_000)).toBe(0)

    for (const t of [-5_000, 0, 7, 15_000, 30_000, 30_001, 1_000_000]) {
      const f = fractionRemaining(clock, t)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
      expect(Number.isFinite(f)).toBe(true)
    }
  })

  it('never divides by zero on a degenerate zero-length budget', () => {
    const zero: RoomClock = { budgetMs: 0, capturedAtMono: 0 }
    expect(fractionRemaining(zero, 0)).toBe(0)
    expect(Number.isFinite(fractionRemaining(zero, 5))).toBe(true)
  })

  it('returns 0 for a null clock', () => {
    expect(fractionRemaining(null, 12_345)).toBe(0)
  })
})
