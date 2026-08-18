---
phase: 03-partykit-room-server
plan: 04
subsystem: party-room-server
tags: [partykit, typescript, integration-test, round-loop]

# Dependency graph
requires:
  - phase: 03-partykit-room-server plan 02
    provides: "encodeFightLog/decodeFightLog/cloneFightLog — src/net/fightWire.ts"
  - phase: 03-partykit-room-server plan 03
    provides: "party/seats.ts seat table, party/lobby.ts seat-lifecycle wiring, scripts/roomHarness.ts/roomSeats.ts"
provides:
  - "party/lobby.ts's full server-driven round loop: beginPlanning/onDeadline/broadcastResolve, a phase machine (planning/resolving/idle) with a hard wrong-phase reject boundary, and per-seat fight-chunk streaming keyed by logIndex so a human-vs-human pairing sends both participants byte-identical bytes"
  - "planningMsFor(env) — the environment-override pattern for the room's planning-deadline duration, read from PartyKit's env binding, not process.env"
  - "scripts/roomRound.ts — 7-scenario end-to-end proof against a real partykit dev server, npm run room:round"
affects: [Phase 4 (client networking consumes phase/resolve/fight-chunk messages exactly as this plan defines them), Phase 5 (per-round bandwidth logging here gives Phase 5 a real number before deploying over the internet)]

# Actuals (#2632)
actuals:
  tokens: 9800
  tasks: 3
  commits: 3
  interrupted: true

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase guard as the FIRST statement of onDeadline (phase flips to 'resolving' before resolveRound runs), and onMessage rejects any action outside 'planning' with wrong-phase rather than queueing — closes the window where a buy could apply against a partially-settled economy"
    - "Each distinct FightLog is encoded exactly once per round (keyed by logIndex), never once per recipient — a human-vs-human pairing's two participants receive the SAME chunk bytes, not two independently-encoded copies of the same fight"
    - "PartyKit's env binding (Party.Room.env), not process.env, is how a room reads a --var override inside the workerd sandbox — process.env is a polyfill that never reflects the host process or CLI flags there"

key-files:
  created:
    - scripts/roomRound.ts
  modified:
    - party/lobby.ts
    - src/net/protocol.ts
    - scripts/roomHarness.ts
    - package.json

key-decisions:
  - "PLANNING_MS's environment override (specified by the plan as process.env.PLANNING_MS) does not work inside partykit's workerd sandbox — verified empirically that process.env there is a polyfill that never reflects the host environment or a --var flag. Fixed by reading env.PLANNING_MS through a new planningMsFor(env: Record<string, unknown> | undefined): number function, called with this.room.env inside beginPlanning(), instead of a process.env-backed module constant. scripts/roomHarness.ts's withRoom() gained a `vars` parameter that translates to `--var KEY=VALUE` CLI flags. Without this fix, scripts/roomRound.ts's PLANNING_MS=2000 override would have silently no-op'd and the integration script would have spent a real 30 real seconds per round (10 rounds ≈ 5 minutes just in planning waits) instead of ~2s."
  - "roomRound.ts's zero-connection-pause scenario (7) showed one transient 'nextMessage timed out after 10000ms' on a first full run before a clean re-run passed every scenario including that one — not chased further as a flake since two full clean runs (and the deliberately-added retry/timeout budget already in the harness) both passed; recorded here rather than silently ignored. If this recurs under Phase 4 real-browser testing, the first place to look is reconnect timing right after the last connection closes."

requirements-completed: [LOBBY-04, COMBAT-01]

coverage:
  - id: D1
    description: "Both clients receive a phase message with the same round and the same absolute deadline (server clock, not per-client), within tolerance of the configured PLANNING_MS"
    requirement: "LOBBY-04"
    verification:
      - kind: e2e
        ref: "scripts/roomRound.ts — scenario 1 (shared deadline)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An action arriving before the deadline is accepted; the phase flips to resolving before resolveRound runs, so an action landing during resolution is rejected wrong-phase, never half-applied — verified from both possible timing branches"
    requirement: "LOBBY-04"
    verification:
      - kind: e2e
        ref: "scripts/roomRound.ts — scenario 2 (deadline boundary), both branches assert gold matches a fully-consistent outcome"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rounds advance by exactly 1 each resolve across creep/item/PvP kinds, with both clients' snapshots agreeing on round and pool after every resolve; creep/item rounds carry no PvP fight log (fightId: null, zero chunks for item rounds; non-null logIndex per living human seat for creep rounds)"
    requirement: "LOBBY-04"
    verification:
      - kind: e2e
        ref: "scripts/roomRound.ts — scenario 3 (rounds advance) and scenario 4 (creep/item rounds carry no PvP log)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The COMBAT-01 proof: a human-vs-human PvP pairing (forced by polling nextOpponent until 0-vs-1) sends both participants the same non-null fightId, the same chunk count, and byte-identical gzipB64 bytes; both decode to deep-equal FightLogs with >100 strictly-increasing-tick frames; both play back through applyFrame without throwing; playbackWinner agrees with each side's own SeatFightResult.won/hpLost"
    requirement: "COMBAT-01"
    verification:
      - kind: e2e
        ref: "scripts/roomRound.ts — scenario 5 (the human-vs-human fight)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nothing oversized is ever persisted to room storage — storageKeys is exactly [\"run\"] after a real PvP resolve, and the timer/phase machine correctly pauses with zero connections and resumes cleanly on reconnect with no round regression"
    requirement: "LOBBY-04"
    verification:
      - kind: e2e
        ref: "scripts/roomRound.ts — scenario 6 (nothing oversized persisted) and scenario 7 (zero-connection pause)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-08-17
status: complete
---

# Phase 3 Plan 4: Server-Driven Round Loop Summary

**`party/lobby.ts` now runs the whole round loop itself — server-clock planning deadlines, a hard planning/resolving phase boundary that rejects late actions rather than half-applying them, and per-seat fight-chunk streaming that proves (byte-identical, not just logically-equal) two humans paired against each other watch the exact same server-run fight — verified end-to-end against a real `partykit dev` server across 10 real rounds, not mocked.**

## Performance

- **Duration:** ~70 min active work across 2 dispatches (Tasks 1+2 completed in the first dispatch, ~35 min; that dispatch hit a session limit right as it started Task 3; a fresh scoped dispatch completed Task 3, ~35 min, with one 600s stream stall right after its own final re-verification passed, resumed by the orchestrator to commit and finish)
- **Started:** 2026-08-17T21:31:00Z
- **Completed:** 2026-08-17T22:20:00Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- **Task 1 — phase machine and planning deadline:** `beginPlanning()` opens a planning phase on the server's own clock (absolute epoch deadline broadcast alongside `serverNow` for client clock-skew correction), `onDeadline()` flips `phase` to `'resolving'` as its first statement before calling the unmodified `resolveRound()`, and `onMessage` rejects any action outside `'planning'` with `wrong-phase` rather than queueing it. The timer runs only while at least one connection is present (plain `setTimeout`, not a Durable Object alarm — per the plan's own noted assumption, not yet needing the alarm fallback).
- **Task 2 — resolve and fight-chunk streaming:** `broadcastResolve()` sends every connected seat its settled `RoundResult` plus, only when it actually fought, the exact recorded fight it fought in — encoded exactly once per distinct `logIndex`, not once per recipient, so a human-vs-human pairing's two participants get the same chunk bytes. A seat with a null `logIndex` (bye, abstract bot-vs-bot, item round) gets `fightId: null` and zero fight-chunk messages. Per-round bandwidth (distinct logs, chunk count, total bytes) is logged for Phase 5's reference.
- **Task 3 — the 7-scenario end-to-end proof:** `scripts/roomRound.ts` drives two real `partysocket` clients against a live `partykit dev` server through 10 real rounds (creep → item → PvP mix), proving: shared server-clock deadlines, correct deadline-boundary action handling in both possible timing branches, rounds advancing by exactly 1 with pool/round agreement between clients, creep/item rounds correctly carrying no PvP log, the full COMBAT-01 byte-identity + playback + winner-agreement proof, room storage staying at exactly `["run"]`, and correct zero-connection pause/reconnect-resume behavior.
- **Real runtime bug found and fixed:** the plan specified `PLANNING_MS`'s test-only environment override as `process.env.PLANNING_MS`, but this does not work inside PartyKit's workerd sandbox — verified empirically that `process.env` there is a polyfill that never reflects the host process's environment or a `--var` CLI flag. Fixed with `planningMsFor(env)`, reading PartyKit's actual `env` binding (`Party.Room.env`), and extended `roomHarness.ts`'s `withRoom()` with a `vars` parameter that maps to `--var KEY=VALUE` flags.

## Task Commits

1. **Task 1: The phase machine and the server-side planning deadline** - `fc54ca3` (feat)
2. **Task 2: Broadcast the resolve and stream each participant their fight** - `b71928e` (feat)
3. **Task 3: End-to-end round — two clients shop, the deadline fires, both watch the fight the server ran** - `ba4d41d` (test, includes the planningMsFor fix)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge (`.planning/` is gitignored, `commit_docs: false`)._

## Files Created/Modified
- `party/lobby.ts` — `beginPlanning`/`clearTimer`/`onDeadline`/`broadcastPhase`/`broadcastResolve`, `roundSeedFor`, deadline/timer instance fields, phase guard in `onMessage`
- `src/net/protocol.ts` — `ServerMessage` gains `phase`/`resolve`/`fight-chunk` variants; `planningMsFor(env)` replaces the plan's originally-specified `process.env`-backed approach
- `scripts/roomHarness.ts` — `withRoom()` gains a `vars` parameter for `--var` injection
- `scripts/roomRound.ts` — new, the 7-scenario integration proof
- `package.json` — `room:round` script added

## Decisions Made
See `key-decisions` in frontmatter for the `planningMsFor`/workerd-sandbox finding and the one transient scenario-7 timeout note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Blocking, found during Task 3] `process.env.PLANNING_MS` does not work inside partykit's workerd sandbox**
- **Found during:** Task 3, wiring `roomHarness.ts` to spawn a fast-planning room for the integration script
- **Issue:** The plan's action text specified `Number(process.env.PLANNING_MS ?? 30_000)` as the override mechanism. Empirically, `partykit dev`'s workerd sandbox exposes a `process` polyfill whose `.env` never reflects the host process's environment variables or a `--var` CLI flag.
- **Fix:** `planningMsFor(env: Record<string, unknown> | undefined): number` reads PartyKit's actual `env` binding (`Party.Room.env`, called as `planningMsFor(this.room.env)` inside `beginPlanning()`), not `process.env`. `roomHarness.ts`'s `withRoom()` gained a `vars` parameter that becomes `--var KEY=VALUE` flags on the spawned `partykit dev` process.
- **Files modified:** `src/net/protocol.ts`, `party/lobby.ts`, `scripts/roomHarness.ts`
- **Verification:** `scripts/roomRound.ts` completed 10 rounds in well under a minute (each PvP round resolved in ~2s, matching the `PLANNING_MS=2000` override) rather than the ~5 minutes 10 rounds at the real 30s default would have taken — direct evidence the override is actually working, not silently falling back.
- **Committed in:** `ba4d41d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (blocking, real runtime-environment bug), 1 non-blocking flake noted for future attention
**Impact on plan:** No scope creep — the fix is contained to the override mechanism the plan itself asked for; the plan's own specified implementation just didn't work in this runtime.

## Issues Encountered
Two session interruptions during this plan, both recovered without work loss:
1. The first dispatch (Tasks 1+2) hit an API session limit right as it began Task 3 — Tasks 1+2 were already committed, so the orchestrator merged them into master and re-dispatched a fresh, narrowly-scoped worktree for Task 3 alone.
2. The Task 3 dispatch hit a 600-second stream stall immediately after its own final re-verification passed (two clean consecutive `roomRound.ts` runs, per its own report) — the orchestrator resumed directly: re-ran `tsc`, `roomRound.ts` (twice, both clean), `roomSmoke.ts`, `roomSeats.ts`, and the `src/net`/`src/game`/`party` vitest suites, then committed and wrote this SUMMARY.

## User Setup Required
None for the code itself. Phase 3's own success — a real client connecting to a real room over the internet — still requires Phase 5's deployment work; this plan only proves the room's local (`partykit dev`) behavior is correct.

## Next Phase Readiness
- Phase 3 is functionally complete: all four ROADMAP success criteria are now demonstrated end-to-end by `roomSmoke` (a single client can connect/act/see state), `roomSeats` (two clients, seat lifecycle, pool safety, forged-seat isolation), and `roomRound` (the full server-driven round loop, including the COMBAT-01 fight-log proof).
- Phase 4 (client networking) can build directly against the `phase`/`resolve`/`fight-chunk` `ServerMessage` variants exactly as exercised here — `scripts/roomRound.ts` is effectively a reference implementation of the message sequence a real browser client will need to handle.
- Phase 5 has real per-round bandwidth numbers logged by `broadcastResolve()` to plan around before this runs over an actual internet connection.
- No blockers. The one open item is the transient scenario-7 timeout noted in key-decisions — not reproduced on a second run, flagged for attention if it recurs under Phase 4's real-browser testing.

---
*Phase: 03-partykit-room-server*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: party/lobby.ts
- FOUND: src/net/protocol.ts
- FOUND: scripts/roomHarness.ts
- FOUND: scripts/roomRound.ts
- FOUND: package.json (modified)
- FOUND: .planning/phases/03-partykit-room-server/03-04-SUMMARY.md
- FOUND commit: fc54ca3 (Task 1)
- FOUND commit: b71928e (Task 2)
- FOUND commit: ba4d41d (Task 3)
