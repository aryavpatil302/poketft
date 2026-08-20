---
phase: 04-client-networking-lobby-ui
plan: 03
subsystem: client-networking
tags: [dispatch-seam, game-action, shop, rejection-reporting, star-up-diff, partykit]

# Dependency graph
requires:
  - phase: 04-client-networking-lobby-ui plan 01
    provides: "src/main.ts's `net` / `isNetworked()` / `netDropped` / `saveRun` wrapper / `applyServerSnapshot` / `bootNetworked`, src/net/roomClient.ts's sendAction, scripts/netClient.ts's probeClient harness"
  - phase: 04-client-networking-lobby-ui plan 02
    provides: "the Title/Lobby screen boot router — the game view is now entered through the Lobby Screen's dismissal, which is where a networked dispatch first becomes reachable"
  - phase: 02-transport-agnostic-round-engine plan 05
    provides: "src/game/round.ts's GameAction union, ActionReason, ActionResult and applyAction(state, seat, action)"
  - phase: 03-partykit-room-server plan 02
    provides: "party/lobby.ts's serial onMessage -> applyAction -> broadcast snapshot loop, its `rejected` frames and MAX_ACTIONS_PER_PHASE budget"
provides:
  - "src/main.ts — `dispatchAction(action: GameAction): boolean`, the single seam between input handling and economy mutation"
  - "src/main.ts — `reportActionRejected(reason: ActionReason | RejectReason): void` plus the REJECT_TEXT table; wired to local ActionResults AND to the server's `rejected` ServerMessage in bootNetworked"
  - "src/main.ts — `localTierComposition()`, `detectStarUps(before, after)`, `heldOnBoard(up)`, `flashStarUps(ups)`: the combine celebration derived from state instead of from buyUnit's CombineResult"
  - "src/main.ts — shop handlers rewritten onto the seam: performReroll, performBuyXp, the btn-shop-lock handler, the .shop-card buy handler, sellHoveredUnit's bench branch, the bench-cell contextmenu sell"
  - "scripts/netClient.ts — scenario 10 (rapid-fire actions apply serially) and scenario 11 (rejections are reported, not swallowed); 11 scenarios total"
affects:
  - "Plan 04-04 — `dispatchAction` is now the seam the drag-and-drop handlers (moveBoard/moveBench/placeItem/removeItem) and `sellFromBoard` move onto; nothing new needs building there, only routing. `heldOnBoard`/`flashStarUps` already handle a combine landing on the board."
  - "Plan 04-04 — the two-clients-one-pool conservation scenario appends to scripts/netClient.ts's `actionSemantics` block, which already runs on a long-planning-window process (PLANNING_MS_ACTIONS)."
  - "Plan 04-05 (server-driven countdown) — a 'wrong-phase' rejection now has a visible rendering, so a click made after the deadline explains itself instead of doing nothing."
  - "Plan 04-06 — section A of its consolidated solo-regression checklist is the phase-exit gate for everything this plan rewrote; this summary's manual checklist is the scoped subset."

# Actuals (#2632)
actuals:
  tokens: 6800
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One seam, not two implementations. `dispatchAction` branches ONCE on `net !== null`; every handler above it is transport-blind and just names an action. The prohibition on a parallel compatibility path is honoured by deletion — buyUnit / reroll / buyXp / sellFromBench are no longer imported into src/main.ts at all, so a handler cannot accidentally reach around the seam."
    - "No optimistic apply, ever. The networked branch calls `net.sendAction(action)` and returns — it does not touch `run`, does not render, and does not persist. Every networked render originates in a server snapshot, which is COMBAT-02's no-client-side-re-derivation rule applied to the economy. Perceived responsiveness comes from `flashEconButton` firing on dispatch."
    - "Feedback that cannot be read off an action result is derived from a state diff. `buyUnit`'s CombineResult survives neither `applyAction`'s ActionResult nor the wire, so the star-up flash is computed as `detectStarUps(before, after)` over a definitionId -> highest-held-tier map spanning bench AND board. One helper, two callers (the local dispatch path and applyServerSnapshot), so both modes celebrate identically."
    - "A refusal is a first-class UI event. `reportActionRejected` is the single renderer for both local `ActionReason`s and server `RejectReason`s, in a transient amber notice with its own DOM element — deliberately NOT setNetStatusBanner's, because that banner is a sticky terminal state ('connection lost — reload') and a 2s toast clobbering it would hide the more serious message."
    - "The local branch re-renders in ONE place inside `dispatchAction`, not per handler. renderTraitDisplay() is now called unconditionally after every accepted local action (previously only the buy path did) — a buy, a sell and a combine can all change the active trait set, and the render is cheap next to getting it wrong in one branch."

key-files:
  created: []
  modified:
    - src/main.ts
    - scripts/netClient.ts
    - .planning/phases/04-client-networking-lobby-ui/deferred-items.md

key-decisions:
  - "The star-up flash is derived from a bench+board tier composition diff rather than from buyUnit's `res.combined.upgrades`. The old mechanism was DELETED, not kept alongside — the developer's standing preference is replace-not-shim, and more importantly a server `snapshot` could never have carried the old shape, so keeping it would have meant two divergent celebration paths. The diff is also strictly more general: any action whose result raises a definitionId's highest held tier now flashes, which is exactly the set of combines."
  - "`applyServerSnapshot` skips the star-up diff on the FIRST snapshot of a session (new `seenServerSnapshot` flag, reset by bootNetworked and leaveLobby). The first snapshot is an ADOPTION, not a transition: diffing the player's own solo save against the room's state would fire a burst of flashes for units this client never bought — most visibly on a host refresh into a mid-game room. Not in the plan; added because the diff mechanism the plan specified creates this artefact by construction."
  - "The `rejected` handler in bootNetworked deliberately EXCLUDES reason 'not-seated'. That case is already surfaced by the status handler as a sticky red banner plus a Lobby Screen explanation (04-01/04-02); a 2s amber toast layered on top would only bury the terminal message."
  - "`reportActionRejected` renders into its own `div#action-reject-notice` on document.body at top:56px, below the network banner at top:12px, so a rejection during a degraded connection does not hide the connection message. Same fade convention and element shape as setNetStatusBanner, amber (#e0a13a) instead of red."
  - "The shop-lock handler now routes through `{ t: 'lock', locked: !humanEcon().shopLocked }` rather than mutating econ.shopLocked directly. One behaviour change falls out of applyAction's shared guards: an eliminated seat's lock toggle is now refused with an 'You have been eliminated' notice instead of silently mutating. econPhase is 'gameOver' by then anyway, so the handler's own guard already returns first in practice."
  - "buyXp at MAX_LEVEL now shows 'You are already at max level.' where the old `if (buyXp(...))` did nothing. That is applyAction's pre-existing 'max-level' vs 'no-gold' distinction becoming visible for the first time — a strict improvement, and the plan's own must_have that a rejection is never a silent no-op."
  - "netClient scenarios 10-11 run on a THIRD partykit process rather than a fresh room id on the existing one (which is what 04-02's scenarios 8-9 did). PLANNING_MS is a `--var` bound at PROCESS start, and these two need a 20s window where the rest of the file needs 2s; a fresh room id on the 2s process would have settled the round out from under the burst. OUTER_TIMEOUT_MS raised 5min -> 8min to cover the extra spawn."
  - "The burst scenario's expected gold is COMPUTED (`min(BURST, floor(gold / REROLL_COST))`), not hardcoded. A fresh room opens every seat at 5 gold and REROLL_COST is 2, so 2 of the 5 rapid rerolls land and 3 come back 'no-gold' — which the assertion states exactly rather than papering over. Hardcoding 5 * REROLL_COST would have made the scenario permanently red."
  - "`npx tsc --noEmit` and `npm test` still do not exit 0 on this repo and did not before this plan (16 pre-existing tsc errors, 23 failing tests, all in ability/econ files, none importing anything this plan touches). Verified scoped-clean instead, exactly as 04-01 and 04-02 did."

requirements-completed: []

coverage:
  - id: D1
    description: "A burst of five rerolls fired with no await between them is applied SERIALLY and exactly once each: the client observes exactly `affordable` snapshots and seat 0's gold moves by exactly `affordable * REROLL_COST` — no lost update, no double-apply. The client waits for the snapshots to quiesce rather than sleeping a guessed duration."
    requirement: "NET-02"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 10 (rapid-fire actions apply serially). Observed: 5 sent, 2 snapshots, gold 5 -> 1."
        status: pass
    human_judgment: false
  - id: D2
    description: "A refused action arrives as a `rejected` ServerMessage carrying a REASON, not as silence: an unaffordable reroll returns 'no-gold' and an out-of-range `{ t: 'buy', slot: 99 }` returns 'empty-slot'. These are the two frames reportActionRejected renders (T-04-14)."
    requirement: "NET-02"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 11 (rejections are reported, not swallowed), asserting on the reason string, not merely on the absence of a snapshot"
        status: pass
    human_judgment: false
  - id: D3
    description: "No handler in src/main.ts calls buyUnit / shopReroll / buyXp / sellFromBench directly any more; every shop interaction is a GameAction routed through exactly one dispatchAction definition."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "grep -c returns 0 for `buyUnit(`, `shopReroll(`, `shopReroll`, `buyXp(`, `sellFromBench(`; the imports themselves are removed. `dispatchAction` = 1 definition + 6 call sites (buyXp, reroll, sell-hovered, lock, buy, contextmenu-sell)."
        status: pass
    human_judgment: false
  - id: D4
    description: "The client never optimistically applies an action it has sent: dispatchAction's networked branch calls sendAction and returns without touching `run`, rendering, or persisting."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "src/main.ts dispatchAction — the `net !== null` branch is two statements (`net.sendAction(action)` / `return true`). applyServerSnapshot is the only writer of `run` in networked mode, and `saveRun` no-ops under isNetworked()."
        status: pass
    human_judgment: false
  - id: D5
    description: "detectStarUps is one definition consumed by both the local post-render path and applyServerSnapshot, so a combine celebrates identically in solo and networked play."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "grep -n detectStarUps src/main.ts — one definition (line ~2229), called from applyServerSnapshot and from dispatchAction's local branch"
        status: pass
      - kind: manual
        ref: "Manual checklist items M6 (solo bench star-up) and M7 (solo board star-up); networked star-up is deferred to 04-06 section A"
        status: deferred
    human_judgment: true
  - id: D6
    description: "A rejected action is surfaced to the player in BOTH modes — an insufficient-gold buy shows a brief amber notice rather than looking like a dead click."
    requirement: "NET-02"
    verification:
      - kind: static
        ref: "reportActionRejected is called from dispatchAction's local `!result.ok` branch and from bootNetworked's `m.t === 'rejected'` handler; REJECT_TEXT is typed `Record<ActionReason | RejectReason, string>` so a new reason cannot be added to either union without a message"
        status: pass
      - kind: manual
        ref: "Manual checklist items M8 (solo) and M11 (networked)"
        status: deferred
    human_judgment: true
  - id: D7
    description: "Solo shop play — buy, reroll, buy XP, shop lock, bench sell (right-click and `e`), and a three-copy combine — behaves exactly as before the refactor."
    requirement: "NET-02"
    verification:
      - kind: manual
        ref: "Manual checklist items M1-M8. THIS IS THE ONLY GATE: `npm test` does not cover src/main.ts (accepted risk, recorded in the plan's must_haves as verification:backstop). The phase-exit gate is plan 04-06's checklist section A."
        status: deferred
    human_judgment: true

duration: 30min
completed: 2026-08-19
status: complete
---

# Phase 4 Plan 3: The Dispatch Seam & Shop Actions Summary

**Every shop interaction — buy, reroll, buy XP, shop lock, bench sell — is now a `GameAction` handed to one `dispatchAction` function that either mutates the local `RunState` through the very same `applyAction` the room server calls, or puts the action on the wire and renders nothing until the server's snapshot comes back.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Commits:** 3 (2 code + 1 docs)
- **Files:** 2 source files changed, 369 insertions, 51 deletions

## Task Commits

1. **Task 1: One dispatch seam, and the shop actions through it** — `32e3c6e` (refactor)
2. **Task 2: Prove serial application and visible rejection against a real room** — `48d3f4f` (test)
3. **Docs: this summary + deferred items** — see final commit

## Accomplishments

### Task 1 — the seam

`dispatchAction(action: GameAction): boolean` has exactly three branches and they are worth reading in order:

1. **`netDropped`** — return `false` without sending. Input is dead until reload (04-01's rule). Every dispatch this plan and 04-04 add inherits the gate by construction, because there is only one place to inherit it from (T-04-13).
2. **`net !== null`** — `net.sendAction(action)`, `return true`. Nothing else. No local apply, no render, no persist. The comment in the source states the reason plainly: two clients buying against one shared pool are serialised by the room, and a speculative local apply forks this client's economy from the room's the moment the orders disagree. Reconciling that divergence is strictly harder than waiting one round trip.
3. **local** — `applyAction(run, localSeatIndex, action)`, then `saveRun(run)` and one shared re-render. Because it is literally the same function `party/lobby.ts` calls, a locally-applied action and a server-applied one produce identical state transitions by construction.

The return value means *"accepted (local) or sent (networked)"* — never *"the screen has already changed"*. `performReroll` / `performBuyXp` use it to fire `flashEconButton` on the same frame as the click in both modes, which is the immediate feedback that stands in for the round trip.

**The old direct calls are gone, not shimmed.** `buyUnit`, `reroll as shopReroll`, `sellFromBench` and `buyXp` are no longer imported into `src/main.ts` at all, so a future handler cannot reach around the seam by accident. `rollShop` (used by `initFreshRun`) and `sellFromBoard` (plan 04-04's to move) are the only survivors of those two import lines.

### Task 1 — rejection reporting

`reportActionRejected(reason: ActionReason | RejectReason)` renders a 2s amber notice into its own `div#action-reject-notice` on `document.body`. Both modes route into it:

- **local** — `dispatchAction`'s `!result.ok` branch, from `applyAction`'s `ActionResult`;
- **networked** — a new `m.t === 'rejected'` branch in `bootNetworked`'s message handler, which is what makes a server refusal visible at all. Without it, a buy the room refuses would look to the player exactly like a click that did nothing.

`REJECT_TEXT` is typed `Record<ActionReason | RejectReason, string>`, so neither union can grow a member without the compiler demanding a message for it.

### Task 1 — the star-up flash, rebuilt on a state diff

The buy handler used to read `buyUnit`'s `res.combined.upgrades` to decide what to flash. That shape survives neither `applyAction`'s `ActionResult` nor the wire, so it was replaced (not kept alongside):

- `localTierComposition()` — a `definitionId -> highest held tier` map spanning **bench and board**, since a combine can consume copies from either;
- `detectStarUps(before, after)` — a pure diff returning every definitionId whose highest held tier went up;
- `heldOnBoard(up)` / `flashStarUps(ups)` — resolve each up to a fielded hex (`unitLayer.flashStarUp`) or a bench slot (`triggerBenchStarFlash`), preserving the old code's planning-only rule for board flashes.

`dispatchAction`'s local branch captures `before`, applies, calls `syncRunToBoard()` first if a star-up landed on a fielded unit (so `placedUnits` carries the upgraded copy before the render *and* before the flash lookup), renders, then flashes. `applyServerSnapshot` does the same across the `run = snapshot` assignment.

**One addition beyond the plan:** `applyServerSnapshot` skips the diff on the first snapshot of a session (`seenServerSnapshot`, reset in `bootNetworked` and `leaveLobby`). The first snapshot is an adoption of the room's state, not a transition within it — diffing the player's solo save against a mid-game room would fire a burst of flashes for units this client never bought.

### Task 2 — the two properties, proven against a real room

`scripts/netClient.ts` grew scenarios 10 and 11, on a third `partykit dev` process with `PLANNING_MS=20000` (the var is bound at process start, and the rest of the file wants 2s).

**Scenario 10 — rapid-fire actions apply serially.** Five `{ t: 'reroll' }` fired back to back with no await between them, then a *wait, don't guess* loop that holds until the client's latest snapshot has been unchanged for 500 ms. It asserts the observed snapshot count equals the number of rerolls the seat could afford **in sequence** (computed from the opening gold and `REROLL_COST`, never hardcoded) and that gold moved by exactly that many `REROLL_COST`s. A double-apply moves gold too far; a lost update produces too few snapshots. The intermediate count is logged so the waiting behaviour is visible in the output.

Observed on the passing run: `5 rerolls sent, 2 intermediate snapshot(s) observed before quiescence`, `gold 5 -> 1`. The tail of three came back `'no-gold'`, which is the room correctly refusing rather than the script tolerating a gap.

**Scenario 11 — rejections are reported, not swallowed.** Spends the seat down below `REROLL_COST` in a loop (a loop, not an assumption that scenario 10 left it broke — so a change to the room's opening stake cannot quietly make this vacuous), then asserts on the **reason string** of two `rejected` frames: `'no-gold'` for an unaffordable reroll, `'empty-slot'` for `{ t: 'buy', slot: 99 }`. The room deliberately does not deep-validate a `GameAction` on parse, so the second one proves `applyAction` — the sole authority — actually refuses an out-of-range slot rather than indexing past the end.

## Automated verification — what actually passes

Run from the worktree at commit `48d3f4f`:

| Check | Result |
|-------|--------|
| `npm run net:client` | **PASS** — exit 0, `all assertions passed across 11 scenario(s)`, including both new ones |
| `npx tsc --noEmit`, scoped to touched files | **PASS** — 0 errors in `src/main.ts`, 0 in `scripts/` |
| `npx vite build` | **PASS** — 414 modules, built clean |
| `npx tsc --noEmit`, whole repo | **FAIL (pre-existing)** — 16 errors, all in `src/core/abilities/*`, `src/core/systems/*`, `src/sim/runner.ts`. None in a file this plan touches. Present at base commit `081571e`. |
| `npx vitest run` | **FAIL (pre-existing)** — 23 failed / 1327 passed across 105 files. All in ability/trait/econ-balance suites. **Nothing in the repo imports `src/main.ts`** (`grep -rn "from '.*main'" src/ scripts/ e2e/` returns nothing), so this plan cannot have caused any of them. |

Both pre-existing failure sets were already logged in `deferred-items.md` during 04-01 and are re-confirmed (with one drift noted) there now.

### The verification gap this plan carries deliberately

`npm test` **does not cover `src/main.ts`** — the file has no test suite and nothing imports it. So the vitest suite passing proves nothing about the six input handlers this plan rewrote. That is an accepted risk recorded in the plan's own `must_haves` as `verification: backstop`, not a gap discovered here, and this repo has no browser automation to close it with. The compensating control is human verification; the phase-exit gate is **plan 04-06's `<verification>` block, section A**. The checklist below is this plan's scoped subset of it.

## Manual verification checklist

**M1-M8 need only a solo game** (`npm run dev`, click *Start Solo Game*). **M9-M12 need two browser tabs** against a running room (`npm run room:dev` in one terminal, `npm run dev` in another; open the app, click *Start Multiplayer Game*, copy the link into a second tab, then click *Start* in the host tab).

### Solo — nothing may have changed

| # | Do this | Expect |
|---|---------|--------|
| M1 | Click a shop card you can afford | Unit lands on the bench, gold drops by its cost, the card empties — exactly as before |
| M2 | Click the reroll button (and press `d`) | Shop rerolls, gold drops by 2, **the button flashes** |
| M3 | Click Buy XP (and press `f`) | XP bar moves, gold drops by 4, **the button flashes**. At level 10 it now shows an amber *"You are already at max level."* instead of doing nothing |
| M4 | Click the shop lock button | Lock toggles and persists across a reroll from the *next* round, same as before |
| M5 | Right-click a benched unit; separately, hover one and press `e` | Unit sells, gold goes up by its sell value, its copies return to the pool |
| M6 | Buy three copies of the same 1-cost, all landing on the bench | The combined 2★ bench slot **flashes** (grow + rumble, ~0.5s) — the star-up celebration must still fire |
| M7 | Field a 1★, then buy two more copies so the combine upgrades the FIELDED unit | The board unit **flashes** on the hex and shows as 2★; the board rebuilds so the upgraded copy is the one standing there |
| M8 | Spend down to under 1 gold, then click a shop card | A brief **amber notice** appears near the top reading *"Not enough gold."* and fades after ~2s. Previously this was a completely silent no-op — this is the one intentional visible change in solo play |

### Networked — the seam's other half

| # | Do this | Expect |
|---|---------|--------|
| M9 | In the guest tab, click a shop card you can afford | The buy appears in **both** tabs' state after a brief round trip. The guest's own tab must not show the change before the server's snapshot arrives |
| M10 | Click reroll rapidly ~5 times in the guest tab | The button flashes on every click; gold ends at exactly `start - n * 2` for however many were affordable. **No gold "rubber-bands"** back and forth — every intermediate value shown came from a server snapshot |
| M11 | Spend down to under 2 gold in one tab, then click reroll again | The **amber notice** appears with *"Not enough gold."* — the server's refusal, rendered |
| M12 | Buy three copies of a 1-cost in one tab so they combine | The bench slot flashes in **that** tab when the snapshot lands. (The other tab sees nothing — it is not that seat.) |

> M9-M12 overlap plan 04-06's section A. They are listed here so this plan's own slice is verifiable in isolation; 04-06 remains the single phase-exit gate.

## Deviations from Plan

### Additions beyond the written action

**1. [Rule 2 - missing critical functionality] `seenServerSnapshot` guard on the first snapshot's star-up diff**

- **Found during:** Task 1, while wiring `detectStarUps` into `applyServerSnapshot`
- **Issue:** The plan specifies diffing before/after composition inside `applyServerSnapshot`. On the *first* snapshot of a session, `before` is the player's own solo `RunState` (still in `run` when a lobby is joined) and `after` is the room's. Any unit the room holds at a higher tier than the solo save would fire a spurious star-up flash — most visibly on a host refreshing into a mid-game room.
- **Fix:** `let seenServerSnapshot = false`; the diff runs only when it is already true. Reset in `bootNetworked` and `leaveLobby` so a second lobby in the same page load starts clean.
- **Files modified:** `src/main.ts`
- **Commit:** `32e3c6e`

**2. [Rule 2] `bootNetworked`'s `rejected` handler excludes `'not-seated'`**

- **Found during:** Task 1, registering the `rejected` handler the plan asks for
- **Issue:** `'not-seated'` already has a terminal presentation from 04-01/04-02 (a sticky red banner *and* a Lobby Screen explanation). Routing it into the amber toast as well would layer a 2s transient over the more serious sticky message.
- **Fix:** `if (m.reason !== 'not-seated') reportActionRejected(m.reason)`, with the reason commented in place.
- **Files modified:** `src/main.ts`
- **Commit:** `32e3c6e`

**3. `OUTER_TIMEOUT_MS` raised from 5 to 8 minutes in `scripts/netClient.ts`**

- **Found during:** Task 2
- **Issue:** Scenarios 10-11 need a third `partykit dev` spawn (PLANNING_MS is a per-process `--var`), which adds a spawn plus healthcheck poll to a script that already spawns twice.
- **Fix:** Raised the outer guard rather than trimming a scenario. The full run completes well inside it.
- **Files modified:** `scripts/netClient.ts`
- **Commit:** `48d3f4f`

### Intentional behaviour changes (both are the plan's own must_haves landing)

- **A refused local action now shows an amber notice** where it was previously silent. This is the plan's *"no silent no-op that leaves the UI looking like the click did nothing"* requirement.
- **Buy XP at max level** now says so, because `applyAction` distinguishes `'max-level'` from `'no-gold'` where the old `buyXp()` collapsed both into `false`.
- **`renderTraitDisplay()` runs after every accepted local action**, not only after a buy. Consolidating the render into one place made a per-action render matrix the wrong shape of complexity; the render is cheap and a sell can change the active trait set too.

### Not done (out of scope, by the plan's own split)

- `sellFromBoard` is still called directly by `econBoardSell` — **plan 04-04's**, as the plan's verification block states explicitly.
- The drag-and-drop paths (`moveBoard`, `moveBench`, `placeItem`, `removeItem`) are untouched — **plan 04-04's**.
- The two-clients-one-pool conservation scenario is **plan 04-04's**; it needs the board and bench actions this plan does not yet route.

## Threat Flags

None. The threat register's dispositions all hold as written:

- **T-04-12 (accepted)** — `GameAction` still carries no seat field, and `dispatchAction` adds none. Seat authority remains `party/lobby.ts`'s connection-identity lookup.
- **T-04-13, T-04-14 (mitigate)** — the `netDropped` guard and `reportActionRejected` are both in place; scenario 11 proves the server side has a reason string to render.
- **T-04-15 (mitigate)** — `applyServerSnapshot` is still reached only via `parseServerMessage` and still never calls `saveRun`; the `saveRun` wrapper's `isNetworked()` early-return is the second lock.
- **T-04-16 (mitigate)** — the burst scenario sends 5 actions against a 600-per-phase budget; `sendAction` still no-ops outside status `'open'`.
- **T-04-SC** — no package installed.

## Self-Check: PASSED

- `src/main.ts` — FOUND, contains one `dispatchAction` definition + 6 call sites, one `detectStarUps` definition + 2 call sites, `reportActionRejected`, `localTierComposition`, `flashStarUps`
- `scripts/netClient.ts` — FOUND, 11 scenarios, `npm run net:client` exits 0
- `.planning/phases/04-client-networking-lobby-ui/04-03-SUMMARY.md` — FOUND (this file)
- Commit `32e3c6e` — FOUND
- Commit `48d3f4f` — FOUND
- `grep -c` source assertions — all 0 for `buyUnit(`, `shopReroll(`, `shopReroll`, `buyXp(`, `sellFromBench(`
