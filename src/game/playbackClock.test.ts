import { describe, it, expect } from 'vitest'
import { frameDeltaSeconds, planCatchUp } from './playbackClock'

// The bug these tests exist to prevent coming back: a player backgrounds their
// tab mid-fight, requestAnimationFrame stops firing entirely, and on refocus
// the whole hidden interval is thrown away instead of applied — so that client
// watches the rest of the fight permanently behind the other player and the
// server's round clock, and comes back to a shop whose timer already expired.

const LIVE_CLAMP = 0.1
const STEP = 1 / 60
const THRESHOLD = 30

describe('frameDeltaSeconds', () => {
  describe('live simulation (test mode) — clamped', () => {
    it('passes through an ordinary frame delta untouched', () => {
      expect(frameDeltaSeconds(1 / 60, false, LIVE_CLAMP)).toBeCloseTo(1 / 60, 10)
    })

    it('clamps a long gap, so a returning tab never death-spirals through thousands of real ticks', () => {
      expect(frameDeltaSeconds(30, false, LIVE_CLAMP)).toBe(LIVE_CLAMP)
    })

    it('does not clamp exactly at the ceiling', () => {
      expect(frameDeltaSeconds(LIVE_CLAMP, false, LIVE_CLAMP)).toBe(LIVE_CLAMP)
    })

    it('clamps just above the ceiling', () => {
      expect(frameDeltaSeconds(LIVE_CLAMP + 0.001, false, LIVE_CLAMP)).toBe(LIVE_CLAMP)
    })
  })

  describe('playback — unclamped', () => {
    it('passes through an ordinary frame delta untouched', () => {
      expect(frameDeltaSeconds(1 / 60, true, LIVE_CLAMP)).toBeCloseTo(1 / 60, 10)
    })

    // THE regression. Under the old shared clamp this returned 0.1 and the
    // other 29.9 seconds were silently discarded — never deferred, because
    // every later callback reports an ordinary ~16ms delta, so there was no
    // catch-up path at all.
    it('preserves an entire backgrounded interval rather than discarding it', () => {
      expect(frameDeltaSeconds(30, true, LIVE_CLAMP)).toBe(30)
    })

    it.each([0.2, 1, 5, 30, 300])('preserves a %ss gap in full', gap => {
      expect(frameDeltaSeconds(gap, true, LIVE_CLAMP)).toBe(gap)
    })

    // The property the whole sync guarantee rests on: however the callbacks
    // fall — smooth, janky, or with a multi-minute hole in the middle — the
    // deltas sum to the true elapsed time. Clamping is the only thing that
    // breaks it, and a broken sum is exactly a desync between two clients.
    it('telescopes: deltas sum to true elapsed time regardless of how callbacks fall', () => {
      const TOTAL = 10
      // Three ways ten seconds of wall clock can arrive at the render loop.
      // Each is built to sum to exactly TOTAL by construction.
      const smooth = Array.from({ length: 600 }, () => TOTAL / 600)   // 60fps, no gaps
      const hidden = [1 / 60, 1 / 60, TOTAL - 4 / 60, 1 / 60, 1 / 60] // tab backgrounded mid-fight
      const jankyHead = [0.5, 0.016, 2, 0.033]
      const janky = [...jankyHead, TOTAL - jankyHead.reduce((a, b) => a + b, 0)]

      const total = (deltas: number[]) =>
        deltas.reduce((sum, d) => sum + frameDeltaSeconds(d, true, LIVE_CLAMP), 0)

      expect(total(smooth)).toBeCloseTo(TOTAL, 6)
      expect(total(hidden)).toBeCloseTo(TOTAL, 6)
      expect(total(janky)).toBeCloseTo(TOTAL, 6)
      // ...and all three agree with each other, which is the actual sync
      // guarantee: two clients whose callbacks fell differently still end up
      // at the same point in the same fight.
      expect(total(hidden)).toBeCloseTo(total(smooth), 6)
      expect(total(janky)).toBeCloseTo(total(smooth), 6)
    })

    it('does NOT telescope when clamped — the pre-fix behaviour, kept as a contrast', () => {
      const hidden = [1 / 60, 1 / 60, 10 - 4 / 60, 1 / 60, 1 / 60]
      const clampedTotal = hidden.reduce(
        (sum, d) => sum + frameDeltaSeconds(d, false, LIVE_CLAMP), 0,
      )
      // Nearly the whole ten seconds is gone: the clamp keeps 0.1s of the gap
      // and drops the rest, which is exactly how far behind the room a
      // refocused tab used to be.
      expect(clampedTotal).toBeLessThan(0.2)
    })
  })

  describe('degenerate readings', () => {
    // A NaN reaching the accumulator would freeze playback forever with no
    // error, since `NaN >= step` is false on every subsequent frame.
    it.each([NaN, Infinity, -Infinity])('yields 0 for %s', bad => {
      expect(frameDeltaSeconds(bad, true, LIVE_CLAMP)).toBe(0)
      expect(frameDeltaSeconds(bad, false, LIVE_CLAMP)).toBe(0)
    })

    it('yields 0 for a zero or backwards delta', () => {
      expect(frameDeltaSeconds(0, true, LIVE_CLAMP)).toBe(0)
      expect(frameDeltaSeconds(-1, true, LIVE_CLAMP)).toBe(0)
    })
  })
})

describe('planCatchUp', () => {
  describe('threshold', () => {
    it('returns null for an ordinary backlog, so normal jank still replays every frame and its effects', () => {
      expect(planCatchUp(STEP * 3, STEP, 0, 1000, THRESHOLD)).toBeNull()
    })

    it('returns null one tick below the threshold', () => {
      expect(planCatchUp(STEP * (THRESHOLD - 1), STEP, 0, 1000, THRESHOLD)).toBeNull()
    })

    it('jumps exactly at the threshold', () => {
      expect(planCatchUp(STEP * THRESHOLD, STEP, 0, 1000, THRESHOLD)).not.toBeNull()
    })
  })

  describe('landing index', () => {
    // A 30s background gap at 60 ticks/s is 1800 ticks. Starting at frame 0 and
    // consuming 1800 steps lands ON frame 1799, because a per-tick loop applies
    // frames[index] on its first step rather than after it.
    it('lands on the frame wall-clock says the fight is on', () => {
      const jump = planCatchUp(STEP * 1800, STEP, 0, 5000, THRESHOLD)
      expect(jump).toEqual({ targetIndex: 1799, nextIndex: 1800, remainder: expect.any(Number) })
    })

    it('offsets from the current cursor, not from zero', () => {
      const jump = planCatchUp(STEP * 1800, STEP, 600, 5000, THRESHOLD)
      expect(jump?.targetIndex).toBe(2399)
      expect(jump?.nextIndex).toBe(2400)
    })

    it('leaves a remainder below one step', () => {
      const jump = planCatchUp(STEP * 1800 + STEP * 0.4, STEP, 0, 5000, THRESHOLD)
      expect(jump!.remainder).toBeGreaterThanOrEqual(0)
      expect(jump!.remainder).toBeLessThan(STEP)
    })
  })

  describe('end of log', () => {
    it('clamps to the final frame when the gap outruns the fight', () => {
      const jump = planCatchUp(STEP * 100_000, STEP, 0, 900, THRESHOLD)
      expect(jump?.targetIndex).toBe(899)
      // One past the last frame, so the caller's loop ends the fight itself
      // rather than this needing its own termination path.
      expect(jump?.nextIndex).toBe(900)
    })

    it('lands exactly on the last frame when the gap covers precisely the rest', () => {
      const jump = planCatchUp(STEP * 900, STEP, 0, 900, THRESHOLD)
      expect(jump?.targetIndex).toBe(899)
      expect(jump?.nextIndex).toBe(900)
    })

    it('returns null once the cursor is already past the end', () => {
      expect(planCatchUp(STEP * 1800, STEP, 900, 900, THRESHOLD)).toBeNull()
    })

    it('returns null for an empty log', () => {
      expect(planCatchUp(STEP * 1800, STEP, 0, 0, THRESHOLD)).toBeNull()
    })

    it('handles a single-frame log', () => {
      expect(planCatchUp(STEP * 1800, STEP, 0, 1, THRESHOLD)?.targetIndex).toBe(0)
    })
  })

  describe('degenerate inputs', () => {
    it.each([
      ['NaN accumulator', NaN, STEP],
      ['NaN step', STEP * 1800, NaN],
      ['zero step', STEP * 1800, 0],
      ['negative step', STEP * 1800, -STEP],
    ])('returns null for %s', (_label, accumulator, step) => {
      expect(planCatchUp(accumulator, step, 0, 1000, THRESHOLD)).toBeNull()
    })
  })
})
