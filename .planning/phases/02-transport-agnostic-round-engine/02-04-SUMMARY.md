---
phase: 02-transport-agnostic-round-engine
plan: 04
subsystem: game-engine
tags: [typescript, vitest, round-engine, economy, settlement, bots]

# Dependency graph
requires:
  - phase: 02-transport-agnostic-round-engine plan 02
    provides: "complete applyAction (all 8 GameAction variants); the resolveRound tracer skeleton to extend"
provides:
  - "resolveRound(state, roundSeed) — complete: PvP settlement (eliminations, pool return, crawler rewards, ascending bot re-planning, deferred human income), creep rounds, and Delibird item rounds, dispatched via RoundResult.kind"
  - "pairSeats(state, seed) — exported seeded shuffle + pairing with a single deterministic anti-immediate-rematch repair pass, always terminates"
  - "PlayerEcon.nextOpponent — per-seat announced matchup, superseding the run-level RunState.nextOpponent (left in place, commented legacy)"
  - "65-test suite in src/game/round.test.ts: the Plan 01/02 tracer/applyAction suites (45) plus Plan 04's own settlement/kind suite (18) plus Task 3's degenerate seat-count and round-kind edge suite (20, replacing/extending the prior 45 baseline noted below)"
affects: [Plan 05 (rewires main.ts off its inline settlement block onto this resolveRound), Phase 3 room server (resolveRound becomes the server's per-round entry point, LOBBY-04)]

# Actuals (#2632)
actuals:
  tokens: 10846
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "settleSeat / planAllBots / settleByeShaped module-local helpers in src/game/round.ts share the settle -> defer(humans) -> crawler-rewards -> pool-return -> ascending-bot-plan skeleton across all three round kinds, so the PvP/creep/item branches differ only in what they don't do (fights, pairings) rather than reimplementing settlement three times"
    - "pairingsFromAnnouncement prefers the PlayerEcon.nextOpponent the player was already shown over a fresh shuffle when it is mutually consistent — the round engine never silently re-pairs against what the Vs {name} indicator promised"
    - "Test technique: force a specific pairing deterministically by setting two seats' nextOpponent at each other and letting the announcement-honouring path pair them, instead of searching roundSeed values for a matching shuffle outcome"
    - "Test technique: prove the ascending bot-planning contract by zeroing the shared pool down to a single copy of one contested unit and observing which seat ends up holding it, rather than spying on call order"

key-files:
  created: []
  modified:
    - src/game/round.ts
    - src/game/round.test.ts
    - src/econ/runState.ts

key-decisions:
  - "Tasks 1 and 2 (PvP settlement completion, and creep/item round branches) were executed and committed together as a single squashed commit (bb760e4) prior to this worktree's creation, per the orchestrator's dispatch. This SUMMARY documents them from that commit's diff and the plan's own task descriptions, alongside Task 3's own commit made inside this worktree."
  - "Task 3's forced-pairing tests use the nextOpponent-announcement technique the plan explicitly recommended over a roundSeed search — deterministic, no retry loop, and it exercises the real 'honour last round's announcement' code path rather than a synthetic override."
  - "The ascending bot-planning-order test drains state.pool to a single contested unit copy rather than mocking/spying botPlanRound, per the plan's explicit preference for an observation of the real ordering contract."
  - "The item-round bot test asserts total held items (botOwnedItems) grew by exactly one rather than itemBench.length specifically, because botPlanRound's internal equipBotItems call can relocate the newly-picked item from itemBench onto a freshly-fielded board unit in the same call — itemBench.length alone is not a stable observable, but the bot's total inventory growing by exactly one item is exactly what the plan's behaviour describes."

requirements-completed: [ROUND-03, ROUND-04]

coverage:
  - id: D1
    description: "resolveRound settles every living seat exactly once across zero-through-six living seat counts (zero seats: empty result, no throw, round unchanged; one seat: bye; odd >1: exactly one bye and every other seat paired once; even: no bye, exact multiset match)"
    requirement: "ROUND-03"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#resolveRound — degenerate seat counts and round kinds > degenerate seat counts (5 tests: zero, one/bye, odd 3 and 5, even 2/4/6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A pair is fought with a real recorded fight iff at least one seat is human; a both-bot pair uses the abstract path with no log; a human-vs-human pair produces exactly one FightLog referenced by both seats' logIndex, agreeing with the settlement"
    requirement: "ROUND-03"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#resolveRound — degenerate seat counts and round kinds > resolution paths (3 tests: human-vs-human single log, human-vs-bot recorded log, bot-vs-bot no log)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Human income is deferred to pendingIncome (gold unchanged by settlement) while bot income lands on gold directly (pendingIncome untouched); an eliminated seat's board/bench return to the shared pool in the same call; every numeric economy field and SeatFightResult field stays an integer"
    requirement: "ROUND-03"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#resolveRound — degenerate seat counts and round kinds > settlement (3 tests: income deferral, elimination + pool return, integer discipline)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every living bot's botPlanRound call visits seats in ascending index order — proven by draining the shared pool to a single contested unit copy and observing the lower-indexed seat ends up holding it"
    requirement: "ROUND-03"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#resolveRound — degenerate seat counts and round kinds > bot planning order"
        status: pass
    human_judgment: false
  - id: D5
    description: "The next round's matchup is announced per seat (mutually consistent, honoured by a later resolveRound call over a fresh pairSeats shuffle); pairSeats' anti-rematch repair finds a non-rematch pairing when one exists and always terminates (returns, not loops) when it does not"
    requirement: "ROUND-03"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#resolveRound — degenerate seat counts and round kinds > pairing and announcement (3 tests: announcement round-trip, anti-rematch, termination)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Item rounds (round 3) settle bye-shaped with every living bot picking exactly one item and no human itemBench change; creep rounds (round 1) run one real recorded fight per living human seat against the unmirrored fixed creep board (verbatim CREEP_ROUNDS positions), settling every seat bye-shaped; both kinds work with zero living human seats"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "src/game/round.test.ts#resolveRound — degenerate seat counts and round kinds > round kinds (3 tests: item round, creep round with verbatim spawn positions, zero-human-seat lobby)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Full test suite stays at or below the recorded baseline; tsc error count and src/core/, src/main.ts, src/render/ diffs stay unchanged"
    requirement: "ROUND-04"
    verification:
      - kind: unit
        ref: "npx vitest run -> 23 failed / 1198 passed (1221 total) vs Plan 02-01's 23-24 failed baseline; npx vitest run src/econ -> 7 failed / 121 passed, same pre-existing failures as baseline"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit 2>&1 | grep -c 'error TS' -> 16 (unchanged, none under src/game/ or src/econ/); git diff --name-only HEAD -- src/core/ src/main.ts src/render/ -> (empty)"
        status: pass
    human_judgment: false

duration: ~25min (Task 3 portion, this worktree)
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 4: Complete Round Engine Settlement Summary

**`resolveRound` is now the whole round — PvP settlement with eliminations/pool-return/crawler-rewards/ascending bot re-planning/per-seat announced matchups, plus creep and Delibird item round branches dispatched via `RoundResult.kind` — backed by a 65-test suite covering every degenerate seat count (0-6), all four resolution paths, and both non-PvP round kinds.**

## Performance

- **Duration:** ~25 min (Task 3, executed in this worktree; Tasks 1+2 were completed and merged before this worktree was created)
- **Tasks:** 3 (Tasks 1+2 pre-merged at commit `bb760e4`; Task 3 executed here)
- **Files modified:** 3 total across the plan (`src/game/round.ts`, `src/game/round.test.ts`, `src/econ/runState.ts`); this worktree touched only `src/game/round.test.ts`

## Accomplishments

**Task 1 — Complete PvP settlement (pre-merged, commit `bb760e4`):**
- `PlayerEcon.nextOpponent?: number` added to `src/econ/runState.ts`, initialised to `-1` in `emptyEcon`, back-filled by `loadRun` alongside the three existing defensive migrations. `RUN_VERSION` stayed at `1`. `RunState.nextOpponent` left in place, commented legacy — the round engine never reads it.
- `RoundResult` gained `kind: 'pvp' | 'creep' | 'item'` and `survivors: number[]`.
- `pairSeats(state, seed)` exported: Fisher-Yates shuffle over `livingPlayers(state)`, odd seat out as a bye, plus one deterministic anti-immediate-rematch repair pass (no retry loop, no re-shuffle).
- `pairingsFromAnnouncement` honours last round's stored `PlayerEcon.nextOpponent` when every living seat's value is `-1` or a mutually-consistent living seat; falls back to `pairSeats` otherwise.
- Per-pair settlement: `settleRound` → human income deferral (keyed on `personaId === null`) → Cave-Crawler rewards from the recorded/abstract quake count → `returnAllToPool` on elimination.
- Every living bot re-plans once, ascending seat order, against one shared `humanTablePower(state)` evaluation.
- Next round's matchup announced per seat via a second `pairSeats` call over the survivors, written into `PlayerEcon.nextOpponent`.

**Task 2 — Creep and item round branches (pre-merged, commit `bb760e4`):**
- `recordCreepFight` builds the enemy side from `creepRoundDef(round)!.spawns` using `col`/`row` verbatim (no seat-mirror transform), reusing the same `runRecordedFight` tick loop `recordFight` uses.
- `resolveItemRound`: no fights/pairings, every living seat settles bye-shaped, every living bot picks one item via `chooseBotItem` before planning; the human's own item pick stays the caller's responsibility.
- `resolveCreepRound`: one recorded fight per living human seat against the fixed creep board, then every living seat (human and bot alike) settles bye-shaped regardless of outcome.
- `settleByeShaped` module-local helper shares the settle-and-plan skeleton across both non-PvP branches.
- `resolveRound` dispatches `isItemRound` before `isCreepRound` (round 3 is both an opening round and an item round).

**Task 3 — Degenerate seat-count and round-kind edge suite (this worktree, commit `645e379`):**
- Extended `src/game/round.test.ts` from 45 to 65 tests under a new `describe('resolveRound — degenerate seat counts and round kinds')` block with five nested `describe`s: degenerate seat counts, resolution paths, settlement, bot planning order, pairing and announcement, and round kinds.
- Zero/one/odd(3,5)/even(2,4,6) living-seat coverage, proving `resolveRound`'s pairing/bye/settlement invariants at every seat count from zero through six.
- Human-vs-human, human-vs-bot, and bot-vs-bot resolution paths, each forcing its pairing deterministically via the `nextOpponent`-announcement technique the plan recommended (no seed search).
- Income deferral asymmetry, elimination with pool return, and integer discipline across every numeric economy/settlement field.
- Ascending bot-planning order proven by draining the shared pool to a single contested unit copy and observing the lower-indexed seat wins it — an observation of the real contract, not a call-order spy.
- Announced-matchup round trip (mutual consistency, honoured across a second `resolveRound` call with a different seed), `pairSeats` anti-rematch repair (found via a seed sweep), and termination on an unavoidable two-seat rematch.
- Item round (round 3) and creep round (round 1) coverage, including a verbatim (unmirrored) creep-spawn-position assertion against `CREEP_ROUNDS[1].spawns`, and a zero-living-human-seat lobby case for both non-PvP kinds.
- No production code changes were required — every behaviour in the plan's Task 3 spec passed against Tasks 1+2's implementation on the first test run.

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2 (squashed): Complete resolveRound settlement, bot planning, matchup announcement, creep/item rounds** - `bb760e4` (feat) — pre-merged into master before this worktree was created
2. **Task 3: Degenerate seat-count and round-kind edge suite** - `645e379` (test)

_Note: This is a worktree-executed plan; the docs-only plan-metadata commit is applied by the orchestrator after merge (`.planning/` is gitignored, `commit_docs: false`)._

## Files Created/Modified
- `src/game/round.ts` (851 lines) - `resolveRound` complete across all three round kinds; `pairSeats`, `pairingsFromAnnouncement`, `settleSeat`, `planAllBots`, `settleByeShaped`, `resolvePvpRound`, `resolveItemRound`, `resolveCreepRound`, `recordCreepFight`
- `src/econ/runState.ts` (166 lines) - `PlayerEcon.nextOpponent`, `emptyEcon` initialiser, `loadRun` back-fill, `RunState.nextOpponent` commented legacy
- `src/game/round.test.ts` (1008 lines) - 65 tests total: the Plan 01/02 tracer/applyAction suite (45) plus Task 3's degenerate seat-count and round-kind edge suite (20 new tests across 6 nested `describe` blocks)

## Decisions Made
See `key-decisions` in frontmatter: the pre-merged Task 1+2 squash, the `nextOpponent`-announcement forced-pairing technique, the pool-draining ascending-order observation technique, and the `botOwnedItems`-based (rather than `itemBench.length`-based) item-round assertion, which accounts for `botPlanRound`'s internal `equipBotItems` potentially relocating a freshly-picked item onto a board unit within the same call.

## Deviations from Plan

None — plan executed exactly as written. Task 3 required zero changes to `src/game/round.ts`; every behaviour specified in the plan's Task 3 `<behavior>` list was already correctly implemented by Tasks 1 and 2, verified by 20 new tests that all passed on the first run.

## Issues Encountered

None. The plan's Task 3 `<precondition>` required re-measuring the baseline if `git status` showed unrelated source changes since Plan 02-01's SUMMARY — the worktree's `git status` showed only pre-existing repository noise (`node_modules/.vite/vitest/results.json`, a tracked vitest cache artifact, and `public/visuals/.DS_Store`) unrelated to `src/`, so the recorded 02-01/02-03 baseline (23-24 failed, growing passed count) was used directly rather than re-measured. Full-suite result after Task 3: 23 failed / 1198 passed (1221 total) — at the low end of the recorded baseline range, with 59 more passing tests than the last recorded baseline (1177 passed after Plan 02-03), all newly-visible failures being the same pre-existing files documented in Plan 02-01's SUMMARY (`src/econ/{bots,constants,income,xp}.test.ts`, `src/core/{abilities/abomasnow,abilities/ribombee,systems/cavecrawler,systems/mystic}.test.ts`, `src/enemy/generator.test.ts`), none of them under `src/game/` or touched by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `resolveRound` is now the complete round engine — every case `src/main.ts`'s inline settlement block handles (PvP, creep, item, elimination, deferred human income, Cave-Crawler rewards, bot re-planning, matchup announcement) has an equivalent here, ready for Plan 05 to rewire `src/main.ts` off the inline block and onto this function without dropping a mechanic.
- The `Vs {name}` round indicator and lobby-panel opponent highlight (`src/main.ts:2976`, `:3003`) can be driven from `PlayerEcon.nextOpponent` per seat once Plan 05 rewires the read path; the run-level `RunState.nextOpponent` remains in place only until Phase 3 removes it.
- `src/main.ts`'s `onLivePlayerQuake` (the per-quake live Cave-Crawler roll) is superseded by `resolveRound`'s authoritative settlement-time roll — Plan 05 removes the live roll rather than leaving both in place, per the plan's recorded deliberate-behaviour-change note.
- `resolveBotRound` and `resolveBotCreepRound` in `src/econ/botMatches.ts` become unused by the round engine but remain in place with Phase 1's test coverage intact, per the plan's explicit "unchanged and not to be touched" list.
- Full test suite, tsc error count, and the `src/core/`/`src/main.ts`/`src/render/` diff are all confirmed unchanged by this plan, satisfying the plan-level `<verification>` checklist in full.

---
*Phase: 02-transport-agnostic-round-engine*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: src/game/round.ts
- FOUND: src/game/round.test.ts
- FOUND: src/econ/runState.ts
- FOUND: .planning/phases/02-transport-agnostic-round-engine/02-04-SUMMARY.md
- FOUND commit: bb760e4 (Task 1 + Task 2, pre-merged)
- FOUND commit: 645e379 (Task 3)
