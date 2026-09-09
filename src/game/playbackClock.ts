// Timing policy for combat playback: how much real time a rendered frame is
// allowed to advance the fight by, and how to land back on the right frame
// after a stretch where nothing was rendered at all.
//
// Extracted from main.ts's frame() for the same reason src/net/roomClock.ts
// was extracted from the planning countdown: this is arithmetic whose failure
// mode is a silent desync between two players rather than a thrown error, so
// it needs tests that do not require a DOM, a canvas, a real
// requestAnimationFrame, or fake timers. Every time source enters as a
// PARAMETER — this module reads no clock and holds no state.
//
// Pure and DOM-free: no imports, no globals, no time source.

// ─── Per-callback delta policy ───────────────────────────────────────────────

// requestAnimationFrame is SUSPENDED, not throttled, while a tab is hidden, so
// the first callback after the tab is refocused reports the entire hidden
// interval as its delta. What a caller does with that delta has to differ by
// what a "tick" costs it:
//
//   Live simulation (test mode) MUST clamp. One tick there is a full
//   tickCombat() — targeting, abilities, damage, the lot — so honouring a
//   30-second delta would mean running 1800 real simulation ticks
//   synchronously on one callback. The clamp deliberately drops that time on
//   the floor; test mode is single-client and local, so nothing is out of
//   step with anything.
//
//   Playback MUST NOT clamp. Its position is derived by accumulating these
//   deltas, and clamping breaks the one property that derivation depends on:
//   unclamped, the deltas telescope, so their sum over any span is exactly
//   `now - playbackStart` no matter how the callbacks were distributed within
//   it. Clamping DISCARDS the hidden interval instead of deferring it, which
//   is what left a refocused tab permanently behind the other player and the
//   server's round clock — it never catches up, because every later callback
//   reports an ordinary ~16ms delta. Keeping the raw value makes accumulated
//   playback time track wall-clock time with zero drift, which is what keeps
//   two clients watching the same fight at the same point, and it stays
//   correct across mid-fight speed changes because each delta is scaled by the
//   speed in force during that delta (a `(now - start) * rate` anchor would
//   retroactively rewrite history at every speed change).
//
// A non-finite or negative delta yields 0 rather than propagating NaN into the
// accumulator, where it would freeze playback permanently: NaN >= step is
// false forever, so a single bad reading would stop the fight with no error.
export function frameDeltaSeconds(
  rawSeconds: number,
  isPlayback: boolean,
  liveClampSeconds: number,
): number {
  if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) return 0
  return isPlayback ? rawSeconds : Math.min(rawSeconds, liveClampSeconds)
}

// ─── Catch-up ────────────────────────────────────────────────────────────────

// `targetIndex` is the frame to apply; `nextIndex` is what the playback cursor
// becomes afterwards (one past the target, so a caller's normal per-tick loop
// resumes cleanly — and, when the jump reaches the end of the log, lands past
// the last frame so that loop ends the fight on its own). `remainder` is the
// accumulator left over, always less than one step.
export interface CatchUpJump {
  targetIndex: number
  nextIndex: number
  remainder: number
}

// Decides whether a backlog is large enough to skip rather than replay, and if
// so which single frame to land on.
//
// Skipping is exact, not an approximation: applyFrame is an absolute reconcile
// (it rebuilds the unit set from the frame, overwrites every recorded field,
// clears and rebuilds occupancy, replaces the projectile map wholesale, and
// assigns rather than merges events/terrain/tailwind), so applying frame N
// alone produces the same state as replaying 0..N. Replaying the backlog
// instead would be strictly worse: thousands of reconciles in one synchronous
// burst is a visible hitch on the exact frame the player came back to, and it
// would fire every visual effect of the skipped seconds at once.
//
// Returns null when the backlog is below `thresholdTicks` — ordinary jank of a
// few dropped frames should still replay every frame and its effects — and
// also when there is nothing left to play.
export function planCatchUp(
  accumulator: number,
  step: number,
  playbackIndex: number,
  frameCount: number,
  thresholdTicks: number,
): CatchUpJump | null {
  if (!Number.isFinite(accumulator) || !Number.isFinite(step) || step <= 0) return null
  if (accumulator < step * thresholdTicks) return null

  const pending = Math.floor(accumulator / step)
  if (pending <= 0) return null

  const lastIndex = frameCount - 1
  // -1 because a per-tick loop applies frames[playbackIndex] on its FIRST
  // step rather than after it, so consuming `pending` steps lands here.
  const target = Math.min(playbackIndex + pending - 1, lastIndex)
  // Already at or past the end of the log: let the caller's loop terminate the
  // fight normally instead of re-applying the final frame.
  if (target < playbackIndex) return null

  return {
    targetIndex: target,
    nextIndex: target + 1,
    remainder: accumulator - pending * step,
  }
}
