---
phase: 01-seat-agnostic-core-refactor
plan: 01
subsystem: economy-engine
tags: [typescript, vitest, seat-addressing, matchmaking, game-over]

# Dependency graph
requires: []
provides:
  - "pickNextOpponent(state, forSeat, rng) — seat-parameterized opponent selection, no hardcoded seat-0"
  - "checkGameOver(state, forSeat) — seat-parameterized win/loss check, eliminated-first tie-break"
  - "localSeatIndex module var in src/main.ts + humanEcon() rewired to read run.players[localSeatIndex]"
  - "symmetric-seat test suite covering degenerate seat counts (one/two living seats, simultaneous elimination, ordering stability, power-independence)"
affects: [01-seat-agnostic-core-refactor plan 02, round engine, room server, client networking]

# Actuals (#2632)
actuals:
  tokens: 2922
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seat addressing by explicit forSeat parameter instead of literal index 0 — the seam every later multiplayer phase builds on"
    - "personaId === null remains the sole human/bot discriminator; localSeatIndex is only which seat this client renders, not a second human marker"

key-files:
  created: []
  modified:
    - src/main.ts
    - src/econ/botMatches.ts
    - src/econ/botMatches.test.ts

key-decisions:
  - "Task 2's compile-blocking pre-existing checkGameOver(run) test call sites were updated to checkGameOver(run, 0) inline in Task 2 (not deferred to Task 3), since Task 2's own acceptance criteria required both tsc and vitest to be clean — Task 3 then added the full symmetric-seat suite on top."
  - "Board-power-independence test (Task 3) required threading run.nextOpponent = pick between calls to mirror real caller usage, or the anti-rematch filter would permanently exclude the seat that happened to be the default state.nextOpponent(1)."

requirements-completed: [CORE-01, CORE-02]

coverage:
  - id: D1
    description: "localSeatIndex determines which seat the local client controls; humanEcon() resolves through it with zero literal seat-0 reads remaining in src/main.ts"
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "grep -c 'run\\.players\\[localSeatIndex\\]' src/main.ts == 1; grep -n 'players\\[0\\]' src/main.ts | grep -c 'players\\[0\\]' == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "pickNextOpponent(state, forSeat, rng) never returns forSeat and never returns an eliminated seat, for any forSeat 0..5, including the one-living-seat (-1 sentinel) and two-living-seat (deterministic swap) boundaries"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "src/econ/botMatches.test.ts#pickNextOpponent never self-pairs and never picks an eliminated seat, for every seat"
        status: pass
      - kind: unit
        ref: "src/econ/botMatches.test.ts#pickNextOpponent returns the -1 sentinel and checkGameOver returns win when forSeat is the last seat standing"
        status: pass
      - kind: unit
        ref: "src/econ/botMatches.test.ts#pickNextOpponent returns the only other living seat every call when exactly two seats are alive"
        status: pass
    human_judgment: false
  - id: D3
    description: "checkGameOver(state, forSeat) returns 'loss' when forSeat is eliminated (checked before the last-seat-standing check, so simultaneous total elimination reads 'loss' for every seat, never a spurious 'win'), 'win' when forSeat is the sole survivor, and null otherwise"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "src/econ/botMatches.test.ts#checkGameOver answers correctly for a non-zero seat"
        status: pass
      - kind: unit
        ref: "src/econ/botMatches.test.ts#checkGameOver returns loss for every seat when all seats are eliminated simultaneously"
        status: pass
    human_judgment: false
  - id: D4
    description: "Single-player parity preserved: forSeat=0 behaviour is bit-identical to the pre-refactor seat-0-hardcoded logic"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "src/econ/botMatches.test.ts#pickNextOpponent avoids immediate rematches and skips the eliminated"
        status: pass
      - kind: unit
        ref: "src/econ/botMatches.test.ts#checkGameOver: loss when human dies, win when all bots die"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-16
status: complete
---

# Phase 1 Plan 1: Seat-Agnostic Matchmaking and Game-Over Summary

**`pickNextOpponent(state, forSeat, rng)` and `checkGameOver(state, forSeat)` are seat-parameterized, `localSeatIndex` replaces the seat-0 hardcoding in `src/main.ts`, and a 14-test symmetric-seat suite proves the degenerate seat counts (one living, two living, simultaneous elimination, ordering stability, power-independence).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-16T17:33:00Z
- **Completed:** 2026-08-16T17:41:10Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `pickNextOpponent` takes an explicit `forSeat` argument, replacing the `i !== 0` living-seat filter with `i !== forSeat`; single-player (`forSeat = 0`) behaviour is unchanged byte-for-byte.
- `src/main.ts` gains a module-level `localSeatIndex` (defaults to `0`); `humanEcon()` now reads `run.players[localSeatIndex]` and both call sites (`initFreshRun`, the combat-start opponent-resolution branch) pass it through. Zero literal `players[0]` reads remain in `src/main.ts`.
- `checkGameOver(state, forSeat)` resolves win/loss for any seat, with the eliminated-check evaluated before the last-seat-standing check — the load-bearing order that makes simultaneous total elimination read `'loss'` for every seat rather than spuriously `'win'` for one.
- A 14-test suite in `src/econ/botMatches.test.ts` proves seat symmetry across every probe-derived edge: no self-pairing for any seat, the `-1` sentinel with one living seat, deterministic two-seat swapping, shrinking-pool eliminations, seeded ordering stability, board-power independence, and simultaneous total elimination.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "the local seat is seat N, not seat 0"** - `2223a4c` (feat)
2. **Task 2: Seat-symmetric game-over check** - `0cca6e6` (feat)
3. **Task 3: Symmetric-seat test suite** - `f97da79` (test)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge, not by this agent (`.planning/` is gitignored and orchestrator-owned per `commit_docs: false`)._

## Files Created/Modified
- `src/econ/botMatches.ts` - `pickNextOpponent(state, forSeat, rng)` and `checkGameOver(state, forSeat)` seat-parameterized; internal calls in `resolveBotRound`/`resolveBotCreepRound` updated to pass literal `0` (Plan 02's job to replace with a real seat parameter)
- `src/main.ts` - `localSeatIndex` module var added; `humanEcon()` rewired; both `pickNextOpponent`/`checkGameOver` call sites updated; combat-start opponent guard now also rejects `oppIdx === localSeatIndex`
- `src/econ/botMatches.test.ts` - existing tests updated to the new two-argument signatures; one new non-zero-seat `pickNextOpponent` test (Task 1); 8 new symmetric-seat behavior tests (Task 3)

## Decisions Made
- Task 2's own acceptance criteria required both `tsc --noEmit` and `vitest run src/econ/botMatches.test.ts` to be clean, but the pre-existing `checkGameOver(run)` test calls only compile against the new two-argument signature. Rather than leave the build broken until Task 3 (which the plan's action text loosely implied), the three call sites were updated to `checkGameOver(run, 0)` inline in Task 2, keeping assertions byte-identical — exactly the target state Task 3's own instructions already described for this test. Task 3 then added the full symmetric-seat suite around it.
- The board-power-independence test needed `run.nextOpponent = pick` threaded between calls (mirroring how real callers update state) — without it, the anti-rematch filter permanently excludes whichever seat happens to be the default `state.nextOpponent` (`1`), and the test's "both boards get picked" assertion would never see the excluded seat.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `checkGameOver` test call sites to the new signature inside Task 2, not deferred to Task 3**
- **Found during:** Task 2 (Seat-symmetric game-over check)
- **Issue:** Changing `checkGameOver`'s exported signature to `(state, forSeat)` broke the three pre-existing `checkGameOver(run)` calls in `botMatches.test.ts` (TS2554: expected 2 arguments, got 1), which blocked both of Task 2's own verification gates (`tsc` clean, `vitest` 0 failed).
- **Fix:** Updated the three call sites to `checkGameOver(run, 0)`, keeping every assertion exactly as written — this is the identical minimal edit Task 3's own action text already specifies for this test ("keep its assertions exactly as they are").
- **Files modified:** `src/econ/botMatches.test.ts`
- **Verification:** `npx tsc --noEmit` → 0 errors in `src/main.ts`/`src/econ/`; `npx vitest run src/econ/botMatches.test.ts` → 6/6 passed.
- **Committed in:** `0cca6e6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the build compiling and Task 2's own acceptance gates satisfiable; no scope creep — Task 3 still added the full 8-test symmetric-seat suite on top exactly as specified.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/econ/botMatches.ts` and `src/main.ts` are fully seat-agnostic for opponent selection and game-over; Plan 02 can now parameterize `resolveBotRound`/`resolveBotCreepRound` (currently passing a literal `0` internally) without touching this plan's surface.
- No blockers. The threat model recorded in `01-01-PLAN.md` notes `localSeatIndex` tampering and per-seat disclosure as `accept`-disposition risks that only become security-relevant once a server is authoritative (Phase 3+); nothing here needs remediation before then.

---
*Phase: 01-seat-agnostic-core-refactor*
*Completed: 2026-08-16*

## Self-Check: PASSED

- FOUND: src/main.ts
- FOUND: src/econ/botMatches.ts
- FOUND: src/econ/botMatches.test.ts
- FOUND: .planning/phases/01-seat-agnostic-core-refactor/01-01-SUMMARY.md
- FOUND commit: 2223a4c (Task 1)
- FOUND commit: 0cca6e6 (Task 2)
- FOUND commit: f97da79 (Task 3)
- FOUND commit: 1443ba4 (docs: SUMMARY.md)
