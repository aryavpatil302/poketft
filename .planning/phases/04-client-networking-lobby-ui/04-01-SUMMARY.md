---
phase: 04-client-networking-lobby-ui
plan: 01
subsystem: client-networking
tags: [partykit, partysocket, typescript, tracer, integration-test, lobby]

# Dependency graph
requires:
  - phase: 03-partykit-room-server plan 03
    provides: "party/seats.ts seat table (assignSeat/freeSeat/seatOf/lobbyView), scripts/roomHarness.ts withRoom/connect/nextMessage"
  - phase: 03-partykit-room-server plan 04
    provides: "party/lobby.ts's server-driven round loop, the phase/resolve/fight-chunk ServerMessage variants, planningMsFor(env)"
provides:
  - "src/net/lobbyUrl.ts — LOBBY_CODE_ALPHABET/LOBBY_CODE_LENGTH, newLobbyCode(rng?), isLobbyCode(value), parseLobbyCode(search), shareableLobbyUrl(origin, code), partyHost()"
  - "src/net/roomClient.ts — RoomClientStatus, RoomClientOptions, class RoomClient (connect/onMessage/onStatus/sendAction/sendStart/receiveRaw/close; getters seat/status/droppedFrames). DOM-free by construction, grep-enforced."
  - "src/net/protocol.ts (extended) — parseServerMessage(raw), RoomPhase gains 'lobby', ClientMessage gains {t:'start'}, RejectReason gains 'not-host' and 'already-started'"
  - "party/lobby.ts (extended) — host-gated start in onMessage, a persisted `started` flag, and an onStart that rehydrates a mid-game room into 'idle' rather than 'lobby'"
  - "src/main.ts (extended) — net, isNetworked(), netDropped, applyServerSnapshot(snapshot), bootNetworked(code), setNetStatusBanner(text), and a saveRun wrapper that refuses to persist a networked RunState"
  - "scripts/netClient.ts — npm run net:client, seven scenarios driving the real browser client module against a real partykit dev room, including a genuine room-process restart"
affects:
  - "Plan 04-02 (Title/Lobby screens) — replaces bootNetworked's placeholder name and the tracer's automatic sendStart() with the Lobby Screen's Start button"
  - "Plans 04-03/04-04 (full action dispatch) — every dispatch sits behind the same net !== null && !netDropped branch performReroll established"
  - "Plan 04-05 (server-driven countdown) — replaces renderPlanningTimer's isNetworked() early-return"
  - "Plan 04-06 (combat playback) — replaces startCombat's isNetworked() early-return"
  - "Phase 5 (deployment) — partyHost() reads VITE_PARTY_HOST; the persisted `started` flag is what makes a Cloudflare eviction survivable"

# Actuals (#2632)
actuals:
  tokens: 13000
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The room's started-ness is PERSISTED, not inferred from object freshness — onStart runs on every rehydration, so 'fresh object means lobby' would send a mid-game room back to the lobby wait. Two distinct stopped states ('lobby' = never started, 'idle' = started but clock stopped) is the shape that makes both a first-join and a restart correct."
    - "The browser's transport module is kept DOM-free so a Node script can drive the EXACT module the browser runs, not a reimplementation — this repo has no browser automation, so scripts/netClient.ts is the only automated coverage the client networking path has. receiveRaw() is public for the same reason: garbage-frame tests go through the same function the socket listener calls."
    - "saveRun is shadowed by a local wrapper in main.ts rather than audited across its 24 call sites — a single choke point that makes 'a networked session never writes to localStorage' true globally instead of per-call-site, and stays true as plans 04-03/04-04 add more."
    - "A failure banner lives on document.body, never inside #app, because renderEconUI/updateEconVisibility rebuild #app subtrees wholesale and would wipe it exactly when it matters."

key-files:
  created:
    - src/net/lobbyUrl.ts
    - src/net/lobbyUrl.test.ts
    - src/net/protocol.test.ts
    - src/net/roomClient.ts
    - scripts/netClient.ts
  modified:
    - src/net/protocol.ts
    - party/lobby.ts
    - src/main.ts
    - scripts/roomSmoke.ts
    - scripts/roomSeats.ts
    - scripts/roomRound.ts
    - package.json
    - .gitignore

key-decisions:
  - "PLAYER_COUNT lives in src/econ/constants.ts, not src/econ/runState.ts as Task 3's action text stated. Imported from constants — the same module scripts/roomSmoke.ts already imports it from. No behavioural difference; noted so a later plan does not chase a non-existent export."
  - "Task 1's roomClient.ts already implemented the complete status machine Task 3 asked for (close sets 'closed' unless already 'rejected'; error changes nothing; sends no-op outside 'open'), because the two tasks specify the same behaviour from different angles. Task 3 therefore changed no roomClient.ts code — its work landed entirely in main.ts and netClient.ts."
  - "scripts/roomSmoke.ts had to move its shop read from the welcome snapshot to the post-start opening snapshot. beginPlanning() calls startPlanning(), which rolls every unlocked seat's shop, so under the new host-gated start the welcome's slots are stale by the time the buy is sent. This was a real break introduced by the gate, caught by running the script rather than by reading it."
  - "netClient.ts scenario 3 retries the reroll against the next planning phase's own opening snapshot if the first attempt comes back 'wrong-phase'. With PLANNING_MS=2000 a reroll can legitimately land after the deadline; that is the room behaving correctly, and asserting against a stale gold baseline would have made the script flaky rather than correct."
  - "netClient.ts scenario 6 takes its round baseline only once the status endpoint reports connections===0 and timerScheduled===false. Reading it while a 2s deadline is still armed would let a legitimate round transition masquerade as a server-side effect of the post-drop send."
  - "A room-full rejection now also closes the socket client-side. partysocket reconnects internally, so without this a refused client would hammer a room that already said no — a self-inflicted flood, and adjacent to T-04-05's reasoning."
  - "npx tsc --noEmit and npm test do not exit 0 on this repo, and did not before this plan either (16 tsc errors, 24 failing tests, all in ability/econ files this plan does not touch). Verified scoped-clean instead: tsc reports zero errors in src/net/, party/, scripts/ and src/main.ts. Logged in deferred-items.md."

requirements-completed: [NET-01]

coverage:
  - id: D1
    description: "A client connects to a room by code, receives a welcome at the current PROTOCOL_VERSION, adopts the server's seat assignment, and reports status 'open' — the seat/snapshot half of NET-01"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 1 (seat and welcome)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A room nobody has started sits in phase 'lobby' with no timer scheduled; a start from seat 1 is rejected 'not-host' and leaves the phase untouched; only seat 0's start moves the room to 'planning', and both connections observe it (T-04-03)"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 2 (host-gated start)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An action sent through RoomClient.sendAction round-trips: seat 0's gold drops by exactly REROLL_COST in the server's own snapshot broadcast, never applied locally first"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 3 (action round-trip)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Non-JSON, a JSON array, an unknown discriminant, and a protocol-skewed welcome are all dropped by parseServerMessage before reaching any handler — droppedFrames rises by exactly 4, no handler fires, nothing throws (T-04-01)"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 4 (unrecognised frames are dropped)"
        status: pass
      - kind: unit
        ref: "src/net/protocol.test.ts — parseServerMessage suite (10 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A started room survives a real partykit dev PROCESS restart: phase is never observed as 'lobby' afterwards, it rehydrates 'idle', 'planning' resumes with no client sending start, the round does not regress, and a second start is rejected 'already-started'"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 5 (a started room survives a restart); two sequential withRoom() calls on one room id, gated on waitForRoomDown so the second healthcheck cannot answer from the dying server"
        status: pass
    human_judgment: false
  - id: D6
    description: "A dropped socket fires a 'closed' status transition, a subsequent sendAction neither throws nor produces any server-side effect, and no render state is cleared (HARD-01: the last server snapshot stays frozen on screen behind a banner)"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 6 (drop)"
        status: pass
      - kind: manual
        ref: "Deferred to the end-of-phase two-tab checklist: kill npm run room:dev with a lobby open, confirm a frozen board plus a red banner and an inert Reroll"
        status: deferred
    human_judgment: true
  - id: D7
    description: "A PLAYER_COUNT+1th connection to a full lobby is reported rejected with reason 'not-seated' within the harness timeout rather than hanging, and the status is not flattened to 'closed'"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 7 (full lobby)"
        status: pass
    human_judgment: false
  - id: D8
    description: "A crafted ?lobby= cannot inject path or protocol characters into a PartyKit room name — the code is validated against a fixed 31-character alphabet before it is ever used (T-04-02)"
    requirement: "NET-01"
    verification:
      - kind: unit
        ref: "src/net/lobbyUrl.test.ts — parseLobbyCode and isLobbyCode suites (16 tests, incl. 1000 seeded draws)"
        status: pass
    human_judgment: false
  - id: D9
    description: "All three Phase 3 integration scripts still pass under the new host-gated start, and roomRound scenario 6 still proves no oversized fight log reaches storage — now asserting storageKeys is exactly [\"run\", \"started\"]"
    requirement: "NET-01"
    verification:
      - kind: e2e
        ref: "npm run room:smoke, npm run room:seats, npm run room:round"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-19
status: complete
---

# Phase 4 Plan 1: Client Networking Tracer Summary

**A browser tab opened at `/?lobby=<code>` now connects to a real PartyKit room, takes the seat the server gives it, renders that seat's server-owned economy, and round-trips a Reroll through the wire — and the room it connects to no longer starts its 30-second clock on the first connection, because a `'lobby'` phase gated to seat 0 (with a persisted `started` flag, so a rehydrated mid-game room resumes instead of reverting) now stands between joining and playing.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-19T19:23:00Z
- **Completed:** 2026-08-19T19:43:00Z
- **Tasks:** 3
- **Files:** 12 changed (5 created, 7 modified), 1159 insertions

## Accomplishments

- **Task 1 (tracer) — one path through every layer.** URL → transport → protocol parse → RunState → render → input → transport, with no other call sites and no batching:
  - `src/net/protocol.ts` gained a `'lobby'` `RoomPhase`, a `{t:'start'}` `ClientMessage` (still carrying neither a seat field nor a state field, so the union's two load-bearing security properties survive the extension), `'not-host'`/`'already-started'` reject reasons, and `parseServerMessage` — a never-throwing mirror of `parseClientMessage` that drops non-JSON, non-objects, arrays, unknown discriminants, and any `welcome` whose `protocol` is not `PROTOCOL_VERSION`.
  - `party/lobby.ts` gained the host gate. The architectural point is the **persistence**, not the gate: `onStart` runs on every rehydration, so `started` is written to storage alongside `run` and read back to choose between `'idle'` (started, clock stopped, resume on next connect) and `'lobby'` (never started, wait for the host). A mid-game room that hibernates, restarts, or gets evicted on Cloudflare comes back running.
  - `src/net/lobbyUrl.ts` — a 31-character code alphabet that deliberately omits `i`, `l`, `o`, `0`, `1`, plus `parseLobbyCode` as the trust boundary that stops a crafted link injecting anything into a room name.
  - `src/net/roomClient.ts` — the DOM-free transport wrapper.
  - `src/main.ts` — the `?lobby=` boot branch, `applyServerSnapshot` (which does not persist), local-timer and `startCombat` guards so the client cannot fork its own game state away from the server's, and `performReroll` routed over the wire.
- **Task 2 — automated proof driving the real browser module.** 30 unit tests across two new suites, plus `scripts/netClient.ts` (`npm run net:client`), which imports `src/net/roomClient` directly rather than raw `PartySocket`. Its scenario 5 tears down and respawns the `partykit dev` **process** against the same persisted room id — the only way to actually re-run `onStart`, which a socket reconnect does not.
- **Task 3 — failure modes that end in an explanation, not a blank screen.** A fixed-position banner on `document.body` (immune to `#app` re-renders), `netDropped` gating input, and — critically — nothing on the drop path clears `run` or `placedUnits`. A frozen but correct board is the right failure mode while reconnect/resync is explicitly v2 (HARD-01).

## Task Commits

1. **Task 1: End-to-end "join a lobby by link and reroll"** — `b412420` (feat)
2. **Task 2: Automated proof — drive the real browser client module from Node** — `5661a11` (test)
3. **Task 3: Survive a dropped or refused connection without garbage on screen** — `946c408` (feat)

## Files Created/Modified

- `src/net/protocol.ts` — `'lobby'` phase, `{t:'start'}`, two reject reasons, `parseServerMessage`, `SERVER_MESSAGE_TYPES`
- `party/lobby.ts` — `started` field, its write in `persist()`, its set in `beginPlanning()`, its read in `onStart()`, the `'lobby'` branch in `onConnect`, the `start` handler in `onMessage` (placed before the action-only phase guard)
- `src/net/lobbyUrl.ts` — new
- `src/net/roomClient.ts` — new
- `src/main.ts` — `net`/`isNetworked`/`netDropped`/`netStatusEl`, the `saveRun` wrapper, `applyServerSnapshot`, `bootNetworked`, `setNetStatusBanner`, the two guards, `performReroll`'s networked branch, the boot block
- `src/net/lobbyUrl.test.ts`, `src/net/protocol.test.ts` — new, 30 tests
- `scripts/netClient.ts` — new, 7 scenarios
- `scripts/roomSmoke.ts`, `scripts/roomSeats.ts`, `scripts/roomRound.ts` — seat-0 `start` added; `roomRound` scenario 6's `storageKeys` updated (not deleted)
- `package.json` — `net:client` script
- `.gitignore` — `node_modules/.mf/` (miniflare dev state)

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `PLAYER_COUNT` is exported from `src/econ/constants.ts`, not `src/econ/runState.ts`**
- **Found during:** Task 3, writing scenario 7
- **Issue:** Task 3's action text says to import `PLAYER_COUNT` from `../src/econ/runState`. That module does not export it; it imports it from `../econ/constants` itself.
- **Fix:** Imported from `../src/econ/constants`, matching what `scripts/roomSmoke.ts` already does.
- **Files modified:** `scripts/netClient.ts`
- **Committed in:** `946c408`

**2. [Rule 1 — Bug] `roomSmoke.ts` read a shop that the host gate had just invalidated**
- **Found during:** Task 1, running `npm run room:smoke` after adding the gate
- **Issue:** The plan says to change nothing in these scripts but the `start` send and the `storageKeys` assertion. But `beginPlanning()` calls `startPlanning()`, which rolls every unlocked seat's shop — so under the gate, `welcome.snapshot.players[0].shop` is stale by the time the buy is sent, and the script would buy a slot that no longer holds what it thought.
- **Fix:** The shop, gold, and pool baselines now come from the opening `snapshot` broadcast that `beginPlanning()` emits right after the `phase` message. Both waits are registered before the `start` is sent (the ordering discipline `roomRound.ts` already documents).
- **Files modified:** `scripts/roomSmoke.ts`
- **Committed in:** `b412420`

**3. [Rule 2 — Missing critical functionality] `saveRun` funnelled through a networked-session guard**
- **Found during:** Task 1, wiring `applyServerSnapshot`
- **Issue:** The plan makes `applyServerSnapshot` itself not persist, which is necessary but not sufficient. `src/main.ts` calls `saveRun(run)` from 24 other places (drag/drop, buy, sell, item placement, XP), and in a networked session `run` IS the server's state. Any of those paths would have written the room's RunState over the player's solo localStorage save — the exact thing the plan's own must_have forbids.
- **Fix:** `saveRun` is imported as `persistRunToStorage` and shadowed by a local `function saveRun(state: RunState): void { if (isNetworked()) return; persistRunToStorage(state) }`. One choke point, zero call-site churn, and it stays correct as plans 04-03/04-04 add more.
- **Files modified:** `src/main.ts`
- **Committed in:** `b412420`

**4. [Rule 2 — Missing critical functionality] A refused client now closes its own socket**
- **Found during:** Task 1, writing the `rejected`/`not-seated` branch
- **Issue:** `partysocket` reconnects internally. A client refused for a full lobby would retry forever against a room that already said no.
- **Fix:** `RoomClient` closes the socket when it transitions to `'rejected'`. Adjacent to T-04-05's reasoning about not letting a disconnected client generate traffic.
- **Files modified:** `src/net/roomClient.ts`
- **Committed in:** `b412420`

### Deliberate departures

**5. `npx tsc --noEmit` cannot exit 0, and could not before this plan.** The acceptance criterion is unmeetable as literally written: the repo has 16 pre-existing `tsc` errors and 24 failing tests, all in ability/econ files this plan does not touch (three of the `tsc` errors are genuine `'dead'`-comparison bugs worth their own investigation). Per the executor scope boundary these were not fixed. Verified **scoped-clean** instead — `npx tsc --noEmit` reports zero errors in `src/net/`, `party/`, `scripts/`, and `src/main.ts` — and logged everything in `deferred-items.md`.

**6. `scripts/netClient.ts` reports 7 scenarios, not the "five"/"six" the plan's prose alternates between.** Tasks 2 and 3 together specify seven, and the script reports the count it actually ran rather than a hardcoded claim, exactly as the plan asked.

---

**Total deviations:** 4 auto-fixed (1 blocking, 1 real bug, 2 missing-critical), 2 documented departures
**Impact on plan:** No scope creep. Deviations 2-4 all close gaps between what the plan's action text said and what its own `must_haves` require.

## Known Stubs

All four are stated by the plan as intentional and assigned to a named successor plan. None prevent this plan's goal.

| Stub | File | Location | Resolved by |
|------|------|----------|-------------|
| Placeholder display name `'Player'` | `src/main.ts` | `bootNetworked` | 04-02 (guest-name pool behind the Lobby Screen) |
| Seat 0 auto-sends `sendStart()` on `welcome` | `src/main.ts` | `bootNetworked` message handler | 04-02 (moves it behind the Start button, deletes it here) |
| Only `performReroll` is routed over the wire; buy/sell/XP/drag remain local | `src/main.ts` | action handlers | 04-03, 04-04 |
| `renderPlanningTimer` hides the bar entirely; `startCombat` returns immediately | `src/main.ts` | both early-returns | 04-05 (server countdown), 04-06 (log playback) |

## Issues Encountered

**One transient `room:round` failure from a port collision with the parallel 04-00 agent.** `scripts/roomHarness.ts` hardcodes `ROOM_PORT` to 1999. Two agents running `partykit dev` in parallel worktrees collide: the second one's healthcheck answers from the first one's server, which then dies mid-run, producing `nextMessage timed out after 10000ms. Messages seen: []`. Re-running with `ROOM_PORT=2077` passed immediately, as did `net:client` on `ROOM_PORT=2078`. Not fixed here — `roomHarness.ts` is shared surface and 04-00 is editing adjacent files — but logged in `deferred-items.md` with a candidate fix (derive the port instead of fixing it at 1999).

This is very likely the same class of thing as the "one transient scenario-7 timeout" 03-04's SUMMARY flagged for future attention. It reproduces on demand under parallel execution.

## User Setup Required

None. `partysocket` was already an approved Phase 3 dependency and no package was installed. `VITE_PARTY_HOST` is optional and unset until Phase 5; without it, `partyHost()` returns `<page hostname>:1999`, the `partykit dev` default.

## Next Phase Readiness

- Every later plan in Phase 4 can now assume `isNetworked()`, `net`, `applyServerSnapshot`, `setNetStatusBanner`, and `RoomClient` exist and behave as specified.
- The solo path is untouched when no `?lobby=` param is present, and is now structurally protected from a networked session by the `saveRun` wrapper rather than by convention.
- `scripts/netClient.ts` is the pattern later plans extend: append a scenario, and the final line's count follows.
- **Deferred to the end-of-phase two-tab checklist** (as the plan directs): `/?lobby=<code>` renders a server-owned shop and a Reroll round-trips; `/` with no param plays solo unchanged; killing the room leaves a frozen board plus a banner. The automated equivalents of all three pass; what remains unverified is only the browser rendering itself, which this repo has no automation for.
- No blockers.

---
*Phase: 04-client-networking-lobby-ui*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: src/net/lobbyUrl.ts
- FOUND: src/net/lobbyUrl.test.ts
- FOUND: src/net/protocol.test.ts
- FOUND: src/net/roomClient.ts
- FOUND: scripts/netClient.ts
- FOUND: src/net/protocol.ts (modified)
- FOUND: party/lobby.ts (modified)
- FOUND: src/main.ts (modified)
- FOUND: package.json (modified)
- FOUND: .gitignore (modified)
- FOUND: .planning/phases/04-client-networking-lobby-ui/04-01-SUMMARY.md
- FOUND: .planning/phases/04-client-networking-lobby-ui/deferred-items.md
- FOUND commit: b412420 (Task 1)
- FOUND commit: 5661a11 (Task 2)
- FOUND commit: 946c408 (Task 3)
