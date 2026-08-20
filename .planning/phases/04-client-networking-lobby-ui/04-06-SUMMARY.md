---
phase: 04-client-networking-lobby-ui
plan: 06
subsystem: client-networking
tags: [networking, combat, playback, fight-log, phase-exit-gate]
status: complete

requires:
  - "04-00: src/net/fightBuffer.ts (createFightBuffer / acceptChunk / takeFight / dropFight)"
  - "04-00: src/game/playbackPerspective.ts (mirrorFightLogForSeat)"
  - "04-01: isNetworked() / applyServerSnapshot / netDropped / parseServerMessage in RoomClient"
  - "04-04: dispatchAction covering shop AND board/bench/item actions"
  - "04-05: netPhase / netClock / netLobby, the server-driven countdown and live seat list"
  - "03-02: party/lobby.ts broadcastResolve — one encode per logIndex, resolve-then-chunks per connection"
  - "03-04: src/net/fightWire.ts decodeFightLog"
provides:
  - "handleNetResolve — the `resolve` handler; settles nothing locally"
  - "handleFightChunk / startNetPlayback — chunk reassembly, decode, orientation, playback"
  - "buildSettlementLine + settlementSnapshotOf — ONE settlement-line formatter, two callers"
  - "prevSnapshot — the pre-resolve server state a networked settlement line diffs against"
  - "enterNetPlanningView — the deferred planning-view switch while a fight is still on screen"
  - "scripts/netClient.ts scenario 14 'the full networked round'"
affects:
  - "Phase 5 (deploy): the full round loop now closes between two tabs, so what ships is a playable lobby"

tech-stack:
  added: []
  patterns:
    - "One renderer, two sources: solo and networked playback share frame()'s playbackLog branch verbatim — 'no client-side re-simulation' is structural, not a promise"
    - "The orientation transform sits strictly between decodeFightLog and createPlaybackState; nothing downstream re-derives a winner"
    - "Async-decode supersession: fightId is re-checked after the await, so a resolve landing mid-decode cannot leave playback pointing at a stale fight"
    - "econPhase (view) and netPhase (room) are allowed to disagree for exactly the length of a playback"

key-files:
  created: []
  modified:
    - src/main.ts
    - scripts/netClient.ts
    - .planning/phases/04-client-networking-lobby-ui/deferred-items.md

decisions:
  - "The settlement line is extracted into buildSettlementLine rather than copied into the networked path — a second copy of that string concatenation is exactly how a lobby ends up reporting a different round than single-player reports for the same round."
  - "preRoundGold / preRoundBenchOccupied collapse into a single preRoundSettlement snapshot so the solo 'before' and the networked 'before' are the same shape and cannot drift apart field by field."
  - "The planning-view switch is DEFERRED while a fight plays back. party/lobby.ts opens the next planning phase the instant it finishes streaming chunks, so the broadcast lands mid-playback; flipping econPhase then would re-arm planning-only board interactions (board sell, `r` to pull an item) over hexes currently holding replayed combat units. Deviation from the plan text — see Deviations."
  - "The mirror is called only on the networked path. Solo logs always record the human as seatA (resolvePvpRound), so a solo mirror would be a no-op with a second call site to keep honest."
  - "The scenario mirrors for whichever seat the log put on the enemy half rather than hardcoding seat 1, so the assertion stays real whichever way resolvePvpRound ordered the pairing."
  - "Scenario 14 runs on a fourth partykit process on the SHORT planning window — forcing a 0-vs-1 pairing needs real rounds, which a 20s planning phase would stretch into minutes."

metrics:
  duration: ~65m
  completed: 2026-08-20

actuals:
  tokens: 88600
  tasks: 3
  commits: 5
---

# Phase 04 Plan 06: Networked Fight Playback & Phase-Exit Gate Summary

A networked client now renders a round the way COMBAT-02 requires: it reassembles
the `fight-chunk` stream the room sent it, decodes it with `decodeFightLog`,
orients it to its own side of the board with `mirrorFightLogForSeat`, and replays
it through the exact `createPlaybackState` / `applyFrame` / `playbackWinner`
pipeline single-player has always used — running no combat tick and re-deriving
no outcome. Settlement, elimination and game over all come from the server's
`SeatFightResult` and snapshots.

This plan also carries the consolidated phase-exit checklist for all of Phase 4
(04-00 through 04-06). Its full text is reproduced verbatim below, with a
recorded outcome line for every one of the 23 numbered items.

## Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| COMBAT-02 | Clients render combat by playing back the received event log — no client-side re-simulation | Complete (automated); see §Manual gate items 19-20 for the on-screen half |
| COMBAT-03 | Both clients in a human-vs-human matchup see the identical fight | Complete (automated); see §Manual gate item 19 for the on-screen half |

## What Was Built

### Task 1 — Take the resolve, settle from the server's result (commit `0c5dfb1`)

- **`pendingResolve`** (round, kind, seat, fightId) and **`prevSnapshot`**
  (the `RunState` held immediately before the latest server snapshot replaced
  it). `prevSnapshot` is assigned inside `applyServerSnapshot` *before* `run`
  is overwritten, on every snapshot — the last planning-phase snapshot IS the
  pre-resolve state, and a networked client has no `snapshotPreRound` of its
  own because it never runs a resolve.
- **`handleNetResolve`** adopts the resolve's snapshot, sets
  `currentOpponentIndex` from the `SeatFightResult`'s `opponentSeat` (so the
  opponent preview and enemy bench keep working), builds the settlement line,
  and claims the combat view when a fight is coming.
- **`buildSettlementLine` + `settlementSnapshotOf`** — the summary line is now
  formatted in exactly one function, called by `applyRoundResult` (solo) and
  `handleNetResolve` (networked). `preRoundGold` / `preRoundBenchOccupied`
  collapsed into one `preRoundSettlement` snapshot. The solo formula is
  unchanged field for field: base from `BASE_INCOME_BY_ROUND`, interest from
  the pre-resolve gold, streak, win bonus, XP, `hpLost`, and the crawler/quake
  extras derived by diffing before against after.
- **The no-fight cases.** `fightId === null` (bye, abstractly-resolved
  bot-vs-bot pairing, item round) clears the combat view, stays on the planning
  view and waits for the room's next `phase` broadcast. No synthesised fight,
  no `startPlanningPhase`.
- **No local settlement or advance.** No networked path calls `resolveRound`,
  `recordFight`, `advanceCombatTick` or `checkGameOver`. `restorePlayerBoard`
  and `resetCombat` keep their `!isNetworked()` guards.

### Task 2 — Reassemble, orient, play back (commit `913b090`)

- **`netFightBuffer`** — one `createFightBuffer()` at module scope, fed by
  every `fight-chunk`. There is deliberately no second buffering path: the
  caps and index/total validation that bound a hostile stream live in
  `src/net/fightBuffer.ts` and are unit-tested there (T-04-50).
- **`handleFightChunk`** — `acceptChunk`; on a completed fight matching
  `pendingResolve.fightId`, `takeFight` then `await decodeFightLog(...)`. A
  completed fight whose id does *not* match is `dropFight`ed as stale. After
  the await the `fightId` is re-checked before any playback state is touched
  (T-04-54). A decode failure is logged loudly and non-fatally — the round is
  already settled from the snapshot, so the tab keeps its state.
- **`startNetPlayback`** — `mirrorFightLogForSeat(log, localSeatIndex)` is the
  single call that orients a seatB viewer onto its own half, sequenced strictly
  between decode and `createPlaybackState`. Everything after that is the solo
  economy branch's own sequence: `playbackLog`, `playbackIndex = 0`,
  `createPlaybackState`, `placedUnits` rebuilt from the committed board,
  `preCombatSnapshot`, `combatRunning = true`, `setCombatBarState('running')`.
  `frame()`'s replay loop is untouched.
- **The obsolete `console.warn` is gone.** `grep -c "local seat recorded as
  seatB" src/main.ts` returns 0. It is replaced by a comment recording why the
  solo path needs no orientation (`resolvePvpRound` always makes the human
  seatA) and where the general case is handled.
- **The COMBAT-03 confirmation is recorded in source** at the chunk handler:
  beyond reassembly, `decodeFightLog` and the viewer-perspective orientation,
  no additional client-side fight logic exists; identical events and an
  identical outcome are inherited from Phase 3's single per-`logIndex` encode.

### Task 3 — The full networked round scenario (commit `19547da`)

`scripts/netClient.ts` scenario 14, the last in the file. Two `RoomClient`s are
driven until the room pairs them against each other (polling `nextOpponent`
while buying and fielding), then the streamed fight is put through the REAL
`src/net/fightBuffer.ts`, `src/net/fightWire.ts`,
`src/game/playbackPerspective.ts` and `src/game/playback.ts` — not
reimplementations. Asserted:

- both clients complete the fight through `acceptChunk` at the same `total`;
- `takeFight` yields index-sorted arrays on both;
- the joined `gzipB64` strings are byte-identical (COMBAT-01 inherited);
- both decode to deep-equal `FightLog`s;
- the seatB viewer's oriented log reports the opposite winner, swaps
  `seatA`/`seatB`, keeps every frame, every tick and every per-frame event
  count, and leaves its input unmutated;
- every frame of the oriented log applies through `applyFrame` without throwing;
- `playbackWinner` on **each** client's own oriented log agrees with **that**
  client's own `SeatFightResult`.

The script's final line already reported `scenariosRun` rather than a hardcoded
total (04-05's work), so no change was needed there; it now reports 14.

## Automated Verification — what passes

Run from the worktree at `HEAD`:

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` on this plan's files | **PASS** — `npx tsc --noEmit 2>&1 \| grep -E "src/main.ts\|scripts/netClient.ts"` returns nothing |
| `npx tsc --noEmit` (whole repo) | **16 pre-existing errors**, unchanged — identical list to 04-01/04-03/04-05 |
| `npx vitest run` | **23 failures across 8 files**, unchanged — identical list to 04-03/04-05 |
| `npm run net:client` | **PASS, exit 0** — `netClient: all assertions passed across 14 scenario(s)` |
| `npm run room:smoke` | **PASS** — `roomSmoke: all assertions passed` |
| `npm run room:seats` | **PASS** — `roomSeats: all assertions passed` |
| `npm run room:round` | **PASS on re-run** — first run failed to force a 0-vs-1 pairing within 20 rounds (flaky, pre-existing; logged in `deferred-items.md`), passed immediately on re-run with no code change |
| `npm run build` | **FAILS at `tsc`** on the 16 pre-existing errors, so `vite build` never runs — same as every prior plan in this phase |
| Bundle check | **PASS** — `npx vite build --outDir dist-check --emptyOutDir` transformed 418 modules cleanly, proving the three new `src/main.ts` imports resolve. `dist-check/` deleted afterwards |
| `dist/` and `node_modules/.vite/vitest/results.json` | **Clean** — the vitest cache was reverted with `git checkout --` after the test run; `dist/` was never written |

Scenario 14's own output from the passing run:

```
OK: [the full networked round] a 0-vs-1 human pairing was forced within 20 rounds (took 10)
OK: [the full networked round] both clients were told the same non-null fightId (…:10:0)
OK: [the full networked round] both clients completed at the same total (7 chunk(s) each)
OK: [the full networked round] takeFight handed back index-sorted arrays on both clients
OK: [the full networked round] the two reassembled chunk sets are byte-identical … (COMBAT-01)
OK: [the full networked round] both clients decode to deep-equal FightLogs
OK: [the full networked round] the decoded fight has frames to play back (1828)
OK: [the full networked round] mirrorFightLogForSeat did not mutate its input …
OK: [the full networked round] the seatB viewer's oriented log reports the opposite winner (player -> enemy)
OK: [the full networked round] the orientation transform added and dropped no frame (1828)
OK: [the full networked round] every frame keeps its recorded tick …
OK: [the full networked round] every frame keeps its exact event count …
OK: [the full networked round] every frame of the oriented log applied through applyFrame without throwing (1828)
OK: [the full networked round] A (seat 0): playbackWinner … says 'player', matching SeatFightResult.won=true
OK: [the full networked round] B (seat 1): playbackWinner … says 'enemy', matching SeatFightResult.won=false
```

### Source assertions (the plan's acceptance greps)

| Assertion | Result |
|-----------|--------|
| `grep -c "= resolveRound(" src/main.ts` | **2** — `startCombat`'s economy branch and `finishItemRound`, both unreachable while networked (`startCombat` returns early on `isNetworked()`; `finishItemRound` is only reached from the solo item-round overlay, which `handleNetResolve` never starts) |
| `grep -n "advanceCombatTick" src/main.ts` | import, one comment, and **one call inside `tickCombat`** (the test-mode tick body) — unchanged |
| Settlement-line formatting site count | **1** (`buildSettlementLine`), called from `applyRoundResult` and `handleNetResolve` |
| `grep -n "prevSnapshot" src/main.ts` | assigned at `applyServerSnapshot` **before** `run = snapshot` |
| `grep -n "mirrorFightLogForSeat" src/main.ts` | **exactly one call** (in `startNetPlayback`), between `decodeFightLog` and `createPlaybackState`; the other hits are the import and two comments |
| `grep -c "local seat recorded as seatB" src/main.ts` | **0** |
| `grep -c "createFightBuffer\|acceptChunk\|takeFight\|dropFight" src/main.ts` | **9** (≥ 4 required) |
| Post-await `fightId` re-check | present, before any playback state is assigned |
| `frame()`'s `playbackLog` branch | **unchanged** — `git diff master...HEAD -- src/main.ts` contains no hunk touching it |
| `grep -c "from '../src/net/fightBuffer'" scripts/netClient.ts` | **1** |
| `grep -c "from '../src/game/playbackPerspective'" scripts/netClient.ts` | **1** |
| `npm run net:client` final line | `netClient: all assertions passed across 14 scenario(s)` — matches the 14 scenarios defined in the file |

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] The planning-view switch is deferred while a fight plays back

**Found during:** Task 1.

**Issue:** `party/lobby.ts`'s `onDeadline` calls `beginPlanning()` immediately
after `broadcastResolve()`, so the per-connection frame order is
`resolve, chunk×N, phase(planning), snapshot`. The plan's Task 1 has the
resolve handler set `econPhase = 'combat'`, but 04-05's `phase` handler then
sets `econPhase = 'planning'` a few milliseconds later — *before* the async
`decodeFightLog` has even resolved, let alone before the ~30s playback ends.
`econPhase === 'planning'` is what gates board-sell (`sellHoveredUnit`) and
`r`-to-remove-item (`removeHoveredItem`), so the player would have had
planning-only board interactions armed over hexes holding replayed combat
units for the whole fight.

**Fix:** `enterNetPlanningView()` — a view-only transition that returns early
while `playbackLog !== null || combatRunning`. The `phase: 'planning'` branch
calls it instead of setting `econPhase` directly, and `restorePlayerBoard` /
`resetCombat` call it on the networked side once the combat view is torn down.
It sets `econPhase` and calls `updateEconVisibility()` and nothing else — no
`startPlanning(run)`, no income bank, no shop roll, no `saveRun`, so it is not
a local round advance.

**Files modified:** `src/main.ts`. **Commit:** `0c5dfb1`.

### 2. [Rule 2] `pendingBattle` / `lastWinProb` are cleared for a networked fight

**Found during:** Task 2. The win-prediction calibration loop
(`appendBattle` / `recordAndLearn`) is a solo learner fed by battles this
browser's own economy produced. A room's fight is not its data, and leaving a
stale `pendingBattle` in place would have had `frame()`'s done branch record a
calibration sample against a board this client never assembled.
`startNetPlayback` therefore nulls `pendingBattle` / `lastWinProb` and zeroes
`lastPowerDelta`. **Commit:** `913b090`.

### 3. [Rule 2] A decode failure is handled rather than left to reject unhandled

**Found during:** Task 2. `decodeFightLog` throws on a malformed set. The plan
does not say what to do with that. `handleFightChunk` catches it, logs
`console.error`, and drops back to the planning view — the round is already
settled from the snapshot, so the correct failure mode is "no fight shown",
not "unhandled promise rejection and a half-built combat view".
**Commit:** `913b090`.

### 4. [scope] `netFightBuffer`, `prevSnapshot` and `pendingResolve` are reset on lobby enter/leave

`bootNetworked` and `leaveLobby` already reset `netPhase` / `netClock` /
`netLobby` for the same reason; a second lobby must not inherit the first
room's in-flight fight or its pre-resolve state.

### 5. [scope, no code change] The scenario's final summary line already self-reported

Task 3 step 1 asks for the summary line to be updated to report the real
scenario count. 04-05 had already made it `${scenariosRun}`; it now prints 14
with no edit. Recorded so the un-changed line is not read as an oversight.

## Threat Model — dispositions

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-04-50 (DoS, chunk buffering) | mitigated | Buffering goes exclusively through `src/net/fightBuffer.ts`; `grep` shows `createFightBuffer`/`acceptChunk`/`takeFight`/`dropFight` used, no second buffering path in `src/main.ts` |
| T-04-51 (Tampering, decoder input) | mitigated | Only chunks that passed `parseServerMessage` then `acceptChunk`'s index/total validation reach `decodeFightLog`, and only as a complete index-sorted set from `takeFight` |
| T-04-52 (Tampering, displayed outcome) | mitigated | `playbackWinner` still returns `log.winner` verbatim; the orientation transform swaps it in one place; scenario 14 asserts winner agreement against each seat's own `SeatFightResult` |
| T-04-53 (Tampering, local settlement) | mitigated | `= resolveRound(` grep returns 2, both solo-only; no `recordFight`/`advanceCombatTick`/`checkGameOver` on any networked path |
| T-04-54 (DoS, async decode race) | mitigated | `fightId` re-checked after the `decodeFightLog` await before any playback state is assigned |
| T-04-55 (Info disclosure, fight logs) | accepted | Unchanged Phase 3 boundary — `broadcastResolve` sends a connection only its own seat's fight |
| T-04-SC (supply chain) | mitigated | No package installed. `package.json` is untouched by this plan |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no
schema change; it only consumes messages the Phase 3 protocol already defines.

## Known Stubs

None.

---

# PHASE-EXIT MANUAL CHECKLIST (the single gate for all of Phase 4)

**Status: NOT RUN — requires a human at a keyboard with two browser tabs.**

This is reproduced verbatim from `04-06-PLAN.md`'s verification block and is the
single gate for plans 04-00 through 04-06. Every earlier plan's `<human-check>`
block is a per-task confidence check, not a gate.

`workflow.human_verify_mode` is `end-of-phase`, and this repo has no browser
automation (no Playwright or Cypress per `.planning/codebase/TESTING.md`), so
everything DOM-shaped in this phase converges here. **Run it top to bottom with
`npm run room:dev` and `npm run dev` both running.** Any failure is a blocker,
not a note.

**Honest recording note:** this executor is headless and cannot drive a browser.
Every item below is recorded as `PENDING (human)` with the automated evidence
that bears on it, rather than being marked passed on the strength of a code
read. Marking any of these `PASS` without a human having actually clicked it
would defeat the entire reason `human_verify_mode: end-of-phase` exists.

## Setup

```bash
npm run room:dev     # terminal 1 — the PartyKit room on :1999
npm run dev          # terminal 2 — Vite on :5173
```

## A. Solo regression — the accepted risk

`npm test` does not cover `src/main.ts` at all; the file has no test suite and
this phase rewrote roughly a dozen of its input handlers plus its boot path.
Solo correctness is therefore human-verified only, and these six lines are the
whole of that coverage.

| # | Item | Outcome |
|---|------|---------|
| 1 | `/` with no query param shows the Title Screen; Start Solo Game boots the solo economy game. | **PENDING (human)** |
| 2 | Shop: buy a unit, reroll, buy XP, toggle the shop lock, right-click a bench unit to sell — each behaves as it did before Phase 4. | **PENDING (human)** |
| 3 | Combine: buy three copies of a one-cost and confirm the star-up flash fires on bench and on board. | **PENDING (human)** |
| 4 | Board: drag bench→board, board→board onto an occupied hex (true swap), board→bench, pick up and drop on the same hex (no duplicate, no loss), right-click sell, and overfill past the level cap (rejection flash). | **PENDING (human)** |
| 5 | Items: pick an item off the item bench onto a board unit and onto a benched unit; press `r` over each to pull it back off. | **PENDING (human)** |
| 6 | A full round: Start, watch the fight play back, confirm the settlement line and HP change, and reach the next planning phase. Repeat through a creep round and an item round. | **PENDING (human)** — 04-06 refactored the settlement line into `buildSettlementLine`; the solo path must still produce a character-for-character identical line. The formula was moved field for field, not retyped, but **this is the single most important item in section A for this plan.** |

## B. Title and Lobby screens (04-UI-SPEC.md)

| # | Item | Outcome |
|---|------|---------|
| 7 | Title Screen renders the background, logo and "Isle Of Imagination" subtitle, with four buttons in a 2x2 grid (blue fill, black border, bold yellow text). | **PENDING (human)** — note `public/visuals/gui icons/Logo.png` does not exist in the repo; the CSS wordmark fallback is expected (see `deferred-items.md`). |
| 8 | Tutorial and Cheat Sheet render and click without doing anything. | **PENDING (human)** |
| 9 | Start Multiplayer Game puts `?lobby=<code>` in the URL and shows the Lobby Screen with the full shareable link. | **PENDING (human)** |
| 10 | Clicking the link bar or its copy icon copies the link and flashes "Copied!", which clears itself. | **PENDING (human)** |
| 11 | Pasting that link into a second tab skips the Title Screen and lands directly on the Lobby Screen as a guest. | **PENDING (human)** |
| 12 | The guest sees "Waiting for host to start..." and no Start button; the host sees a Start button. | **PENDING (human)** — the server-side half is covered by `net:client` scenario 2 (`not-host` rejection). |
| 13 | The host's "Current players" list grows to two entries live, with no refresh, naming the local seat "You" and the guest by a colour-word guest name (not a bot persona name). | **PENDING (human)** — the wire half is covered by `net:client` scenario 8 (seat-list liveness) and `guestNames.test.ts`. |
| 14 | Refreshing the host tab rejoins the same lobby rather than minting a new code. | **PENDING (human)** — the server half is covered by `room:seats` (lowest-seat reassignment) and `net:client` scenario 5. |

## C. Networked round loop

| # | Item | Outcome |
|---|------|---------|
| 15 | Host clicks Start; BOTH tabs leave the Lobby Screen into the game view together. | **PENDING (human)** — the wire half is covered by `net:client` scenario 9 (host-gated dismissal). |
| 16 | Both tabs show the same countdown seconds at the same moment, and both reach zero without either tab starting a fight by itself. | **PENDING (human)** — the arithmetic half is covered by `net:client` scenario 13 (deadline agreement, two clocks 1,000,000ms apart agreeing within 100ms). Note the countdown bar is intentionally hidden while a fight is playing back. |
| 17 | Both tabs can shop; each tab's own changes appear after the server responds, and the shared pool count reflects the other tab's buys. | **PENDING (human)** — the wire half is covered by `net:client` scenario 12 (two clients against one pool). |
| 18 | The seat list shows six seats with names, HP and a visible human-vs-bot distinction, with exactly the two connected seats marked human. | **PENDING (human)** — the wire half is covered by `net:client` scenario 8 and `room:seats`. |
| 19 | Play until the two tabs are matched against each other: both watch the fight, **each showing its own units on the bottom half in player colours**, the two result boxes agree, and both advance to the next planning phase together. | **PENDING (human)** — **THE item this plan exists for.** The non-visual half is fully covered by `net:client` scenario 14: byte-identical chunks, deep-equal decodes, the seatB viewer's oriented log reporting the opposite winner with every frame/tick/event preserved, and `playbackWinner` on each client's own oriented log matching that client's own `SeatFightResult`. What remains human-only is that the pixels land where the transform says they do. |
| 20 | A round where the local seat draws a bye or an item round passes through without a broken combat view. | **PENDING (human)** — `room:round` asserts `fightId: null` and `logIndex: null` on item rounds; the client's `fightId === null` branch clears the combat view and waits for the next `phase` broadcast. |

## D. Failure modes

| # | Item | Outcome |
|---|------|---------|
| 21 | Kill `npm run room:dev` mid-session: the board and shop stay on screen unchanged behind a red banner explaining the drop, and clicking Reroll does nothing rather than throwing. | **PENDING (human)** — the client half is covered by `net:client` scenario 6 (drop); `netDropped` gates every dispatch by construction. |
| 22 | A restart of the room mid-run (stop and restart `partykit dev` while a round is in progress, then reconnect) resumes the round loop without demanding a second Start. | **PENDING (human)** — the server half is covered by `net:client` scenario 5 (a started room survives a restart) and `room:round`'s zero-connection pause. |
| 23 | Opening the link when every seat is occupied shows a clear "lobby is full" message rather than a blank screen. | **PENDING (human)** — the wire half is covered by `net:client` scenario 7 (full lobby / `not-seated`). |

## Gate status

**23 of 23 items PENDING (human). 0 PASS, 0 FAIL.**

The phase's automated gate is green (every `npm run` script in the plan's
Automated block passes, and `net:client` reports 14/14 scenarios). The manual
gate has not been run and is the remaining blocker for declaring Phase 4
complete. Items **6**, **19** and **20** are the three this plan's changes bear
on most directly and should be run first.

## Self-Check: PASSED

- `src/main.ts` — FOUND, modified
- `scripts/netClient.ts` — FOUND, modified
- `.planning/phases/04-client-networking-lobby-ui/deferred-items.md` — FOUND, appended
- `.planning/phases/04-client-networking-lobby-ui/04-06-SUMMARY.md` — FOUND, created
- Commit `0c5dfb1` — FOUND
- Commit `913b090` — FOUND
- Commit `19547da` — FOUND
- Commit `582afd4` — FOUND
