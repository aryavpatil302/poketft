---
phase: 02-transport-agnostic-round-engine
plan: 01
subsystem: game-engine
tags: [typescript, vitest, round-engine, combat-recording, economy]

# Dependency graph
requires:
  - phase: 01-seat-agnostic-core-refactor plan 02
    provides: "personaId === null as the human discriminator; humanTablePower(state); LiveMatchResult; resolveBotFight(a, b, rng?)"
provides:
  - "seededRng(seed) — economy-only LCG, never seeds combat"
  - "GameAction / ActionReason / ActionResult / applyAction(state, seat, action, rng?) — full 8-variant action contract, 'buy' wired, rest 'not-implemented'"
  - "startPlanning(state, rng?) — banks pendingIncome then rolls each unlocked/all-null living seat's shop, ascending seat order, pool never decremented"
  - "UnitFrame / ProjectileFrame / FightFrame / FightLog / recordFight(state, seatA, seatB, stage) — one real combatEngine run per fight, every tick captured, JSON-pure"
  - "SeatFightResult / RoundResult / resolveRound(state, roundSeed) — pairs every living seat, records human-involved fights, resolves bot-vs-bot abstractly, settles via settleRound"
affects: [Plan 02 (remaining GameAction cases), Plan 03, Plan 04 (elimination/crawler/bot-replan/human-deferral completion of resolveRound), Plan 05, Phase 3 room server, Phase 4 client playback]

# Actuals (#2632)
actuals:
  tokens: 7231
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transport-agnostic module under src/game/ — zero browser globals, importable/runnable under plain Node, the shape Phase 3's room server and Phase 4's client will both call into"
    - "recordFight runs its own per-tick loop over createCombatState/advanceCombatTick instead of delegating to runCombat — needed because runCombat's per-tick callback only fires on event-bearing ticks (movement-only ticks would be silently dropped from playback) and its default cap (1800) is shorter than the live game's real hard-draw cap (3600)"
    - "FightFrame captures a defensive copy of CombatState.events every tick (advanceCombatTick reassigns the live array at the start of the next tick) — guarded by an explicit anti-aliasing regression test"
    - "ProjectileFrame is a hand-picked serializable subset of the live Projectile — callback functions (hit/tick handlers) and damage/heal payload objects are excluded by construction, not filtered at serialization time"

key-files:
  created:
    - src/game/round.ts
    - src/game/round.test.ts
  modified: []

key-decisions:
  - "Eliminated seats 2-5 in both the tracer test and the log/settlement-agreement test (leaving only seat 0 human + seat 1 bot living) to make resolveRound's Fisher-Yates pairing deterministic — with all 6 seats living, seat 0's opponent (and therefore which single FightLog gets a non-empty frames array) would depend on the seed's shuffle outcome across a 6-element array, which is not the property under test. This is a test-setup choice, not a change to resolveRound's exported behaviour."
  - "Used two 'dummy' (0-attack, isDummy) units for the cap-draw test instead of stubbing the engine — a genuine fixture that provably never resolves before 3600 ticks, per the plan's explicit preference for a real fixture over a weakened assertion."
  - "Rephrased two in-code comments that would otherwise contain the literal substrings 'onHit', 'onTick', 'damagePayload', 'healPayload' (present as explanatory prose, not as copied fields) — the plan's own acceptance criterion greps for these tokens across the whole file including comments, so the explanation was reworded to 'hit/tick callback functions' and 'damage/heal payload objects' without losing the intent."
  - "applyAction's rng parameter is not yet read by the only wired case ('buy', which delegates to buyUnit — no rng needed); marked with an explicit `void rng` plus a comment rather than dropping the parameter, since noUnusedParameters is enforced project-wide and the signature must stay intact for Plan 02's reroll case."

requirements-completed: [ROUND-01, ROUND-02, ROUND-03, ROUND-04]

coverage:
  - id: D1
    description: "src/game/round.ts is Node-clean (no DOM/browser-global reference) and exports the full public contract for the round engine"
    requirement: "ROUND-01"
    verification:
      - kind: unit
        ref: "grep -vE '^\\s*(//|\\*|/\\*)' src/game/round.ts | grep -cE 'document\\.|window\\.|localStorage|requestAnimationFrame' → 0"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit 2>&1 | grep -E '^src/game/' → (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One call chain — applyAction(buy) → startPlanning → resolveRound — drives a full round for a lobby with a human seat, producing a real recorded fight whose winner agrees with the settlement"
    requirement: "ROUND-01"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#round engine — tracer slice > drives buy → startPlanning → resolveRound end to end with a real recorded fight"
        status: pass
    human_judgment: false
  - id: D3
    description: "recordFight records one FightFrame per elapsed tick (not per event), in strictly ascending, non-aliased, unsorted order; the log is pure JSON; a genuine no-kill matchup draws at the 3600-tick cap; all three empty-side forfeit branches short-circuit without simulation"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#recordFight (8 tests: ordering, anti-aliasing, verbatim event order, frame-per-tick, JSON round-trip, cap-draw, 3 forfeit branches)"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolveRound's settlement of every human-involved fight agrees with that fight's recorded log — the seat SeatFightResult credits with the win is the seat the log's winner field names"
    requirement: "ROUND-03"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#resolveRound — log/settlement agreement > every SeatFightResult with a non-null logIndex agrees with the log it points to"
        status: pass
    human_judgment: false
  - id: D5
    description: "startPlanning never decrements the shared pool, skips eliminated seats entirely, honours the shop lock (banks regardless, rolls only when unlocked or all-null), banks pendingIncome before rolling for every living seat, and handles degenerate lobbies (all-eliminated, bots-only) without throwing"
    requirement: "ROUND-02"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#startPlanning (6 tests: pool-safety, eliminated-skip, lock-honoured, banking-order, all-eliminated no-op, bots-only lobby)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full test suite stays at or below the freshly re-measured baseline; tsc error count and src/core/ diff stay unchanged"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "npx vitest run → 23 failed / 1139 passed (1162 total), stable across 3 runs, vs re-measured baseline 23-24 failed / 1122-1123 passed (1146 total)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit 2>&1 | grep -c 'error TS' → 16 (unchanged); git diff --name-only HEAD -- src/core/ → (empty)"
        status: pass
    human_judgment: false

duration: 27min
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 1: Transport-Agnostic Round Engine Tracer Summary

**`src/game/round.ts` — a Node-clean, DOM-free module exporting `applyAction`/`startPlanning`/`recordFight`/`resolveRound` and the full `FightLog`/`FightFrame` type contract — runs a real combat once per human-involved fight through `combatEngine`'s own tick loop and records every tick (not just event-bearing ones), with 17 vitest tests covering the tracer path plus the ordering, JSON-purity, cap-draw, forfeit, and shop-planning edge cases.**

## Performance

- **Duration:** ~27 min active work
- **Started:** 2026-08-16T23:45:00Z
- **Completed:** 2026-08-17T00:11:33Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `seededRng(seed)` — the same LCG the econ tests already use, seeding economy randomness only; combat stays on unseeded `Math.random` per this project's decision to stream recorded fight logs instead of deterministic replay.
- `GameAction` (8-variant discriminated union), `ActionReason`, `ActionResult`, and `applyAction(state, seat, action, rng?)` — the seat parameter is the sole authority for which `PlayerEcon` is touched; only `buy` is wired (delegates to `buyUnit`), the other 7 cases return `not-implemented` with an exhaustiveness-checked `switch` so a future unhandled variant is a compile error.
- `startPlanning(state, rng?)` — reproduces `startPlanningPhase`'s exact two-branch roll (bank → roll-if-unlocked → roll-if-all-null) for every living seat in ascending index order; never decrements `state.pool`.
- `recordFight(state, seatA, seatB, stage)` — builds both unit arrays directly from board entries (mirroring the enemy row transform `boardToSpecs` uses), runs its own tick loop over `createCombatState`/`advanceCombatTick` (NOT `runCombat`, which drops movement-only ticks and caps at the wrong tick count), capped at the live game's real 3600-tick hard draw. Produces a `FightLog` whose `frames` are one-per-tick, chronological, and pure JSON — no callbacks, no payload objects, no `Map`s.
- `resolveRound(state, roundSeed)` — Fisher-Yates pairs every living seat, records a real fight for any pairing with a human seat, resolves bot-vs-bot abstractly via the existing `resolveBotFight`, settles every seat through `settleRound`, and returns a `RoundResult` whose `SeatFightResult`s agree with the `FightLog`s they reference.
- `src/game/round.test.ts` — 17 tests: the end-to-end tracer (buy → plan → resolve → record), 8 `recordFight` edge cases (ordering, anti-aliasing, verbatim event order, frame-per-tick, JSON round-trip, cap-draw via dummy-vs-dummy, and all three empty-side forfeit branches), 1 log/settlement-agreement test, and 6 `startPlanning` behaviors (pool-safety, elimination-skip, lock-honoured, banking-order, all-eliminated no-op, bots-only lobby).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "one seat buys, plans, and plays a recorded round"** - `489b20c` (feat)
2. **Task 2: Probe-derived edge coverage for recording and planning** - `8c10d46` (test)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge (`.planning/` is gitignored, `commit_docs: false`)._

## Files Created/Modified
- `src/game/round.ts` (447 lines) - the transport-agnostic round module: `seededRng`, `GameAction`/`ActionResult`/`applyAction`, `startPlanning`, `UnitFrame`/`ProjectileFrame`/`FightFrame`/`FightLog`/`recordFight`, `SeatFightResult`/`RoundResult`/`resolveRound`
- `src/game/round.test.ts` (266 lines) - the module's vitest suite, 17 tests across 4 `describe` blocks

## Decisions Made
See `key-decisions` in frontmatter: the seat-2..5-elimination determinism trick used in two tests, the dummy-vs-dummy cap-draw fixture, the two comment rewordings needed to satisfy the literal (comment-inclusive) `onHit`/`onTick`/`damagePayload`/`healPayload` grep gate, and the `void rng` placeholder in `applyAction` pending Plan 02's `reroll` case.

## Deviations from Plan

None — plan executed exactly as written. The full failing-test baseline differs in identity (not count) from the plan's recorded list, which the plan's own Task 2 precondition anticipated and required re-measuring rather than trusting; see the re-measurement note below, which is expected process, not a deviation.

## Issues Encountered

**Baseline re-measurement (Task 2's `<precondition>`).** The plan's `<interface_context>` recorded a baseline of 16 tsc errors / 24 failed / 1154 passed (1178 total) across 9 files including `vikavolt.test.ts`, measured on the developer's dirty working tree. Re-measured on this clean worktree (forked from committed `HEAD` only): `npx tsc --noEmit` matches exactly (16 errors, 0 under `src/main.ts`/`src/econ/`). `npx vitest run` does not match: 23-24 failed / 1122-1123 passed (1146 total, not 1178) across 8-9 files — `vikavolt.test.ts` is not among them here, but `src/econ/{bots,constants,income,xp}.test.ts`, `src/core/systems/{cavecrawler,mystic}.test.ts`, and `src/core/abilities/{abomasnow,ribombee}.test.ts` are, consistent with the environment-mismatch pattern Phase 1 documented (the plan's baseline was measured on a tree carrying unrelated uncommitted WIP that this worktree, forked from committed history, does not have). One test (`src/econ/bots.test.ts`'s unseeded HP-aware-rhythm test) is independently flaky, accounting for a +/-1 swing between runs (23 vs 24 failed) unrelated to this plan. Used 24 as the conservative failed-count ceiling for the after-plan comparison. After this plan's 16 added tests: 23 failed / 1139 passed (1162 total), stable across 3 consecutive runs — failed count did not rise, passed count grew by exactly the tests added, and none of the newly-visible failing files are touched by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full public type contract (`GameAction`, `ActionResult`, `UnitFrame`, `FightFrame`, `FightLog`, `SeatFightResult`, `RoundResult`, and the four exported functions) is in place for Plan 02 to wire the remaining 7 `GameAction` cases (`sell`, `reroll`, `buyXp`, `lock`, `moveBoard`, `moveBench`, `placeItem`) against.
- `resolveRound`'s explicit gap list (eliminated-seat pool returns, Cave Crawler earthquake rewards, bot re-planning, the human-only income deferral `settleHumanRound` performs today, per-seat next-opponent, creep rounds, item rounds, anti-immediate-rematch preference) is documented in-code as a section comment ahead of the function, ready for Plan 04 to fill in as calls/branches inside the existing loop without touching the exported shapes.
- No per-fight replay seed exists anywhere in the module (`grep -cE "seed_?[iI]\b|fightSeed"` → 0) and `src/core/` (including `src/core/rng.ts`) is untouched — both load-bearing for Phase 3's decision to stream recorded logs rather than reseed combat client-side.
- `src/game/round.ts` has zero browser-global references and is fully Node-testable, ready to be called from a future PartyKit room (Phase 3) without modification.

---
*Phase: 02-transport-agnostic-round-engine*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: src/game/round.ts
- FOUND: src/game/round.test.ts
- FOUND: .planning/phases/02-transport-agnostic-round-engine/02-01-SUMMARY.md
- FOUND commit: 489b20c (Task 1)
- FOUND commit: 8c10d46 (Task 2)
