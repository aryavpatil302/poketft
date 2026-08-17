---
phase: 03-partykit-room-server
plan: 01
subsystem: net-transport
tags: [typescript, partykit, partysocket, websocket, room-server]

# Dependency graph
requires:
  - phase: 02-transport-agnostic-round-engine plan 01
    provides: "applyAction / startPlanning / GameAction / ActionReason / ActionResult — src/game/round.ts"
  - phase: 02-transport-agnostic-round-engine plan 01
    provides: "RunState / PlayerEcon / newRun / livingPlayers — src/econ/runState.ts"
provides:
  - "party/lobby.ts — default-export Lobby room class implementing Party.Server; owns one authoritative RunState per room id"
  - "src/net/protocol.ts — shared client/server wire vocabulary (ClientMessage/ServerMessage/RoomPhase/RejectReason/LobbySeatView/parseClientMessage), the single type surface the Phase 4 browser client will also import"
  - "scripts/roomHarness.ts — withRoom()/connect()/nextMessage() reusable partykit dev spawn/teardown for automated Node verification, reused by every later plan in this phase"
  - "src/econ/botNames.ts — HUMAN_CHARACTER_NAMES/pickRandomNames, recreated as a genuine missing dependency (see Deviations)"
affects: [03-03 (seat lifecycle extends Lobby/newRoomRun), 03-04 (planning timer extends Lobby), Phase 4 (browser client imports src/net/protocol.ts and drives the same room over partysocket)]

# Actuals (#2632)
actuals:
  tokens: 4300
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added:
    - "partykit@0.0.115 (devDependency) — local Workers/Durable-Object room runtime and dev server"
    - "partysocket@1.3.0 (dependency) — WebSocket client; project's first runtime dependency"
  patterns:
    - "Seat authority resolved solely from the room-assigned connection identity (occupants[] scan by conn.id) — ClientMessage has no seat field by construction, so a client has no syntax to name one"
    - "Room storage persisted after every accepted mutation (this.room.storage.put('run', ...)) — measured ~5 KiB per RunState, comfortably under the 128 KiB Durable Object per-value limit"
    - "Automated partykit dev lifecycle (spawn, poll onRequest for readiness, always SIGTERM in finally) makes every later plan in this phase verifiable end-to-end from Node, no manual server management"

key-files:
  created:
    - partykit.json
    - src/net/protocol.ts
    - party/lobby.ts
    - scripts/roomHarness.ts
    - scripts/roomSmoke.ts
    - src/econ/botNames.ts
  modified:
    - package.json
    - package-lock.json
    - tsconfig.json
    - .gitignore

key-decisions:
  - "Task 1 (checkpoint:decision, gate=blocking) was pre-approved by the orchestrator before this execution started: partykit@0.0.115 and partysocket@1.3.0 were registry-verified (github.com/partykit/partykit and github.com/cloudflare/partykit respectively, MIT, maintainer threepointone, 31,853 and 8,159,411 weekly downloads) as legitimate, no typosquat signals. Decision: proceed. This record is carried forward verbatim from the orchestrator's dispatch context; no registry re-check was performed in this execution."
  - "newRoomRun() grants every seat a 5-gold starting stake before the first shop roll. newRun() alone leaves every seat at STARTING_GOLD (0); round 1 in this game is genuinely unaffordable until income settles (confirmed against src/game/round.test.ts, which manually sets gold=10 before testing a buy). Single-player's src/main.ts has this exact behavior in initFreshRun() ('everyone gets a small stake') but that function is browser-only and not importable from the room (would drag DOM globals into the Workers bundle). Mirrored the 5-gold stake directly in newRoomRun() so the room matches single-player's fresh-run economy instead of diverging from it — this was necessary for the plan's own acceptance criteria ('a buy mutates gold... by exactly one copy') to be achievable at all."
  - "scripts/roomSmoke.ts generates a unique room id per run (smoke-<timestamp>-<random>) instead of a fixed 'smoke' id. partykit dev's local Durable Object storage (.partykit/state) persists across dev-server restarts on disk, so a fixed room id let one run's mutations leak into the next run's onStart() load, producing a non-deterministic smoke test (discovered directly: the second run failed on the exact bug the first run's code had already fixed, because it loaded the first run's stale persisted RunState instead of building fresh)."
  - "Added .partykit/ to .gitignore — partykit dev's local per-room Durable Object storage; purely local dev-server state, never meant to be committed."
  - "party/lobby.ts does not import livingPlayers from src/econ/runState, despite the plan's interface_context listing it alongside newRun/RunState as an import. It has no use in this tracer's onConnect/onClose/onMessage/onRequest paths, and importing it unused would fail tsconfig's noUnusedLocals (part of this plan's own zero-tsc-errors acceptance criterion). Left for whichever later plan (03-03's seat lifecycle) actually needs it."

requirements-completed: [LOBBY-01, LOBBY-02]

coverage:
  - id: T-1
    description: "A locally-running partykit dev room accepts a WebSocket connection from a Node client and replies with a welcome message carrying the seat index that connection now owns"
    requirement: LOBBY-02
    verification:
      - kind: integration
        ref: "scripts/roomSmoke.ts — welcome arrives with seat === 0, protocol === PROTOCOL_VERSION"
        status: pass
    human_judgment: false
  - id: T-2
    description: "The room owns exactly one RunState per room id, created server-side; no client ever supplies it"
    requirement: LOBBY-01
    verification:
      - kind: integration
        ref: "scripts/roomSmoke.ts — snapshot.players.length === PLAYER_COUNT, seat 0 personaId null, every other seat non-null personaId, all server-originated"
      - kind: static
        ref: "src/net/protocol.ts's ClientMessage carries no state-bearing field of any kind (verified: exactly one variant, action-only)"
        status: pass
    human_judgment: false
  - id: T-3
    description: "An action sent by a connected client mutates the room's authoritative RunState and the resulting snapshot is broadcast back to that client"
    requirement: LOBBY-01
    verification:
      - kind: integration
        ref: "scripts/roomSmoke.ts — buy decreases gold, adds the unit to bench/board, decrements pool[definitionId] by exactly 1, all observed via the broadcast snapshot"
        status: pass
    human_judgment: false
  - id: T-4
    description: "The first connection is assigned seat 0 (the lowest bot seat), converting it from a bot seat to a human seat"
    requirement: LOBBY-02
    verification:
      - kind: integration
        ref: "scripts/roomSmoke.ts — welcome.seat === 0 and welcome.snapshot.players[0].personaId === null"
        status: pass
    human_judgment: false
  - id: T-5
    description: "The room's authoritative RunState serializes to roughly 5 KiB, two orders of magnitude below the 128 KiB Durable Object per-key storage limit"
    requirement: LOBBY-01
    verification:
      - kind: static
        ref: "party/lobby.ts persist() comment records the ~5 KiB measurement inherited from planning; not independently re-measured this run"
        status: pass
    human_judgment: false
  - id: T-6
    description: "Broadcast delivery order across distinct connections is unspecified; per-connection message order is FIFO — nothing in this phase depends on cross-connection ordering"
    requirement: LOBBY-01
    verification:
      - kind: static
        ref: "single-connection tracer scope — no cross-connection ordering path exists yet to violate this"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-17
status: complete
---

# Phase 3 Plan 1: PartyKit Room Server — Tracer Slice Summary

**A real PartyKit room, running locally, owns a `RunState` no client supplied, hands a connecting Node client the lowest bot seat, applies exactly one action through the unmodified Phase 2 engine, and broadcasts the result — proving the whole Phase 3 architecture on one committed vertical slice, verified end-to-end by `npx tsx scripts/roomSmoke.ts`.**

## Task 1: Dependency approval (pre-approved, carried forward)

Task 1 was a `checkpoint:decision` gate (`gate="blocking"`) requiring human approval before installing `partykit`/`partysocket`. Per the orchestrator's dispatch context, this had already been resolved in a prior attempt: registry checks were performed and both packages verified legitimate —

- `partykit@0.0.115` — github.com/partykit/partykit, MIT, maintainer `threepointone`, 31,853 weekly downloads
- `partysocket@1.3.0` — github.com/cloudflare/partykit, MIT, same maintainer, 8,159,411 weekly downloads, actively maintained through 2026-06-23

Decision: **proceed**. No file changes or commits resulted from Task 1 itself (it is a pure gate); execution proceeded directly to Task 2.

## Measured values

- **tsc error baseline before this plan:** 16 (all in unrelated pre-existing ability files)
- **tsc error baseline after widening `include` to `["src", "party", "scripts"]`:** 16 — unchanged, as required
- **`compatibilityDate` the installed CLI accepted:** `2024-11-11` (the plan's suggested value; no substitution needed)
- **Workers bundle:** `src/game/round.ts` and its transitive `src/core/`/`src/econ/` imports bundled and ran correctly inside the local `partykit dev` (workerd) runtime with no DOM-global pull-in — the smoke test's full buy round-trip exercises this path directly.

## Accomplishments

- Installed `partykit` (devDependency) and `partysocket` (dependency) — this project's first runtime dependency — and wired `partykit.json`, widened `tsconfig.json`'s `include`, and added `room:dev`/`room:smoke`/`typecheck` npm scripts.
- `src/net/protocol.ts`: the shared wire vocabulary between the room and the future browser client. `ClientMessage` has exactly one variant (`action`) and, by construction, carries no seat-bearing and no state-bearing field — the two load-bearing security properties the plan required, documented inline and holding as the union will grow in later plans.
- `party/lobby.ts`: the `Lobby` room (`default export`, implements `Party.Server`). Owns one authoritative `RunState` per room, all seats bot-held at creation via a module-local `newRoomRun()`. `onConnect` assigns the lowest free seat and converts it to human by nulling `personaId`; the first occupied seat triggers `startPlanning()` so the client has a rolled shop. `onMessage` resolves the acting seat *solely* by scanning `occupants` for the sender's connection id — never from the payload — then applies the action through the unmodified Phase 2 `applyAction`, persisting and broadcasting only on success. `onRequest` exposes only room metadata (id/phase/round/connection count/storage keys), never `RunState` or player identity.
- `scripts/roomHarness.ts` / `scripts/roomSmoke.ts`: a reusable `partykit dev` spawn/teardown harness (health-polled, always SIGTERM'd in `finally`) and an end-to-end Node smoke client that connects, takes seat 0, buys a unit, and verifies the room's own authoritative snapshot reflects the purchase — then sends a malformed payload and verifies rejection with no state change.
- All five `<verify>` gates pass: `npx tsx scripts/roomSmoke.ts` exits 0 with no leaked `partykit dev`/`workerd` process; `npx tsc --noEmit` is clean under `party/`, `scripts/`, `src/net/` and holds the 16-error project-wide baseline; `grep -c "export default class Lobby" party/lobby.ts` is 1; the browser-import grep is 0; `ClientMessage` has exactly one variant with neither a seat nor a state field.

## Task Commits

1. **Task 2: Install the transport dependencies and wire the room build config** - `448fc3f` (feat)
2. **Task 3: End-to-end tracer — client connects, acts, sees authoritative state** - `71563bd` (feat)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge (`.planning/` is gitignored, `commit_docs: false`)._

## Files Created/Modified
- `partykit.json` — room config (`main: party/lobby.ts`, `compatibilityDate: 2024-11-11`)
- `src/net/protocol.ts` — `PLANNING_MS`, `PROTOCOL_VERSION`, `RoomPhase`, `RejectReason`, `LobbySeatView`, `ClientMessage`, `ServerMessage`, `parseClientMessage()`
- `party/lobby.ts` — `default class Lobby` (implements `Party.Server`), module-local `newRoomRun()`, `lobbyView()`
- `scripts/roomHarness.ts` — `ROOM_PORT`, `withRoom()`, `connect()`, `nextMessage()`
- `scripts/roomSmoke.ts` — end-to-end smoke client
- `src/econ/botNames.ts` — `HUMAN_CHARACTER_NAMES`, `pickRandomNames()` (recreated, see Deviations)
- `package.json`, `package-lock.json` — `partykit`/`partysocket` deps, `room:dev`/`room:smoke`/`typecheck` scripts
- `tsconfig.json` — `include` widened to `["src", "party", "scripts"]`
- `.gitignore` — added `.partykit/` (local `partykit dev` Durable Object storage)

## Decisions Made
See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking, missing referenced file] `src/econ/botNames.ts` did not exist in this isolated worktree**
- **Found during:** Task 3, reading `interface_context`'s listed import surface before writing `party/lobby.ts`
- **Issue:** The plan's `interface_context` and `read_first` sections both name `src/econ/botNames.ts`'s `pickRandomNames` as an already-existing dependency to import. It does not exist anywhere in this worktree's git history (`git log --all -- src/econ/botNames.ts` is empty). The main repo's working tree (outside this isolated worktree) has this exact file present but *uncommitted* — this worktree, created via `git worktree add` from a committed base, never received it.
- **Fix:** Recreated `src/econ/botNames.ts` with content matching what the plan already assumed (confirmed against the main repo's uncommitted copy and its own untracked `botNames.test.ts`, which the plan does not require here and was not added).
- **Files modified:** `src/econ/botNames.ts` (new)
- **Verification:** `npx tsc --noEmit` clean under `party/`; `party/lobby.ts`'s import resolves.
- **Committed in:** `71563bd` (Task 3)
- **Note:** This is the sole reason the phase-level check `git diff --name-only HEAD -- src/game/ src/econ/ src/core/ src/main.ts` prints a line (`src/econ/botNames.ts`) instead of nothing — it is a new file addition recreating a pre-existing dependency, not a modification of any existing engine file. No existing Phase 1/2 engine file (`round.ts`, `runState.ts`, `bots.ts`, `shop.ts`, etc.) was touched.

**2. [Rule 1 - bug] `newRoomRun()` needed a starting-gold grant for the plan's own buy-and-verify acceptance criteria to be achievable**
- **Found during:** Task 3, first `roomSmoke.ts` run — the buy action failed with `{ t: 'rejected', reason: 'no-gold' }`
- **Issue:** `newRun()` (src/econ/runState.ts) leaves every seat at `STARTING_GOLD` (0). Round 1 in this game's real economy is genuinely unaffordable — confirmed independently against `src/game/round.test.ts`, which manually sets `gold = 10` before testing a buy specifically because a fresh `RunState` cannot afford anything. Single-player's `src/main.ts` grants every fresh run a small stake via `initFreshRun()` before the first shop roll, but that function is browser-only and out of bounds for the room to import (would drag DOM globals into the Workers bundle, and this phase's own artifact constraints forbid touching/importing `src/main.ts`).
- **Fix:** `newRoomRun()` now sets `p.gold = 5` for every seat, mirroring `initFreshRun`'s stake, with an inline comment explaining why this exists and why it can't just import the single-player function.
- **Files modified:** `party/lobby.ts`
- **Verification:** `npx tsx scripts/roomSmoke.ts` — buy now succeeds, gold decreases, pool decrements by exactly 1.
- **Committed in:** `71563bd` (Task 3)

**3. [Rule 1 - bug] `partykit dev`'s local Durable Object storage made the smoke test non-deterministic across runs**
- **Found during:** Task 3, second `roomSmoke.ts` run after fixing deviation #2 — the buy still failed with `no-gold`, because `.partykit/state`'s persisted `RunState` from the *first* (pre-fix) run was loaded by `onStart()` for the same fixed room id `'smoke'`, instead of a fresh `newRoomRun()`.
- **Issue:** `partykit dev`'s local Durable Object storage persists to disk across dev-server restarts. A fixed room id makes repeated smoke-test runs mutate shared, accumulating state rather than starting fresh each time — the opposite of what a repeatable automated verification script needs.
- **Fix:** `scripts/roomSmoke.ts` now generates a unique room id per invocation (`smoke-<timestamp>-<random>`). Also added `.partykit/` to `.gitignore` (this local storage was never meant to be committed).
- **Files modified:** `scripts/roomSmoke.ts`, `.gitignore`
- **Verification:** Re-ran `npx tsx scripts/roomSmoke.ts` twice in a row with no manual storage cleanup between runs; both passed identically.
- **Committed in:** `71563bd` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 blocking missing-file, 2 blocking bugs), all within Rules 1/3, all committed with Task 3.
**Impact on plan:** No scope creep — all three fixes were required for the plan's own stated acceptance criteria (a successful buy-and-verify round trip, repeatable end-to-end) to be achievable at all. The plan's core architecture (seat authority via connection identity only, no client-supplied state, unmodified Phase 2 engine) is exactly as specified.

## Out-of-Scope Discoveries (logged, not fixed)

7 pre-existing test failures across `src/econ/bots.test.ts`, `src/econ/constants.test.ts`, `src/econ/income.test.ts`, and `src/econ/xp.test.ts` (all XP/leveling-table mismatches), found while running this plan's own phase-level regression check (`npx vitest run src/game src/econ`). None of these files are touched by this plan; all were last modified at commit `081571e`, well before this worktree's base. Logged to `.planning/phases/03-partykit-room-server/deferred-items.md` rather than fixed — out of this plan's file scope and the phase's engine-untouched invariant. `src/game`'s own suite (the actual Phase 2 baseline this plan must not regress) passes 76/76 with zero changes.

## Issues Encountered

The plan's `interface_context` listed `src/econ/botNames.ts` and a 5-gold-equivalent starting stake as already-solved problems (the former as a pre-existing import, the latter implicitly by assuming a buy would just work). Neither was actually available inside this isolated git worktree — see Deviations #1 and #2. Both were genuine gaps discovered only by running the plan's own verification, not scope creep.

## User Setup Required
None. `npm run room:dev` starts the local room; `npm run room:smoke` re-runs the automated verification at any time.

## Next Phase Readiness
- `party/lobby.ts`'s `newRoomRun()`, `Lobby` class structure, and `scripts/roomHarness.ts`'s `withRoom()`/`connect()`/`nextMessage()` are ready for Plan 03-03 (seat lifecycle: fill/reclaim bot seats, two concurrent clients) and Plan 03-04 (planning timer, fight-log streaming) to extend directly.
- `src/net/protocol.ts`'s `ClientMessage`/`ServerMessage` unions are ready to grow new variants in both later plans without touching the two load-bearing security properties documented inline.
- No blockers for 03-03 or 03-04.

---
*Phase: 03-partykit-room-server*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: partykit.json
- FOUND: src/net/protocol.ts
- FOUND: party/lobby.ts
- FOUND: scripts/roomHarness.ts
- FOUND: scripts/roomSmoke.ts
- FOUND: src/econ/botNames.ts
- FOUND commit: 448fc3f (Task 2)
- FOUND commit: 71563bd (Task 3)
