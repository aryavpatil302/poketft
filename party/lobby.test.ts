import { describe, it, expect } from 'vitest'
import { combatPlaybackMs, computeStageWindowMs } from './lobby'
import { OVERTIME_START_TICK, TICK_RATE } from '../src/core/constants'
import type { FightLog } from '../src/game/round'

// Minimal FightLog fixture — combatPlaybackMs/computeStageWindowMs only ever
// read .frames.length, so nothing else needs to be realistic here.
function logOf(frameCount: number): FightLog {
  return { frames: Array(frameCount).fill(null) } as unknown as FightLog
}

describe('combatPlaybackMs', () => {
  it('a fight under the overtime threshold plays back at exactly 1x real time', () => {
    // 900 ticks at TICK_RATE=60 is 15 real seconds.
    expect(combatPlaybackMs(900)).toBe(15_000)
  })

  it('a fight at exactly OVERTIME_START_TICK takes exactly the 30s floor', () => {
    expect(combatPlaybackMs(OVERTIME_START_TICK)).toBe(30_000)
  })

  it('a fight one tick over the threshold adds overtime time at half the normal rate', () => {
    const oneTickMs = (1 / TICK_RATE) * 1000
    expect(combatPlaybackMs(OVERTIME_START_TICK + 1)).toBeCloseTo(30_000 + oneTickMs / 2, 5)
  })

  it('a fight at the hard-draw cap (2x OVERTIME_START_TICK) takes 45s total — the true maximum', () => {
    expect(combatPlaybackMs(OVERTIME_START_TICK * 2)).toBe(45_000)
  })

  it('an empty (zero-tick) fight takes zero real time', () => {
    expect(combatPlaybackMs(0)).toBe(0)
  })
})

describe('computeStageWindowMs', () => {
  const FLOOR = 30_000

  it('returns the floor when there are no recorded fights at all (bye/item round)', () => {
    expect(computeStageWindowMs([], FLOOR)).toBe(FLOOR)
  })

  it('returns the floor for a short fight well under the budget — every stage is always at least this long', () => {
    expect(computeStageWindowMs([logOf(300)], FLOOR)).toBe(FLOOR)
  })

  it('extends past the floor only once a fight needs overtime, accounting for intro + network buffer', () => {
    const windowMs = computeStageWindowMs([logOf(OVERTIME_START_TICK * 2)], FLOOR)
    expect(windowMs).toBeGreaterThan(FLOOR)
    // 45s combat + intro + buffer, comfortably under the hard 45s + ~2s pad.
    expect(windowMs).toBeLessThan(48_000)
  })

  it('uses the longer of several simultaneous fights this round', () => {
    const shortFightWindow = computeStageWindowMs([logOf(300)], FLOOR)
    const longFightWindow = computeStageWindowMs([logOf(300), logOf(OVERTIME_START_TICK * 2)], FLOOR)
    expect(longFightWindow).toBeGreaterThan(shortFightWindow)
  })

  it('a custom floor (test-mode PLANNING_MS override) is honoured when no fight needs more', () => {
    // Fixed overhead alone (COMBAT_INTRO_MS + the network buffer) is ~2s, so
    // a short fight comfortably stays under a 5s custom floor.
    expect(computeStageWindowMs([logOf(60)], 5000)).toBe(5000)
  })
})
