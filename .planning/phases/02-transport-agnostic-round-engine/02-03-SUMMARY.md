---
phase: 02-transport-agnostic-round-engine
plan: 03
subsystem: game-engine
tags: [typescript, vitest, playback, replay, round-engine]

# Dependency graph
requires:
  - phase: 02-transport-agnostic-round-engine plan 01
    provides: "UnitFrame / ProjectileFrame / FightFrame / FightLog types; recordFight(state, seatA, seatB, stage)"
provides:
  - "createPlaybackState(log) — builds an empty, drawable CombatState literal without registering ability/item/trait passives"
  - "applyFrame(state, frame) — reconciles units/projectiles/hexOccupancy from a FightFrame; create-on-first-sight, delete-on-absence; idempotent per frame"
  - "playbackLength(log) / playbackWinner(log) — pure log readers, the latter never re-derives an outcome"
affects: [Plan 05 (rewires main.ts to consume playback instead of live combat for recorded fights), Phase 3 room server (frames arriving over the wire reach applyFrame unchanged), Phase 4 client playback]

# Actuals (#2632)
actuals:
  tokens: 4226
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createPlaybackState builds the CombatState literal directly instead of calling createCombatState — the latter runs initAbilityPassives/initItemPassives/initTraitEffects, which register live combat behaviour that a pure replay must never execute"
    - "applyFrame reconciles the unit set from each frame's contents rather than assuming it fixed across frames — summons/spawns that arrive or expire mid-fight are handled by diffing frame.units against state.units on every call"
    - "Reconstructed Projectile objects carry speed: 0 and leave onHit/onTick/damagePayload/healPayload undefined — a replayed projectile is positioned, never simulated"

key-files:
  created:
    - src/game/playback.ts
    - src/game/playback.test.ts
  modified: []

key-decisions:
  - "Used a hand-built synthetic two-frame FightLog for the mid-fight arrival/departure reconciliation tests rather than searching for a natural summon fixture in UNIT_MAP — those two behaviors are about applyFrame's bookkeeping, not about capture, and the plan explicitly sanctioned this fallback with a note to record it here."
  - "zubat (range 4, already used as the ranged fixture in round.test.ts) was reused as the projectile-bearing unit for the projectile reconstruction test, avoiding introduction of a new fixture species."
  - "unitSnapshot() compares only { id, currentHp, hexPos, state } rather than whole Unit objects, per the plan's explicit guidance — comparing full objects would drag in every field makeUnit initializes and make failures unreadable."

requirements-completed: [ROUND-04]

coverage:
  - id: D1
    description: "src/game/playback.ts exports exactly createPlaybackState, applyFrame, playbackLength, playbackWinner; is Node-clean (no browser globals, no render/ui imports); and calls no combat system or advanceCombatTick"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "grep -c 'export function' src/game/playback.ts == 4"
        status: pass
      - kind: unit
        ref: "grep -vE '^\\s*(//|\\*|/\\*)' src/game/playback.ts | grep -cE 'document\\.|window\\.|localStorage|requestAnimationFrame|render/|ui/' == 0"
        status: pass
      - kind: unit
        ref: "grep -vE '^\\s*(//|\\*)' src/game/playback.ts | grep -cE 'advanceCombatTick|createCombatState|core/systems/' == 0"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit 2>&1 | grep -E '^src/game/' → (empty)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Replaying a real recordFight log through applyFrame reproduces the final frame's exact unit state, and the only team with non-dead units matches log.winner for a non-draw fight"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "src/game/playback.test.ts#replay fidelity (3 tests: exact final-frame reproduction, winner agreement, playbackWinner verbatim)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Units that arrive or leave mid-fight are reconciled correctly; applyFrame is idempotent per frame"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "src/game/playback.test.ts#applyFrame — reconciliation (4 tests: create-on-first-sight, mid-fight arrival, mid-fight departure, idempotency)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A log that has survived JSON.stringify replays identically to the in-memory original"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "src/game/playback.test.ts#wire survival — JSON.parse(JSON.stringify(log)) replay matches original"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full test suite stays within the documented baseline; tsc error count unchanged; no src/main.ts, src/core/, or src/render/ diff"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "npx vitest run → 24 failed / 1177 passed (1201 total); the +1 failed vs Plan 02-01's 23-baseline is the same pre-existing flaky src/econ/bots.test.ts test documented in Plan 02-01's SUMMARY, not a regression from this plan"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit 2>&1 | grep -c 'error TS' → 16 (unchanged); git diff --name-only HEAD -- src/main.ts src/core/ src/render/ → (empty)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 3: Playback Reconstruction Module Summary

**`src/game/playback.ts` — a Node-clean, DOM-free module exporting `createPlaybackState`/`applyFrame`/`playbackLength`/`playbackWinner` — replays a recorded `FightLog` frame by frame into a drawable `CombatState`, reconciling arriving/leaving units and projectiles from each frame without ever calling a combat system or re-deriving the winner, with an 11-test vitest suite proving exact replay fidelity, reconciliation, idempotency, and JSON-wire survival.**

## Performance

- **Duration:** ~20 min active work
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `createPlaybackState(log)` builds the same empty `CombatState` literal `createCombatState` builds, but skips its three passive-registration calls (`initAbilityPassives`, `initItemPassives`, `initTraitEffects`) entirely — a replay must register no live combat behaviour, since every value it shows is already recorded.
- `applyFrame(state, frame)` reconciles `state.units` from `frame.units` on every call (create-on-first-sight via `makeUnit` + forced id, delete-on-absence), rebuilds `state.hexOccupancy` from scratch each frame, replaces `state.projectiles` wholesale with `speed: 0` reconstructions that leave all four callback/payload fields undefined, and copies `events`/`terrain`/`tailwind`/`tick` straight from the frame.
- `playbackLength(log)` / `playbackWinner(log)` are pure log readers — `playbackWinner` returns `log.winner` verbatim, with an in-code comment tying that choice to the client-side re-simulation this project explicitly cut (REQUIREMENTS.md COMBAT-02).
- `src/game/playback.test.ts` — 11 tests across 5 `describe` blocks: reconstruction (populated log, empty forfeit log), reconciliation (create-on-first-sight, mid-fight arrival, mid-fight departure, per-frame idempotency), replay fidelity (exact final-frame reproduction from a real `recordFight` log, winner agreement, `playbackWinner` verbatim, projectile reconstruction), and wire survival (`JSON.parse(JSON.stringify(log))` replays identically).

## Task Commits

Each task was committed atomically:

1. **Task 1: The playback reconstruction module** - `a588abd` (feat)
2. **Task 2: Replay-fidelity and wire-survival suite** - `42e6441` (test)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge._

## Files Created/Modified
- `src/game/playback.ts` (130 lines) - `createPlaybackState`, `applyFrame`, `playbackLength`, `playbackWinner`
- `src/game/playback.test.ts` (271 lines) - the module's vitest suite, 11 tests across 5 `describe` blocks

## Decisions Made
See `key-decisions` in frontmatter: the synthetic two-frame `FightLog` fixture used for arrival/departure reconciliation tests, reuse of `zubat` as the projectile-bearing fixture, and the narrow `unitSnapshot()` comparison shape.

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None. The full-suite failed count (24) is one higher than Plan 02-01's recorded 23-failed baseline; this matches the exact ±1 flaky-test swing Plan 02-01's SUMMARY already documented (`src/econ/bots.test.ts`'s unseeded HP-aware-rhythm test), not a regression introduced by this plan — confirmed by `git diff --name-only HEAD -- src/main.ts src/core/ src/render/` printing nothing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full playback contract (`createPlaybackState`, `applyFrame`, `playbackLength`, `playbackWinner`) is in place for Plan 05 to wire `main.ts`'s render loop to consume a recorded `FightLog` instead of live combat state for recorded fights.
- No re-simulation anywhere in the module (`grep -cE "advanceCombatTick|createCombatState|core/systems/"` on code lines → `0`), which is load-bearing for Phase 3's/4's decision to stream recorded logs rather than reseed combat client-side.
- `src/game/playback.ts` has zero browser-global references and is fully Node-testable, ready to be called from a future PartyKit room or client without modification.

---
*Phase: 02-transport-agnostic-round-engine*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: src/game/playback.ts
- FOUND: src/game/playback.test.ts
- FOUND commit: a588abd (Task 1)
- FOUND commit: 42e6441 (Task 2)
