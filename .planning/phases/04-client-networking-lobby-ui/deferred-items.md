# Deferred Items — Phase 04

Out-of-scope discoveries logged during execution. Not caused by this phase's
changes; not fixed here per the executor scope boundary.

## Pre-existing `npx tsc --noEmit` errors (16), discovered during 04-01

None are in files this plan touches (`src/net/`, `party/`, `scripts/`,
`src/main.ts` are all clean). Present at base commit `081571e`, so
`npm run build` (`tsc && vite build`) is already failing on `master`.

| File | Error |
|------|-------|
| `src/core/abilities/gible.ts:77` | TS2367 — `'dead'` comparison has no overlap with `UnitState` |
| `src/core/abilities/gogoat.test.ts:5` | TS6133 — `TICK_RATE` unused |
| `src/core/abilities/golett.test.ts:107` | TS6133 — `followDmgs` unused |
| `src/core/abilities/golurk.test.ts:109` | TS6133 — `followDmgs` unused |
| `src/core/abilities/mega_golurk.test.ts:106` | TS6133 — `followDmgs` unused |
| `src/core/abilities/torkoal.ts:4` | TS6133 — `applyDamage` unused |
| `src/core/abilities/vikavolt.test.ts:5` | TS6133 — `TICK_RATE` unused |
| `src/core/abilities/weavile.ts:14,81` | TS6133 — `state`, `st` unused |
| `src/core/systems/persistentAoE.ts:41,44,59` | TS2367 — `'both'` / `'dead'` comparisons have no overlap |
| `src/core/systems/skystriker.test.ts:412` | TS6133 — `state` unused |
| `src/core/systems/statusEffect.ts:110` | TS2367 — `'dead'` comparison has no overlap |
| `src/core/systems/traitEffects.test.ts:31` | TS6133 — `ALL_JUNGLE` unused |
| `src/sim/runner.ts:139` | TS6133 — `allAcc` unused |

The three TS2367s are the interesting ones: `UnitState` apparently no longer
carries `'dead'`, so several liveness guards are dead comparisons that always
evaluate false. That is a behavioural bug, not a lint nit, and deserves its own
investigation.

## Pre-existing `npm test` failures (24 tests across 9 files), discovered during 04-01

All in combat-balance and economy-table areas untouched by this phase. None of
these suites import anything under `src/net/`, `party/`, or `scripts/`.

- `src/core/systems/cavecrawler.test.ts` (3)
- `src/core/systems/mystic.test.ts` (8)
- `src/core/abilities/ribombee.test.ts` (2) — expected `baseAmount` 300, got 400
- `src/core/abilities/abomasnow.test.ts` (3)
- `src/econ/bots.test.ts` (1)
- `src/econ/constants.test.ts` (1) — XP table shape
- `src/econ/income.test.ts` (1)
- `src/econ/xp.test.ts` (4) — XP table shape
- `src/enemy/generator.test.ts` (1)

The `constants`/`xp`/`income` cluster looks like one root cause (an XP table
edit whose tests were not updated). The ability failures look like separate
balance-number drift.

## Parallel-execution hazard: fixed room port 1999

`scripts/roomHarness.ts` defaults `ROOM_PORT` to 1999. Two GSD agents running
in parallel worktrees both spawn `partykit dev` on that port, and the second
one's healthcheck can answer from the FIRST one's server — which then dies
mid-run, producing `nextMessage timed out ... Messages seen: []`. Observed once
during 04-01 while 04-00 ran concurrently; re-running with `ROOM_PORT=2077`
passed immediately.

Not fixed here because `scripts/roomHarness.ts` is shared surface and 04-00 is
editing adjacent files. Candidate fix: default `ROOM_PORT` to an
ephemeral/derived port instead of a constant.
