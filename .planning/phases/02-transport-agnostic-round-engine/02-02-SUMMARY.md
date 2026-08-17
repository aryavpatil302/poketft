---
phase: 02-transport-agnostic-round-engine
plan: 02
subsystem: game-engine
tags: [typescript, vitest, applyAction, economy, seat-isolation]

# Dependency graph
requires:
  - phase: 02-transport-agnostic-round-engine plan 01
    provides: "GameAction union, ActionReason, applyAction tracer (buy case + guards), seededRng, startPlanning, recordFight, resolveRound"
provides:
  - "applyAction(state, seat, action, rng) — all 8 GameAction variants implemented as pure, validate-before-mutate transitions"
  - "isPillar/fieldedCount/isPlayerHex — module-local helpers reproducing src/main.ts's cliff-pillar and board-cap rules in pure form"
  - "45-test suite proving atomicity (whole-state deep-equal on every rejection), seat isolation, and shared-pool conservation under interleaved two-seat play"
affects: [02-04 (completes resolveRound using this applyAction), 02-05 (rewires main.ts to dispatch through this), Phase 3 room server (applyAction is the function a network payload reaches first)]

# Actuals (#2632)
actuals:
  tokens: 6522
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Validate-fully-before-any-write per action case — the atomicity contract Phase 3's room server relies on to prevent partial state corruption from a late-rejected action"
    - "seat parameter is the sole authority for which PlayerEcon is touched — no case resolves state from anything but state.players[seat]"

key-files:
  created: []
  modified:
    - src/game/round.ts
    - src/game/round.test.ts

key-decisions:
  - "'not-implemented' stays in the ActionReason union type (1 occurrence remains, in the type declaration) per Plan 02-01's interface_context explicitly saying 'removes nothing' — no switch branch returns it anymore, only the type still lists it as a theoretically valid reason. The plan's own acceptance criteria literally says grep count should be 0, but that reading conflicts with the plan's own interface_context instruction to remove nothing from the union; the functional intent (no code path returns it) is satisfied and verified separately via the 8-case-label positive check."

requirements-completed: [ROUND-01]

coverage:
  - id: D1
    description: "All eight GameAction variants (buy, sell, reroll, buyXp, lock, moveBoard, moveBench, placeItem) are implemented in applyAction; no variant returns not-implemented"
    requirement: "ROUND-01"
    verification:
      - kind: unit
        ref: "grep -cE \"case 'buy'|case 'sell'|case 'reroll'|case 'buyXp'|case 'lock'|case 'moveBoard'|case 'moveBench'|case 'placeItem'\" src/game/round.ts == 8"
        status: pass
    human_judgment: false
  - id: D2
    description: "applyAction validates fully before it mutates — a structural deep copy taken before a rejected call deep-equals the state after it, for every enumerated degenerate input (bad seat, eliminated seat, empty slots, unaffordable actions, pool exhaustion, pillar sell, out-of-bounds indices, off-player-half hex, cap-exceeding placement)"
    requirement: "ROUND-01"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#applyAction atomicity — expectRejected helper snapshots before/after every rejection case"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shared pool is conserved under an interleaved two-seat buy/sell sequence (seat 0 and seat 3 both human) — pool[id] + heldCopies across both seats' benches/boards is invariant after every single action, not just at the end"
    requirement: "ROUND-01"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#pool conservation — heldCopies helper asserted inside the interleave loop (5 references)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An action on one seat never touches another seat's economy — board/bench move, sell, buy, item-place semantics (true swap, board-cap excludes pillars, pillars unsellable, one item per unit) are preserved in pure form from src/main.ts's cursor-drag handlers"
    requirement: "ROUND-01"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#seat isolation — snapshot of the untouched seat unchanged after any successful action on the other"
        status: pass
      - kind: unit
        ref: "src/game/round.test.ts#move/item semantics — board.length invariant on occupied-hex swap, board-full at cap, pillar cap-exempt, itemBench.length invariant on item replacement"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 2: Complete applyAction Summary

**All eight `GameAction` variants are real, validate-before-mutate transitions over `PlayerEcon`/`state.pool`; a 45-test suite (up from 17) proves atomicity on every rejection path, seat isolation, and shared-pool conservation under interleaved two-seat play — with zero regressions against Plan 02-01's re-measured baseline.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-17T13:49:00Z
- **Completed:** 2026-08-17T14:01:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `reroll`, `buyXp`, `lock`, `sell` (bench/board), `moveBoard`, `moveBench` (bench-swap and hex-destination), and `placeItem` are all implemented, replacing every `not-implemented` switch branch.
- Three module-local helpers (`isPillar`, `fieldedCount`, `isPlayerHex`) reproduce `src/main.ts`'s cliff-pillar exemption and board-cap rules without importing `src/main.ts` or touching any browser global.
- `ActionReason` gained `'unsellable'` for the Ascender-pillar sell rejection — a case that had no honest fit among the existing reasons.
- Board/bench moves preserve the true-swap semantics (`moveBoard` onto an occupied hex exchanges `hexPos`, never bench-displaces) and the board-cap-excludes-pillars rule exactly as the cursor-drag handlers did.
- `src/game/round.test.ts` grew from 17 to 45 tests: atomicity (whole-state deep-equal snapshot on every rejection case, via a shared `expectRejected` helper), seat isolation, pool conservation checked inside the interleave loop (not just at the end), and move/item semantics.
- Zero non-test source reaches into `src/core/` or `src/main.ts` from this plan's changes — confirmed via `git diff --name-only` against the two paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the remaining seven action variants** - `8dc2668` (feat)
2. **Task 2: Seat isolation, atomicity, and pool conservation suite** - `25610c7` (test)
3. **Task 2 (continued): This SUMMARY.md** - completed by the orchestrator after the executor agent's connection was interrupted mid-response, right before writing the summary

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge (`.planning/` is gitignored, `commit_docs: false`)._

## Files Created/Modified
- `src/game/round.ts` - all 8 `GameAction` cases implemented; `'unsellable'` added to `ActionReason`; `isPillar`/`fieldedCount`/`isPlayerHex` helpers added
- `src/game/round.test.ts` - 28 new tests covering atomicity, seat isolation, pool conservation, move semantics, item semantics

## Decisions Made
- See `key-decisions` in frontmatter for the `'not-implemented'`-stays-in-the-type-union reasoning.
- `placeItem`'s splice-after-both-lookups-succeed ordering (called out as the easiest atomicity mistake in the plan) was implemented exactly as specified — verified by the atomicity test for that case.

## Deviations from Plan
None beyond the `'not-implemented'` union-member clarification above, which is a documentation-precision note, not a functional gap.

## Issues Encountered
The executor agent's connection was interrupted ("Connection closed mid-response") after both task commits landed but before it could write SUMMARY.md. The orchestrator resumed directly, independently re-verified every acceptance criterion against the worktree, and completed the SUMMARY.

## User Setup Required
None.

## Next Phase Readiness
- `applyAction` is now the complete mutation surface ROUND-01 describes. Plan 02-04 (completing `resolveRound`) and Plan 02-05 (rewiring `main.ts`) can both build on it without further changes to this function.
- The two `flagged-unverified` prohibitions recorded in the plan (seat-scoping authority, no-partial-application-on-reject) are exactly the properties Phase 3's room server will depend on when a network payload starts reaching this function directly — nothing further needed here, just inherited by that phase.

---
*Phase: 02-transport-agnostic-round-engine*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: src/game/round.ts
- FOUND: src/game/round.test.ts
- FOUND: .planning/phases/02-transport-agnostic-round-engine/02-02-SUMMARY.md
- FOUND commit: 8dc2668 (Task 1)
- FOUND commit: 25610c7 (Task 2)
