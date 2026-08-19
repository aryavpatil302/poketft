// Countdown math for the room's planning phase, corrected for clock skew.
//
// The server (party/lobby.ts's broadcastPhase) sends an absolute epoch-ms
// `deadline` paired with its own `serverNow` (Date.now at send time)
// precisely so a client can subtract the two into a DURATION and then track
// that duration against its own monotonic clock. Comparing the absolute
// `deadline` against a local `Date.now` would silently bake in every
// millisecond of clock skew between the two machines — and once this is
// deployed (Phase 5) those machines are a stranger's laptop and a Cloudflare
// edge worker, not two processes on one box. A laptop whose clock is an hour
// fast would show a timer that is already expired the instant planning opens.
//
// The monotonic reading enters as a PARAMETER rather than being read from
// performance.now inside this module. That is what makes every case here
// testable without faking timers, and it keeps the module usable from the
// Node verification scripts, where performance.now has a different epoch
// than the browser's.
//
// Pure and DOM-free: no imports beyond types, no globals, no time source.

// ─── The captured clock ──────────────────────────────────────────────────────

// `budgetMs` is the server's OWN remaining time at the moment it sent the
// message; `capturedAtMono` is the local monotonic reading at receipt. The
// absolute server timestamp is deliberately NOT stored — keeping it around
// would invite exactly the local-Date.now comparison this module exists to
// prevent.
export interface RoomClock {
  budgetMs: number
  capturedAtMono: number
}

// ─── Capture ─────────────────────────────────────────────────────────────────

// Returns null for any phase carrying no deadline (idle / resolving / over),
// and also for a non-finite timestamp — a NaN clock would propagate a NaN
// into a CSS width string downstream, which renders as a silently broken bar
// rather than a loud failure.
export function captureDeadline(
  msg: { deadline: number | null; serverNow: number },
  receivedAtMono: number,
): RoomClock | null {
  if (msg.deadline === null) return null
  if (!Number.isFinite(msg.deadline) || !Number.isFinite(msg.serverNow)) return null
  if (!Number.isFinite(receivedAtMono)) return null
  return { budgetMs: msg.deadline - msg.serverNow, capturedAtMono: receivedAtMono }
}

// ─── Accessors ───────────────────────────────────────────────────────────────

// Clamped at 0 and never negative: a nonsensical or hostile deadline yields an
// expired timer rather than a negative width or a NaN in a style string.
export function remainingMs(clock: RoomClock | null, nowMono: number): number {
  if (!clock) return 0
  const elapsed = nowMono - clock.capturedAtMono
  const left = clock.budgetMs - elapsed
  return left > 0 ? left : 0
}

// Ceiling, not floor: a 30000 ms budget must read "30" the instant the phase
// opens (a floor would read 29 immediately and hold "0" for a full second
// before the deadline actually arrives), and 0 only when the budget is
// genuinely spent.
export function remainingSeconds(clock: RoomClock | null, nowMono: number): number {
  return Math.ceil(remainingMs(clock, nowMono) / 1000)
}

// 1 at capture, 0 at or past the deadline, never outside the closed interval
// 0..1. A zero-or-negative budget yields 0 rather than a division by zero.
export function fractionRemaining(clock: RoomClock | null, nowMono: number): number {
  if (!clock || clock.budgetMs <= 0) return 0
  const fraction = remainingMs(clock, nowMono) / clock.budgetMs
  if (fraction <= 0) return 0
  return fraction < 1 ? fraction : 1
}
