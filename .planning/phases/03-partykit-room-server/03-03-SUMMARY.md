---
phase: 03-partykit-room-server
plan: 03
subsystem: net-transport
tags: [typescript, partykit, partysocket, websocket, vitest, room-server, seat-lifecycle]

# Dependency graph
requires:
  - phase: 03-partykit-room-server plan 01
    provides: "party/lobby.ts, src/net/protocol.ts, scripts/roomHarness.ts, scripts/roomSmoke.ts — the tracer room this plan extends"
provides:
  - "party/seats.ts — pure, transport-free seat table: newRoomRun/newSeatTable/assignSeat/freeSeat/seatOf/sanitizeDisplayName/lobbyView"
  - "party/lobby.ts (refactored) — seat assignment/revert routed through party/seats.ts; message path guarded by length cap, per-connection rate limit, and single seat-resolution call site"
  - "src/net/protocol.ts (extended) — MAX_ACTIONS_PER_PHASE, ServerMessage variants seat-taken/seat-freed"
  - "scripts/roomSeats.ts (npm run room:seats) — two-client integration proof: deterministic seating, forged-seat isolation, room-full rejection, interleaved pool conservation, disconnect revert"
affects: [03-04 (planning timer extends Lobby's resetActionBudget() call site), Phase 4 (browser client relies on seat-taken/seat-freed for lobby UI, and on the seat trust boundary this plan hardens)]

# Actuals (#2632)
actuals:
  tokens: 9550
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seat lifecycle extracted into a transport-free module (party/seats.ts) that imports nothing from partykit/partysocket — makes the trust-boundary-critical assignment/revert logic fully unit-testable in vitest with no server running, and importable from lobby.ts without pulling any Workers-runtime dependency into the test process"
    - "Revert preserves an entire economy and resets exactly one field (shopLocked) — the roster captured at newSeatTable() time is the only source of truth for what a freed seat's persona/name reverts to, never re-derived by index math at free-time"
    - "Seat authority resolved via a single call site (seatOf(this.table, sender.id)) in onMessage — grep-enforced as an acceptance criterion so a future edit can't accidentally introduce a second, divergent seat-resolution path"
    - "Rejected actions never broadcast — only accepted mutations reach room.broadcast(), so a flood of invalid input from one connection cannot amplify into fan-out traffic for every other connection"

key-files:
  created:
    - party/seats.ts
    - party/seats.test.ts
    - scripts/roomSeats.ts
  modified:
    - party/lobby.ts
    - src/net/protocol.ts
    - package.json
    - vite.config.ts

key-decisions:
  - "vite.config.ts's vitest `test.include` was `['src/**/*.test.ts']` only — party/seats.test.ts was invisible to `npx vitest run party/seats.test.ts` (silently 'No test files found') until widened to also include `party/**/*.test.ts`. This is a Rule 3 blocking fix: the plan's own acceptance criterion (`npx vitest run party/seats.test.ts` passing) was unachievable without it. Discovered immediately during the RED step of Task 1's TDD cycle, before any implementation existed, so it could not be mistaken for a passing-by-accident test."
  - "onStart's post-restart cleanup forces every seat's `personaId` back to its roster value (per the plan's action text) but deliberately does NOT also force `name` back — the plan only names personaId as the field to restore, and doing more would have been unrequested scope. A room that restarts mid-human-session may briefly show a stale human-chosen name on a seat now reported as bot-held (occupants[i] === null) until a new connection reclaims and renames it via assignSeat. This is a narrow, cosmetic-only edge case (name only, never personaId/occupancy) inherited directly from the plan's own specification, not introduced here."
  - "onConnect/onClose broadcast `lobby` unconditionally alongside the new `seat-taken`/`seat-freed` variants, matching Plan 03-01's existing broadcast style rather than switching to seat-taken/seat-freed as a lobby replacement. Phase 4's UI can use either signal per the plan's own interface note ('so Phase 4's UI can react to arrivals and departures without diffing two lobby arrays') — this plan does not remove the simpler `lobby` fallback, since nothing in the plan asked for its removal and scripts/roomSeats.ts's own scenario 1 explicitly accepts either."
  - "scripts/roomSeats.ts registers each of its cross-connection listeners (arrival broadcast, revert broadcast) via nextMessage() BEFORE triggering the event that produces them (before connecting client B, before closing client B) rather than immediately after awaiting a related response. A same-tick broadcast can otherwise arrive and be silently dropped by an event target with no listener attached yet — this was found empirically on the first run (a real, if narrow, race in the test's own construction, not in party/lobby.ts) and fixed by re-ordering, not by adding an artificial delay."

requirements-completed: [LOBBY-01, LOBBY-02, LOBBY-03]

coverage:
  - id: D1
    description: "Connecting to a room takes the lowest-index bot seat and converts it to human; a second connection takes the next lowest, so host and friend deterministically hold seats 0 and 1"
    requirement: LOBBY-02
    verification:
      - kind: unit
        ref: "party/seats.test.ts — assignSeat assigns sequential seats 0..5 then returns null on the 7th call"
        status: pass
      - kind: integration
        ref: "scripts/roomSeats.ts — Scenario 1: client A (Host) takes seat 0, client B (Friend) takes seat 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Disconnecting reverts a seat to its original bot persona, preserving the economy exactly and resetting only shopLocked; the seat is reassigned to the next connection ahead of any higher free seat"
    requirement: LOBBY-03
    verification:
      - kind: unit
        ref: "party/seats.test.ts — freeSeat restores personaId/name from roster; preserves every economy field except shopLocked, which resets to false; a freed seat is reassignable ahead of higher free seats"
        status: pass
      - kind: integration
        ref: "scripts/roomSeats.ts — Scenario 5: disconnect revert with lowest-seat reassignment"
        status: pass
    human_judgment: false
  - id: D3
    description: "The seat an action applies to is derived solely from connection identity; a client-supplied seat-like field in the payload is inert and mutates only the sender's own seat"
    requirement: LOBBY-01
    verification:
      - kind: static
        ref: "grep -c \"seatOf(this.table, sender.id)\" party/lobby.ts is 1 — exactly one seat-resolution call site"
        status: pass
      - kind: integration
        ref: "scripts/roomSeats.ts — Scenario 2: forged-seat isolation, seat 0 byte-identical before/after a forged `seat: 0` field from seat 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "An action from a connection holding no seat is rejected with not-seated and mutates nothing; a room with all 6 seats occupied rejects and closes a further connection"
    requirement: LOBBY-01
    verification:
      - kind: integration
        ref: "scripts/roomSeats.ts — Scenario 3: room-full rejection, 7th connection rejected with not-seated and socket closes"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two clients issuing interleaved buy/sell/reroll actions against the same room leave the shared pool conserved (pool[id] + copies held across all seats' benches/boards is invariant)"
    requirement: LOBBY-01
    verification:
      - kind: integration
        ref: "scripts/roomSeats.ts — Scenario 4: 34 interleaved actions fired across both clients without lock-step waiting; poolTotal invariant holds across all 64 definition ids observed"
        status: pass
    human_judgment: false
  - id: D6
    description: "The message path rejects oversized, malformed, and flooding input without broadcasting, and party/seats.ts stays import-free of any transport library"
    requirement: LOBBY-01
    verification:
      - kind: static
        ref: "grep -ciE \"from '(partykit|partysocket)\" over non-comment lines of party/seats.ts is 0"
        status: pass
      - kind: integration
        ref: "npx tsx scripts/roomSmoke.ts — malformed-payload rejection with no snapshot broadcast (Plan 03-01 regression check, still passing)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-17
status: complete
---

# Phase 3 Plan 3: Room Seat Lifecycle Summary

**A pure, unit-tested `party/seats.ts` module now owns seat assignment and disconnect-revert; `party/lobby.ts` is refactored onto it with a hardened, single-call-site seat-authority trust boundary; and a real two-client `partykit dev` run (`npm run room:seats`) proves deterministic seating, forged-seat isolation, room-full rejection, 34-action interleaved pool conservation, and full economy-preserving revert on disconnect — all five scenarios passing end-to-end.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files created:** 3 (`party/seats.ts`, `party/seats.test.ts`, `scripts/roomSeats.ts`)
- **Files modified:** 4 (`party/lobby.ts`, `src/net/protocol.ts`, `package.json`, `vite.config.ts`)

## Interleaved-burst results (Task 3, Scenario 4)

34 actions fired alternating between the two connected clients (Host at seat 0, Friend at seat 1), cycling `reroll` → `buy` (against whatever shop slot was non-null in that seat's own last-seen broadcast snapshot) → `sell` (bench index 0):

- **11 accepted** (broadcast a `snapshot`)
- **23 rejected**, broken down by reason: `no-gold` (9 — reroll/buy attempted after that seat's 5-gold starting stake was already spent this round), `empty-slot` (7 — a `buy` against a shop slot the other action stream had already emptied since the client's snapshot went stale), `no-unit` (7 — a `sell` against bench index 0 after that slot was already emptied by an earlier accepted sell)

All three reasons are expected consequences of firing actions without awaiting each response in lock-step (the plan's own instruction) against a shared 5-gold-per-seat starting economy — none indicate corruption. `poolTotal` (pool[id] + copies held across every seat's bench/board, reproducing `src/game/round.test.ts`'s own `heldCopies` helper) held invariant across all 64 definition ids observed between the pre-burst baseline and the post-burst settled snapshot.

## `onClose` reliability (asked for explicitly in the plan's `<output>`)

`scripts/roomSeats.ts` calls `PartySocket.close()` (a clean client-initiated close, not a killed/abrupt socket) and observed the room's `onClose` fire reliably every run: the `freeSeat`-triggered `lobby`/`seat-freed` broadcast to the remaining client arrived well within `nextMessage`'s 10s timeout on every execution, and the subsequent `snapshot` request confirmed the reverted seat's personaId/name/shopLocked/economy matched the contract exactly. This plan did **not** test a genuinely abrupt close (killed process, network partition, no TCP FIN) — PartyKit/Cloudflare Workers' Durable Object runtime relies on the underlying WebSocket close event for `onClose`, and a true network-level abrupt disconnect (versus a clean client `.close()`) is a meaningfully different code path this plan's harness cannot exercise from a single local Node process. Flagged for Phase 4 or a later hardening pass if reconnect/idle-handling work picks it up (both currently Out of Scope per PROJECT.md).

## `MAX_ACTIONS_PER_PHASE` reachability

Not reached in this plan's runs. The interleaved burst (Task 3, Scenario 4) sent 17 actions per connection — nowhere near the 600-per-phase budget. `MAX_ACTIONS_PER_PHASE = 600` is deliberately sized so real play (even the fastest human clicking rerolls) cannot approach it within one planning phase; this plan's own automated traffic confirms that headroom is enormous by construction, not just by comment.

## Accomplishments
- `party/seats.ts`: pure, transport-free (grep-verified zero `partykit`/`partysocket` imports) seat table — `newRoomRun`, `newSeatTable`, `assignSeat`, `freeSeat`, `seatOf`, `sanitizeDisplayName`, `lobbyView`. 14/14 unit tests pass (`party/seats.test.ts`), including a full field-by-field preservation test (12 named economy fields unchanged, `shopLocked` the one field reset) and an occupancy-invariant helper (`occupants[i] !== null` iff `players[i].personaId === null`) called after every mutation in every test.
- `party/lobby.ts` refactored: `onStart` rebuilds the (never-persisted) seat table from the persisted run and forces every seat's `personaId` back to its roster value, guarding against a restart-while-seated edge case; `onConnect` reads the display name from the connect URL's query string only and routes assignment through `assignSeat`; `onClose` routes revert through `freeSeat` and clears that connection's rate-limit entry; `onMessage` enforces a 4096-char length cap, then a 600-action-per-phase rate limit, then malformed-payload rejection, then resolves the acting seat via the single `seatOf(this.table, sender.id)` call site — the phase's primary security control, grep-enforced.
- `src/net/protocol.ts` extended with `MAX_ACTIONS_PER_PHASE` and two `ServerMessage` variants (`seat-taken`, `seat-freed`); `ClientMessage` remains a one-variant union carrying no seat- or state-bearing field.
- `scripts/roomSeats.ts` (`npm run room:seats`): a real two-client integration run against a live `partykit dev` room proving all five plan scenarios end-to-end, with no leaked `partykit dev`/`workerd` process afterward.
- All plan-level `<verification>` gates pass: `npx vitest run party/seats.test.ts` (14 tests), `npx tsx scripts/roomSeats.ts` exits 0, `npx tsx scripts/roomSmoke.ts` (Plan 03-01's tracer) still exits 0 with no regression, `npx tsc --noEmit` holds the 16-error project baseline with zero errors under `party/`, `scripts/`, or `src/net/`, and `git diff --name-only HEAD -- src/game/ src/core/ src/econ/ src/main.ts` prints nothing — the engine was reused, not modified.

## Task Commits

1. **Task 1 (RED): failing seat-lifecycle unit tests** — `3607e23` (test)
2. **Task 1 (GREEN): the pure seat table module** — `386acc9` (feat)
3. **Task 2: wire the room onto the seat table, guard the message path** — `ff6f375` (feat)
4. **Task 3: two-client integration proving seat lifecycle end-to-end** — `76e3c6a` (test)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge (`.planning/` is gitignored, `commit_docs: false`)._

## Files Created/Modified
- `party/seats.ts` — `SeatRosterEntry`, `SeatTable`, `newRoomRun()`, `newSeatTable()`, `assignSeat()`, `freeSeat()`, `seatOf()`, `sanitizeDisplayName()`, `lobbyView()`
- `party/seats.test.ts` — 14-test vitest suite (assignment order, revert semantics, field-by-field preservation-vs-reset, name sanitization, occupancy invariant)
- `party/lobby.ts` — refactored onto `party/seats.ts`; guarded `onMessage` (length cap → rate limit → malformed check → single seat-resolution call site); `resetActionBudget()` left as a named method for Plan 03-04 to call at planning-phase start
- `src/net/protocol.ts` — `MAX_ACTIONS_PER_PHASE`, `ServerMessage` variants `seat-taken`/`seat-freed`
- `scripts/roomSeats.ts` — two-client integration run (5 scenarios), `heldCopies`/`poolTotal` reproducing `round.test.ts`'s own conservation helper
- `package.json` — `room:seats` script added
- `vite.config.ts` — vitest `test.include` widened to also cover `party/**/*.test.ts` (see Deviations)

## Decisions Made
See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] `party/seats.test.ts` was invisible to vitest**
- **Found during:** Task 1, the RED step (confirming the test suite fails for the right reason — module doesn't exist — before writing the implementation)
- **Issue:** `vite.config.ts`'s `test.include` was `['src/**/*.test.ts']` only. `npx vitest run party/seats.test.ts` reported "No test files found, exiting with code 1" rather than the expected module-resolution failure — vitest's positional filter argument only narrows an already-`include`-matched file list, it does not add files outside `include`.
- **Fix:** Widened `test.include` to `['src/**/*.test.ts', 'party/**/*.test.ts']`.
- **Files modified:** `vite.config.ts`
- **Verification:** Re-ran `npx vitest run party/seats.test.ts` — now correctly fails to resolve `./seats` (the expected RED state), confirming the fix addressed test discovery without masking the real failure.
- **Committed in:** `3607e23` (Task 1 RED commit)

**2. [Found during test authoring, non-blocking] A same-tick broadcast race in `scripts/roomSeats.ts`'s own listener ordering**
- **Found during:** Task 3, first run — `nextMessage(a, m => m.t === 'lobby' || m.t === 'seat-taken')` timed out with zero messages seen, even though the room's `onConnect` for client B does broadcast both messages.
- **Issue:** The listener was registered on client A only after `await`-ing client B's own `welcome` — by which point the room had already broadcast `lobby`/`seat-taken` to A (as part of B's `onConnect` handler), and those messages were dropped since no listener was attached yet to receive them.
- **Fix:** Reordered to register the `nextMessage` listener on A immediately before triggering the event that produces the broadcast (before connecting B; before closing B for the disconnect-revert scenario), not after awaiting a related response.
- **Files modified:** `scripts/roomSeats.ts`
- **Verification:** Re-ran `npx tsx scripts/roomSeats.ts` — all 5 scenarios pass consistently across repeated runs.
- **Committed in:** `76e3c6a` (Task 3 commit; the fix was applied before the first commit of this file, so no separate follow-up commit was needed)

---

**Total deviations:** 2 auto-fixed (1 blocking test-discovery config gap, 1 non-blocking test-construction race), both required for this plan's own acceptance criteria to be achievable/reliable at all.
**Impact on plan:** No scope creep. Both fixes are narrowly scoped to test/config infrastructure this plan's own tasks needed; neither touches `party/seats.ts`'s or `party/lobby.ts`'s runtime logic.

## Issues Encountered
None beyond the two deviations above, both resolved during their own task's execution before commit.

## User Setup Required
None. `npm run room:dev` still starts the local room; `npm run room:smoke` and `npm run room:seats` re-run the automated verifications at any time.

## Next Phase Readiness
- `party/lobby.ts`'s `resetActionBudget()` method exists specifically for Plan 03-04 to call at the start of every new planning phase — currently only called from `onConnect`.
- `src/net/protocol.ts`'s `seat-taken`/`seat-freed` `ServerMessage` variants are ready for Phase 4's lobby UI to consume without diffing two `lobby` arrays.
- `party/seats.ts`'s `SeatTable`/`SeatRosterEntry` types and all seven exported functions are stable and ready for Plan 03-04 to extend (e.g., seat-aware planning-timer state) without touching the seat-authority trust boundary this plan hardened.
- The one open question flagged above (`onClose` under a genuinely abrupt/killed-process disconnect, as opposed to a clean client-initiated close) is not something this plan's local-harness testing could exercise — worth a note for Phase 4/deployment hardening if reconnect handling is ever picked back up (currently Out of Scope per PROJECT.md).
- No blockers for Plan 03-04.

---
*Phase: 03-partykit-room-server*
*Completed: 2026-08-17*
