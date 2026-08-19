---
phase: 04-client-networking-lobby-ui
plan: 00
subsystem: client-networking
tags: [networking, playback, round-engine, pure-modules, tdd]
status: complete

requires:
  - src/net/protocol.ts (phase ServerMessage: deadline + serverNow)
  - src/net/fightWire.ts (FightChunk, decodeFightLog, cloneFightLog)
  - src/game/round.ts (FightLog, UnitFrame, ProjectileFrame, GameAction, applyAction)
  - src/core/hexGrid.ts (hexToPixel, BOARD_ROWS, BOARD_COLS)
provides:
  - src/net/roomClock.ts (RoomClock, captureDeadline, remainingMs, remainingSeconds, fractionRemaining)
  - src/net/fightBuffer.ts (FightBuffer, createFightBuffer, acceptChunk, takeFight, dropFight, MAX_TRACKED_FIGHTS, MAX_CHUNKS_PER_FIGHT)
  - src/game/playbackPerspective.ts (mirrorFightLogForSeat)
  - "src/game/round.ts: moveBoard.to accepts { bench: n }; placeItem accepts { onBench: n }; new removeItem variant"
affects:
  - plan 04-04 (drag-and-drop routing consumes the three new GameAction variants)
  - plan 04-05 (renderPlanningTimer consumes roomClock)
  - plan 04-06 (fightBuffer feeds decodeFightLog; mirrorFightLogForSeat sits between decodeFightLog and createPlaybackState)

tech-stack:
  added: []
  patterns:
    - "Time enters as a parameter, never read from a global clock inside the module — makes every countdown case testable without faking timers."
    - "Completeness by distinct-index set, never by arrival count."
    - "Event mirroring by field name rather than an exhaustive switch over a ~60-member union."

key-files:
  created:
    - src/net/roomClock.ts
    - src/net/roomClock.test.ts
    - src/net/fightBuffer.ts
    - src/net/fightBuffer.test.ts
    - src/game/playbackPerspective.ts
    - src/game/playbackPerspective.test.ts
  modified:
    - src/game/round.ts
    - src/game/round.test.ts

decisions:
  - "placeItem was widened as two union members sharing t: 'placeItem' (onHex | onBench) rather than a `target:` wrapper, so every existing onHex call site — including the room server's and the existing test suite's — keeps compiling unchanged."
  - "Unit visualPos mirroring anchors to the unit's own recorded hex for BOTH axes, not just x. Anchoring y as well makes the at-rest case exact for any HEX_SIZE rather than only for one where the anchor pair happens to sum to MIRROR_Y_SUM in floating point."
  - "CombatEvent positional payloads are mirrored by field name, not by an exhaustive switch: the union has ~60 vfx variants, and a missing case would be a silent miss rather than a compile error."
  - "removeItem uses `delete holder.item` rather than `= undefined`, avoiding the explicit-undefined key hazard round.ts already documents at captureFrame."

metrics:
  duration: ~35 min
  completed: 2026-08-19
  tasks: 4
  commits: 8

actuals:
  tokens: 37600
  tasks: 4
  commits: 8
---

# Phase 4 Plan 00: Dependency-Free Client Networking Primitives Summary

Four pure, DOM-free, unit-tested modules the rest of Phase 4 imports rather than authors: clock-skew-corrected countdown math, a bounded fight-chunk reassembly buffer, viewer-perspective orientation of a recorded fight, and the three `GameAction` variants that close the gap between networked and solo play.

## What Was Built

### Task 1 — `src/net/roomClock.ts`

`captureDeadline({ deadline, serverNow }, receivedAtMono)` subtracts the server's own two timestamps into a **duration** (`budgetMs`) and pairs it with the local monotonic reading at receipt. The absolute epoch `deadline` is deliberately never stored, so no later code can accidentally compare it against a local wall clock and bake in skew between a stranger's laptop and a Cloudflare edge worker.

`remainingMs` clamps at 0, `remainingSeconds` ceils (so a 30s phase reads "30" the instant it opens and "0" only when genuinely spent), `fractionRemaining` is clamped to `[0, 1]` with no divide-by-zero on a degenerate budget. A `deadline: null` phase is representable as a `null` clock, and all three accessors return 0 for it.

The monotonic reading enters as a parameter, which is what makes the skew case testable with no fake timers: two clocks capturing the same message with monotonic origins an hour apart produce byte-identical results for the same elapsed interval.

### Task 2 — `src/net/fightBuffer.ts`

Per-`fightId` buckets storing `index -> chunk`, so duplicates are idempotent by construction rather than by a scan. Completeness fires when a bucket holds `total` **distinct indices** — never by counting arrivals and never by adjacency to the `resolve` that announced the fight, because ordering across connections is unspecified.

Bounding (T-04-30): `MAX_TRACKED_FIGHTS` (2) caps concurrent buckets with oldest-incomplete eviction; `MAX_CHUNKS_PER_FIGHT` (512) caps any single fight; a chunk with a non-integer or out-of-range `index`, an implausible `total`, or a `total` disagreeing with its bucket's established value is rejected **before** a bucket is created or grown. A 500-id malformed flood leaves `buf.fights.size` at exactly 0.

### Task 3 — `src/game/playbackPerspective.ts`

`mirrorFightLogForSeat(log, localSeat)` inverts exactly one transform — `buildUnit`'s enemy-side row flip — so a seatB viewer always sees itself on the bottom half in player colours. Identity (same object, `toBe`) for the seatA case and for a seat in neither slot.

The non-obvious part: **there is no single affine pixel transform that reproduces the row flip.** `BOARD_ROWS - 1 - row` inverts row parity, and `hexToPixel` shifts odd rows right by half a hex, so a naive vertical pixel flip lands half a hex off on every other row. Unit `visualPos` is therefore mirrored by taking the offset from the unit's **own** hex anchor and re-placing it against the mirrored anchor. Asserted exact — not within a tolerance — over all 56 board hexes.

Projectiles and in-flight leap endpoints have no hex of their own, so they take the exact affine reflection `y' = (BOARD_ROWS - 1) * 1.5 * HEX_SIZE + 2 * HEX_SIZE - y` derived from `hexToPixel`'s own formula.

Presentational guarantees (T-04-32): `winner` is remapped in exactly one place; no frame, event, tick, HP or ordering is touched. Proven on a real 1260-frame `recordFight` log.

**Finding — `CombatEvent` does carry positional data.** The plan left open whether any variant does; roughly 40 of its ~60 `vfx` variants do (`x`/`y`, `fromX`/`fromY`/`toX`/`toY`, `hexPositions[]`, `positions[]`, `targetRow`, `dirX`/`dirY`, swing angles), and `earthquake` carries a `team`. These are mirrored by **field name** rather than by an exhaustive switch: a new vfx variant added by a future ability would silently skip an exhaustive switch with no compile error, because the miss is a missing case, not a type error. Ids, amounts, damage types and durations are copied verbatim.

### Task 4 — `src/game/round.ts` (extended)

- `moveBoard.to` widened to `{ col, row } | { bench: number }`, matching `moveBench.to`'s vocabulary. Pillars are refused (`unsellable`), an occupied slot fails `occupied`, an out-of-range slot fails `no-unit`. No cap check applies — fielding drops by one.
- `placeItem` accepts `{ onBench: n }`, returning any displaced item to `itemBench`.
- New `{ t: 'removeItem'; from: 'bench' | 'board'; index: number }`, mirroring `sell`'s addressing.

Every new branch validates fully before mutating and resolves its economy only from `state.players[seat]` (T-04-33). **No new `ActionReason` values were needed** — `no-unit`, `no-item`, `occupied` and `unsellable` covered every failure mode.

## Deviations from Plan

### Auto-fixed / judgement calls

**1. [Rule 2 — missing critical functionality] `UnitFrame.leap` endpoints are mirrored**

- **Found during:** Task 3
- **Issue:** The plan enumerated `UnitFrame`, `ProjectileFrame`, terrain, tailwind and events, but did not name `UnitFrame.leap` (`sx`/`sy`/`ex`/`ey`). Left unmirrored, every dash arc would point the wrong way vertically for a seatB viewer while the unit itself moved correctly.
- **Fix:** `sy`/`ey` take the same affine reflection projectiles use (a dash endpoint is a free pixel point with no hex). Covered by a dedicated test.
- **Files:** `src/game/playbackPerspective.ts`, `src/game/playbackPerspective.test.ts`

**2. Involution asserted within a documented sub-nanopixel epsilon, not bit-exactly**

- **Found during:** Task 3
- **Issue:** The plan asks for "a log deep-equal to the original" after a double mirror. Measured against a real recorded fight, this is **not achievable in IEEE-754**: reflecting a float about a midline and back re-rounds (`fl(C - fl(C - y))`), drifting by up to ~6e-14 px on the `y` of a mid-move unit or an in-flight projectile. Both candidate formulations (anchored, and the single-rounding affine form) were implemented and measured — the drift is identical, so no reformulation removes it.
- **Fix:** A purpose-built `expectInvolution` comparator that requires **exact** equality for every string, boolean, null, array length and key set, and allows at most 1e-9 on numbers. A team that failed to swap back, a row flipped wrong, a dropped event, a reordered frame or a mutated HP value all still fail it — only float noise is forgiven. The reasoning is documented in both the test and the module.
- **Note:** The separate at-rest assertion is still **exact**, over all 56 hexes, which is the case a viewer actually looks at.

**3. `placeItem` widened as two union members rather than a `target:` wrapper**

- **Found during:** Task 4
- **Rationale:** The plan's acceptance criteria require the full existing suite to pass unchanged. A `target: { onHex } | { onBench }` wrapper would have broken every existing `{ t: 'placeItem', itemIndex, onHex }` call site including the room server's. Two members sharing `t: 'placeItem'` is the same discriminated target with zero call-site churn, and `'onBench' in action` narrows exactly as `'bench' in action.to` already does for `moveBench`.

**4. Comment wording adjusted to satisfy literal grep criteria**

Two acceptance criteria are literal greps (`Date.now()`/`performance.now()` must not appear in `roomClock.ts`; `" 7 "` must not appear in `playbackPerspective.ts`). Both initially matched only inside explanatory prose, never in code. Prose reworded (`Date.now`, `(BOARD_ROWS - 1) - row`); no behavioural change.

### Not deviations

- No new npm dependency was added (T-04-SC holds — no install task existed).
- `src/main.ts`, `party/lobby.ts` and `src/net/protocol.ts` were not touched, as required for wave-1 parallelism with 04-01.

## Acceptance Criteria — Verification

All four tasks were executed TDD (failing test committed, then implementation), giving 8 commits.

| Criterion | Result |
|---|---|
| `npx vitest run src/net/roomClock` | 13 passed |
| `grep -c "performance.now()\|Date.now()" src/net/roomClock.ts` | `0` |
| `grep -c "document\.\|window\." src/net/roomClock.ts` | `0` |
| Null-clock path asserted for all three accessors | yes |
| `npx vitest run src/net/fightBuffer` | 15 passed |
| `grep -c "document\.\|window\.\|localStorage" src/net/fightBuffer.ts` | `0` |
| `grep -c "MAX_TRACKED_FIGHTS\|MAX_CHUNKS_PER_FIGHT" src/net/fightBuffer.ts` | `5` (≥4) |
| Dedicated eviction + disagreeing-`total` tests | yes |
| `npx vitest run src/game/playbackPerspective` | 14 passed |
| At-rest assertion iterates all `BOARD_COLS * BOARD_ROWS` = 56 hexes | yes, exact equality |
| `grep -c "BOARD_ROWS" src/game/playbackPerspective.ts` | `7` (≥2) |
| `grep -c " 7 " src/game/playbackPerspective.ts` | `0` |
| `grep -c "cloneFightLog" src/game/playbackPerspective.ts` | `3` (≥1) |
| Involution test runs against a `recordFight` log | yes (1260 frames) |
| Non-mutation checks the original after the call | yes |
| `npx vitest run src/game/round` | 84 passed |
| `grep -c "removeItem" src/game/round.ts` | `3` (≥2) |
| `grep -c "onBench" src/game/round.ts` | `3` (≥2) |
| `grep -n "bench:"` shows `moveBoard.to` alongside `moveBench.to` | yes (lines 57, 58) |
| `npm run room:smoke` | all assertions passed |
| `npm run room:seats` | all assertions passed |
| `npm run room:round` | all assertions passed (7 chunks, 1847-frame fight, byte-identical across both clients) |

`npx vitest run src/game src/net` — **145 passed, 0 failed** across all six suites.

`npx tsc --noEmit` reports **zero errors in `src/game`, `src/net`, `party` and `scripts`**.

## Deferred Issues (pre-existing, out of scope)

`npm test` (full suite) reports **23 failing tests across 8 files** and `npx tsc --noEmit` reports 16 errors. **All are pre-existing at this plan's base commit (`0b7af1a`) and live in files this plan does not touch.** Verified explicitly: with this plan's `round.ts` change stashed, the same suites fail identically.

- Failing suites: `src/core/abilities/abomasnow.test.ts`, `src/core/abilities/ribombee.test.ts`, `src/core/systems/mystic.test.ts`, `src/core/systems/cavecrawler.test.ts`, `src/econ/bots.test.ts`, `src/econ/constants.test.ts`, `src/econ/income.test.ts`, `src/econ/xp.test.ts` — balance-number drift (e.g. Ribombee tier-3 expects 300, gets 400) and XP-table changes.
- `tsc` errors: unused locals/params and dead `=== 'dead'` comparisons in `src/core/abilities/*`, `src/core/systems/persistentAoE.ts`, `src/core/systems/statusEffect.ts`, `src/sim/runner.ts`.

The plan's verification block asks for a clean full `npm test` and `tsc`; that bar cannot be met from inside this plan without editing unrelated combat/econ files, which the scope boundary forbids. Logged here for a follow-up.

## Known Stubs

None. Every exported function is fully implemented and unit-tested; no placeholder values, no TODO markers, no skipped tests were introduced.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change at a trust boundary was introduced beyond those the plan's threat register already covers.

## Commits

| Commit | Message |
|---|---|
| `0d85d40` | test(04-00): add failing tests for clock-skew-corrected countdown math |
| `fee223c` | feat(04-00): add clock-skew-corrected planning countdown math |
| `77582a3` | test(04-00): add failing tests for bounded fight-chunk reassembly |
| `5ce8b12` | feat(04-00): add bounded fight-chunk reassembly buffer |
| `59e3542` | test(04-00): add failing tests for viewer-perspective fight mirroring |
| `005b3f8` | feat(04-00): orient a recorded fight to the viewer's own side of the board |
| `387bdac` | test(04-00): add failing tests for the three missing GameAction variants |
| `5ba51b4` | feat(04-00): close the three GameAction gaps the networked UI needs |

## TDD Gate Compliance

Each of the four tasks carries a `test(...)` commit (RED, verified failing) followed by a `feat(...)` commit (GREEN). No REFACTOR commit was needed. Gate sequence intact for all four.

## Notes for Downstream Plans

- **04-05:** `captureDeadline` must be called with `performance.now()` at the moment the `phase` message is received — not later in a render tick — or the capture inherits the delay as skew.
- **04-06:** `mirrorFightLogForSeat` sits strictly between `decodeFightLog` and `createPlaybackState`. Nothing downstream may re-derive a winner; `playbackWinner` already returns `log.winner` verbatim, which is what keeps the mirror from flipping an outcome.
- **04-06:** `takeFight` removes the bucket, so call it once per fight and hold the result. A second call returns `null`.
- **04-04:** All three new `GameAction` variants are live and validated. `moveBoard` to a bench slot refuses Ascender pillars with `unsellable`, matching the solo UI's own bench-drop rejection — route that reason to the existing "held unit rejected" flash rather than a generic error.

## Self-Check: PASSED

- All 6 created files and both modified files verified present on disk.
- All 8 commit hashes verified present in `git log`.
- All claimed test counts re-run and confirmed (145 passed across `src/game` + `src/net`).
- All three room-server integration scripts re-run and confirmed passing.
