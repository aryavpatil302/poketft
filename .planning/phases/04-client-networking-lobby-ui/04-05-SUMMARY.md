---
phase: 04-client-networking-lobby-ui
plan: 05
subsystem: client-networking
tags: [networking, ui, countdown, seat-list, clock-skew]
status: complete

requires:
  - "04-00: src/net/roomClock.ts (captureDeadline / remainingMs / remainingSeconds / fractionRemaining)"
  - "04-00: party/lobby.ts broadcastPhase + the deadline/serverNow pair on the wire"
  - "04-01: isNetworked() / netDropped / applyServerSnapshot / setNetStatusBanner"
  - "04-02: src/ui/escapeHtml.ts, src/ui/lobbyScreen.ts's pre-game 'Current players' list"
  - "04-03: reportActionRejected's transient amber notice"
  - "04-04: dispatchAction covering shop AND board/bench/item actions"
provides:
  - "netPhase / netClock / netLobby — the room's phase, countdown and seat view held on the client"
  - "renderPlanningTimer's networked branch — a server-driven countdown that never acts at zero"
  - "renderLobby's human-vs-bot badge, total ordering and HTML-escaped names"
  - "seatIsHuman(seat) — live presence, read off the room's lobby broadcast"
  - "scripts/netClient.ts scenario 13 'deadline agreement'"
affects:
  - "04-06: consumes the 'resolve' message this plan deliberately leaves unhandled"

tech-stack:
  added: []
  patterns:
    - "One clock-skew correction, imported not re-derived: no branch in src/main.ts does arithmetic on a phase message's absolute deadline"
    - "Server-as-authority: every local round-advance path is closed behind !isNetworked()"

key-files:
  created: []
  modified:
    - src/main.ts
    - scripts/netClient.ts
    - .planning/phases/04-client-networking-lobby-ui/deferred-items.md

decisions:
  - "The countdown's zero handler is a deliberate no-op while networked — the server's resolve is the only thing that ends a planning phase."
  - "enterGameOver omits the New Run button entirely while networked rather than disabling it, so there is no element to re-enable in devtools."
  - "The in-game seat list ranks by HP descending with an ascending-seat-index tiebreak; the Lobby Screen's pre-game list stays strict seat-index order. The two lists answer different questions and the divergence is intentional."
  - "showRejectNotice(text) was split out of reportActionRejected so client-side refusals with no wire reason get accurate text instead of being forced into a wrong RejectReason."

metrics:
  duration: ~55m
  completed: 2026-08-20

actuals:
  tokens: 41000
  tasks: 2
  commits: 4
---

# Phase 04 Plan 05: Server-Driven Countdown & Live Seat List Summary

The networked client now renders the room's own planning countdown (corrected
for clock skew via `src/net/roomClock.ts`) and an in-game seat list that shows
each seat's name, HP and whether a live human or a bot persona is holding it —
both driven entirely by server broadcasts, with every local round-advance path
closed behind `!isNetworked()`.

## What Was Built

### Task 1 — The server drives the countdown and the phase machine (`93e1914`)

**Room phase held on the client.** Three module-level values sit next to `net`:
`netPhase: RoomPhase | null`, `netClock: RoomClock | null`, and
`netLobby: LobbySeatView[] | null`. All three are cleared by both
`bootNetworked` and `leaveLobby`, so a second lobby never inherits the first
room's state.

`bootNetworked`'s handler gained a full `phase` branch (replacing the old
`m.t === 'phase' && m.phase === 'planning'` special case). Every `phase` frame
sets `netPhase` and re-captures `netClock` through
`captureDeadline(m, performance.now())` — which returns `null` for any phase
carrying no deadline, so the countdown never outlives its phase. Then:

| Phase | Behaviour |
|-------|-----------|
| `planning` | Dismiss the Lobby Screen, `econPhase = 'planning'`, `updateEconVisibility()`. Also the late-joiner path: `party/lobby.ts`'s `onConnect` sends this same frame mid-phase, so a third tab picks up live remaining time with no special case. |
| `resolving` | **Documented no-op.** Kept deliberately unreachable — see below. |
| `over` | Clear `netClock`, then `enterGameOver` with the outcome read off the snapshot (win exactly when this seat is the sole non-eliminated player). |
| `lobby` / `idle` | Clear `netClock`; the bar hides. |

**`renderPlanningTimer` split into two real branches.** Plan 04-01's blunt
`if (isNetworked()) { hide; return }` guard is gone, replaced by a networked
branch that renders `fractionRemaining()` for the fill width and
`remainingSeconds()` for the label, reusing the existing element ids and
green/amber/red thresholds so the two modes are indistinguishable on screen.
When it reaches zero it does **nothing** — no `startCombat()`, no state change.
That is called out in a comment directly above the branch, because the solo
branch immediately below it *does* call `startCombat()` at zero.

**Every local round-advance path closed while networked** (T-04-19):

| Path | Guard |
|------|-------|
| `renderPlanningTimer`'s zero handler | Networked branch returns before the solo `startCombat()` |
| `startCombat()` | Pre-existing `if (isNetworked()) return` (04-01), kept, already points at 04-06 |
| `restorePlayerBoard()` | `if (econActive() && !isNetworked())` |
| `resetCombat()` | `if (econActive() && !isNetworked())` |
| `btn-reset` handler | Early return + `showRejectNotice` |
| `enterGameOver`'s New Run button | Omitted entirely when networked (explanatory line instead) |
| `chk-test-mode` toggle | Checkbox reverted to unchecked + `showRejectNotice` |

`planningTimerStartTs` and `PLANNING_TIME_LIMIT_MS` are untouched — they remain
the solo path's mechanism.

**Supporting refactor:** `reportActionRejected(reason)` was split into
`showRejectNotice(text)` plus a thin reason→text wrapper. The three new
client-side refusals above have no `ActionReason`/`RejectReason` to look up, so
forcing them through the existing map would have shown wrong text
(`'not-implemented'` → "That is not available yet.").

### Task 2 — The seat list shows human vs bot and HP, live (`2ff403d`, `09d7ccb`)

**`seatIsHuman(seat)`** reads `netLobby`'s `human` flag, which
`party/seats.ts`'s `lobbyView` derives from live `table.occupants` (never from
the persisted `personaId`) — that is what makes it a trustworthy presence
indicator. A seat with no matching view entry falls back to bot, so a short,
empty or not-yet-arrived `netLobby` renders rather than throwing. Solo falls
back to `seat === localSeatIndex`.

**`renderLobby` extended:**
- HP-descending order gained an ascending-seat-index tiebreak
  (`rank(b.p) - rank(a.p) || a.i - b.i`), making the order total and stable so
  equal-HP seats never swap places between renders. A comment records why this
  deliberately differs from the Lobby Screen's strict seat-index pre-game list.
- A small `HUMAN` / `BOT` badge renders next to each name (green vs grey).
- Every name now passes through `escapeHtml` (T-04-17). The existing HP bar,
  level, elimination strike-through, next-opponent highlight, `.lobby-row`
  class and `data-pi` attribute are all unchanged, so `showLobbyTooltip`'s
  hover behaviour still works.

**Message wiring:** `netLobby` is assigned from `welcome.lobby` and from every
`lobby` broadcast, each followed by `renderLobby()`. `seat-taken` / `seat-freed`
call `renderLobby()` only — a comment states explicitly that they are
belt-and-braces refreshes, not a second source of truth, since the room
broadcasts a full `lobby` view alongside each.

**`scripts/netClient.ts`:**
- **New scenario 13, "deadline agreement".** Two clients in one room; asserts
  both receive an identical absolute `deadline`, `serverNow` values within
  250 ms, and — feeding each client's own `phase` frame to the **real**
  `captureDeadline` from monotonic origins 1,000,000 ms apart — `remainingMs`
  readings agreeing within 100 ms. It imports `../src/net/roomClock`, so a
  regression in that module fails here, not just in its unit tests.
- **Scenario 8 gained an HP assertion.** After a resolve, a third client
  connects (a `lobby` view is broadcast on connect/close only), and both
  original clients' views are asserted to report identical per-seat HP. Its
  `PASS:` line moved to the end of `lobbyScreenFlow`, because HP is only
  meaningful once a round has settled — which needs the round loop that only
  scenario 9's Start opens. That reordering is commented in place.

## The deliberately-unreachable `resolving` branch

Kept as specified, **not** "fixed". `party/lobby.ts`'s `onDeadline` sets
`this.phase = 'resolving'` as its first statement but never calls
`broadcastPhase()` for that transition — only the planning-start and `'over'`
transitions broadcast. The client learns a round resolved from the `resolve`
message instead (plan 04-06). The branch is a no-op that neither advances local
state nor hides the board, carrying a comment naming `resolve` as the real
signal, so nobody later writes code that waits for a broadcast that is never
sent. **No `broadcastPhase()` call was added to `party/lobby.ts`.**

## Automated Checks

| Check | Result |
|-------|--------|
| `npm run net:client` | **PASS** — exit 0, all assertions across **13** scenarios, including scenario 13's 7 `OK:` lines and scenario 8's new HP assertions |
| `npx tsc --noEmit` on changed files | **PASS** — `grep -E "src/main.ts\|scripts/netClient.ts"` over the output returns nothing |
| `grep -n "captureDeadline\|remainingSeconds\|fractionRemaining" src/main.ts` | **PASS** — all three imported from `./net/roomClock` and used in `renderPlanningTimer` / the `phase` handler |
| `grep -n "m\.deadline"` in `src/main.ts` | **PASS** — no matches; zero local arithmetic on the absolute deadline |
| `grep -c "from '../src/net/roomClock'" scripts/netClient.ts` | **PASS** — returns 1 |
| `grep -n "startCombat()" src/main.ts` | **PASS** — the only call inside `renderPlanningTimer` (line 1373) sits after the networked branch's `return` |
| `startPlanningPhase` call sites | **PASS** — all 8 audited: 2 guarded by `!isNetworked()`, 3 behind networked early-returns, 1 inside `startCombat` (which returns early), 1 in the item-round path (only reachable via `startCombat`), 1 in `bootSolo` |
| `grep -c "escapeHtml" src/main.ts` | **PASS** — 2 (import + the `renderLobby` name interpolation) |
| `grep -n "netLobby" src/main.ts` | **PASS** — set from `welcome.lobby` and the `lobby` broadcast, read by `seatIsHuman` for `renderLobby` |
| `grep -n "netPhase" src/main.ts` | **PASS** — the `'over'` branch calls `enterGameOver` |
| `npx vitest run` | **23 pre-existing failures**, unchanged — see below |
| `npx tsc --noEmit` (whole repo) | **16 pre-existing errors**, unchanged — see below |

### Pre-existing failures (NOT caused by this plan)

`npx tsc --noEmit` and `npm run build` were already failing on `master`, and
`npx vitest run` already had 23 failures across 8 files. Verified pre-existing
by reading the offending lines out of `git show HEAD:<file>` rather than
assuming. `git diff --name-only master...HEAD` shows this plan touched only
`src/main.ts` and `scripts/netClient.ts`, and no failing suite imports either.
Already catalogued in `deferred-items.md` from 04-01/04-03; re-confirmed there
under a new "Re-confirmed during 04-05" heading. Not fixed here, per the
executor scope boundary.

**`dist/` was not dirtied.** `npm run build` is `tsc && vite build`; `tsc` exits
non-zero on the pre-existing errors, so `vite build` never ran and no bundle
output was emitted. `git status --short` was empty afterwards, so no
`git checkout -- dist` was needed. One new hazard of the same class was found
and logged: `node_modules/.vite/vitest/results.json` is tracked and is
rewritten by every `vitest run`; it was reverted before staging.

## Manual Verification Checklist

None of the below can be automated — this repo has no browser automation, and
these are exactly the two-tab behaviours NET-05 is about. The consolidated
phase-exit gate is plan 04-06's `<verification>` block (sections C and D);
this checklist is the per-plan confidence check.

**Setup:** `npm run room:dev` in one terminal, `npm run dev` in another. Open
tab A at the dev URL, click **Start Multiplayer Game**, copy the share link,
open it in tab B. Click **Start** in tab A.

### A. Countdown accuracy and agreement

- [ ] **A1.** Both tabs show the countdown bar the moment the host clicks
      Start, and both read the same number of seconds at the same moment
      (put the windows side by side; they should never differ by more than 1).
- [ ] **A2.** Both bars pass green → amber (under 50%) → red (under 20%) at the
      same time, and look identical to solo mode's bar.
- [ ] **A3.** Both reach 0 together, and **neither tab starts a fight by
      itself at zero.** The fight begins only when the server's resolve
      arrives (which, until 04-06 lands, means: nothing visibly happens at
      zero except the bar hiding — that is correct for this plan).
- [ ] **A4. Clock-skew check.** Change one machine's system clock forward by
      an hour (macOS: System Settings → General → Date & Time, disable "Set
      time automatically"), reload that tab, rejoin. The countdown must still
      read the same as the other tab — *not* already-expired. Restore the
      clock afterwards.
- [ ] **A5. Late joiner.** Mid-countdown, open a third tab on the share link.
      It must pick up the correct remaining seconds (e.g. joining with 12s
      left shows ~12), **not** restart at 30.
- [ ] **A6. Solo untouched.** Back on the Title Screen, Start Solo Game: the
      countdown still runs from 30 and still auto-starts combat at zero.

### B. Live seat list (human vs bot, HP)

- [ ] **B1.** With both tabs in a started room, the right-hand Lobby panel
      shows six seats, each with a name, HP bar, level, and a visible
      `HUMAN`/`BOT` badge.
- [ ] **B2.** Exactly the two connected seats are marked `HUMAN` (green); the
      other four are `BOT` (grey). Each tab agrees with the other.
- [ ] **B3. Disconnect liveness.** Close tab B. Within about a second and with
      **no refresh**, tab A's list flips that seat from `HUMAN` to `BOT` and
      its name reverts to the bot persona's.
- [ ] **B4. Reconnect liveness.** Reopen the share link. The seat flips back to
      `HUMAN` in tab A, again with no refresh.
- [ ] **B5. Pre-game state.** Open a fresh lobby but do **not** click Start.
      The in-game list must not error — check devtools console for exceptions.
      All seats read full HP (100).
- [ ] **B6. Stable ordering.** Before any round resolves every seat is on 100
      HP; watch the list across several re-renders (buy something to force
      one) and confirm rows never reshuffle.
- [ ] **B7. Tooltip intact.** Hover a seat row — the scouting tooltip
      (board preview, traits, power) still appears as before.
- [ ] **B8. Name escaping.** Connect with a crafted `name=` query parameter,
      e.g. `name=<img src=x onerror=alert(1)>`. The server's
      `sanitizeDisplayName` strips angle brackets and the client's
      `escapeHtml` is the second lock: no alert should fire and no markup
      should render in either list.

### C. Refusals while networked

- [ ] **C1.** The reset button in a lobby shows the amber notice "You cannot
      restart a lobby run…" and does **not** reset anything.
- [ ] **C2.** If the test-mode checkbox is reachable, toggling it in a lobby
      shows "Test mode is not available inside a lobby." and the checkbox
      snaps back to unchecked.
- [ ] **C3.** On game over in a lobby, there is **no** New Run button — only
      the explanatory line.

## Deviations from Plan

### Rule 2 — Auto-added: `showRejectNotice(text)` split

**Found during:** Task 1, step 3.
**Issue:** The plan asks the reset button, New Run and test-mode toggle to
"show the rejection notice from plan 04-03". That notice's only entry point,
`reportActionRejected(reason)`, takes an `ActionReason | RejectReason` and looks
the text up in `REJECT_TEXT`. None of the three new refusals is a wire reason,
and the closest existing key (`'not-implemented'` → "That is not available
yet.") would have told the player something false.
**Fix:** Extracted the DOM/timer body into `showRejectNotice(text: string)` and
reduced `reportActionRejected` to a one-line reason→text wrapper. Same element,
same fade convention, same 2s timeout — no behaviour change for existing
callers.
**Files modified:** `src/main.ts`. **Commit:** `93e1914`.

### Ordering deviation: scenario 8's `PASS:` line moved

**Found during:** Task 2, step 4.
**Issue:** The plan asks scenario 8 to gain an HP assertion "after at least one
resolve", but scenario 8 runs against a room that has *never* been started —
scenario 9 is what opens the round loop. The assertion cannot execute where
scenario 8's body ends.
**Fix:** The HP block runs at the end of `lobbyScreenFlow` (after scenario 9),
still using scenario 8's `s8` assertion function, with
`scenarioPassed('seat list liveness')` moved there so the PASS line reports the
whole property it claims. Both the deferred PASS and the reason are commented
in place. Consequence: the `PASS:` lines print as `host-gated dismissal` then
`seat list liveness`. The scenario count is computed, not hardcoded, so the
final line correctly reports 13.
**Files modified:** `scripts/netClient.ts`. **Commit:** `09d7ccb`.

### Not done, deliberately

- **`npm test` / `npm run build` exiting 0** — both were already failing on
  `master` for reasons entirely outside this plan (16 tsc errors, 23 test
  failures, none in touched files). Out of scope per the executor scope
  boundary; logged in `deferred-items.md`.
- **No `broadcastPhase()` call added to `party/lobby.ts`** — the
  `'resolving'` branch stays deliberately unreachable, as specified.

## Threat Mitigations Applied

| Threat | Status |
|--------|--------|
| T-04-17 (name interpolation) | **Mitigated** — `escapeHtml(p.name)` in `renderLobby` |
| T-04-18 (hostile server timestamps) | **Mitigated** — all clamping delegated to `roomClock`'s `remainingMs` (clamps at 0) and `fractionRemaining` (clamps to 0..1); `captureDeadline` rejects non-finite values |
| T-04-19 (client-side round advancement) | **Mitigated** — 7 paths closed, table above |
| T-04-20 (seat list contents) | **Accepted** — renders only what `lobbyView` already broadcasts |
| T-04-21 (unbounded lobby view) | **Mitigated** — rows bounded by `run.players.length`, each looking its entry up by seat |
| T-04-SC (package installs) | **N/A** — no package installed |

## Known Stubs

None. No stub patterns, no `TODO`/`FIXME`, no skipped tests, and no unrun
`<verify>` blocks were introduced by this plan. The `'resolving'` branch is an
intentional documented no-op, not a stub — it is specified as such by the plan
and by the plan-checker's verification note.

## Self-Check: PASSED

- `src/main.ts` — FOUND, modified
- `scripts/netClient.ts` — FOUND, modified
- `.planning/phases/04-client-networking-lobby-ui/deferred-items.md` — FOUND, appended
- Commit `93e1914` — FOUND
- Commit `2ff403d` — FOUND
- Commit `09d7ccb` — FOUND
