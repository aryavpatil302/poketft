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

**Re-confirmed during 04-03** at base commit `081571e`: 16 tsc errors (identical
list) and **23** failing tests across **8** files. `src/enemy/generator.test.ts`'s
single failure did NOT reproduce — that suite is either flaky or was fixed
between 04-01 and here. Everything else is unchanged. Nothing in the repo
imports `src/main.ts` (`grep -rn "from '.*main'" src/ scripts/ e2e/` returns
nothing), so no plan in this phase can affect these counts either way.

## `dist/` is tracked in git, so `npm run build` dirties the working tree

Noticed during 04-03. `dist/index.html`, `dist/assets/*.js` and the copied
`dist/visuals/**` are all tracked, so running `npm run build` (or `npx vite
build`) to satisfy a plan's acceptance criteria leaves a modified `dist/` plus
untracked new hashed bundles that must be reverted before committing. It is
easy to sweep build output into a source commit by accident.

Not fixed here (adding `dist/` to `.gitignore` and `git rm -r --cached dist`
is a repo-wide decision, not this plan's). Until then: after any build run,
`git checkout -- dist` and delete the new untracked `dist/assets/index-*.js`
before staging.

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

Did NOT reproduce during 04-02: `npm run net:client` passed on the default
port 1999 across all 9 scenarios in a single run.

## Missing asset: `public/visuals/gui icons/Logo.png`, discovered during 04-02

`04-UI-SPEC.md` §Screens 1 names `public/visuals/gui icons/Logo.png` as the
logo for both new screens. **That file does not exist anywhere in the repo** —
`find . -iname "*logo*"` (excluding `node_modules`) returns nothing, and the
whole of `public/visuals/gui icons/` is three files: `oran_berry.webp`,
`pokeball_owned.png`, `star-up.png`.

Not fixed here: generating logo art is explicitly out of scope
(`04-UI-SPEC.md` §Explicitly Out of Scope — "do not spend time generating new
art assets"). `src/ui/screenChrome.ts` keeps the `img` pointing at the spec'd
path and swaps in a CSS-styled `PokeTFT` wordmark (same yellow-on-blue-outline
treatment as the `Isle Of Imagination` subtitle) when the request 404s, so
dropping the real file into `public/visuals/gui icons/Logo.png` is the entire
fix with no code change.

**Action for the project owner:** add `Logo.png` to `public/visuals/gui icons/`.
Until then both screens render the wordmark fallback rather than the mockup's
logo.

## `04-UI-SPEC.md`'s example guest names collide with the bot name pool

The spec suggests `"Blue", "Red", "Green", ...` as the guest-name pool. All
three (plus `Leaf` and `Silver`) are already in `src/econ/botNames.ts`'s
`HUMAN_CHARACTER_NAMES` as Kanto rival/trainer names, so using them would
violate the same spec's requirement that a guest name be "distinct from the
bot persona name pool". `src/net/guestNames.ts` therefore uses colour words no
bot answers to (Amber, Teal, Coral, Indigo, Violet, Crimson, Cobalt, Jade,
Magenta, Saffron, Cyan, Olive). Recorded here so the divergence from the
spec's literal example list is not read as an oversight.

## Ascender pillars can be swapped onto the bench, discovered during 04-04

**Pre-existing, unchanged by 04-04 — recorded because reading the swap paths
closely is what surfaced it.**

Ascender pillars (`cliff_l` / `cliff_r`) are auto-spawned board entries that
`reconcileAscenderPillars()` owns and that the player is never meant to bench.
Both the direct bench-drop path and the sell path guard against them
(`isCliffId` in the bench-cell handler; `isPillar` in `applyAction`'s `sell`
and `moveBoard`-to-bench branches). But dragging a BENCH unit onto the hex a
pillar is standing on is a *swap*, and neither the old
`placeDisplacedUnitAtOrigin` nor `applyAction`'s `moveBench` swap branch checks
`isPillar` on the DISPLACED entry — so the pillar lands in the bench slot the
dragged unit vacated. `reconcileAscenderPillars()` then sees no pillar on the
board and spawns a fresh one, leaving a stray duplicate on the bench.

Reproduces identically before and after 04-04 (the behaviour is byte-for-byte
the same swap, just expressed as a `moveBench` action instead of a local
mutation), so it is not a regression and not this plan's to fix. The fix is a
one-line `isPillar` guard on the displaced entry inside `applyAction`'s
`moveBench` swap branch in `src/game/round.ts` — engine surface, which 04-04
does not touch.

## Client board-cap check counts pillars, `applyAction` does not

Also noticed during 04-04, also pre-existing. `playerBoardUnitCount()` counts
every non-dummy player unit in `placedUnits`, pillars included, while
`applyAction`'s `fieldedCount()` deliberately excludes them. So a player with
an active Ascender trait sitting one unit below their level cap can see the
client's advisory rejection flash for a placement the engine would have
allowed.

04-04 left the client check exactly as it found it (it is now explicitly
advisory, with `applyAction` as the authority), so the discrepancy is
unchanged rather than introduced. The fix is to make the advisory count
skip `isCliffId` entries — but that also changes the `n/level` board
watermark, which is a gameplay-readability decision rather than a bug fix.

## Re-confirmed during 04-05

Base commit `081571e`, worktree `worktree-agent-a1cdfb5d18c88517b`:

- **16 pre-existing `tsc --noEmit` errors** — identical list to 04-01/04-03.
  Verified pre-existing by reading the offending lines out of `git show
  HEAD:<file>` rather than assuming. `src/main.ts` and `scripts/netClient.ts`
  are both clean (`npx tsc --noEmit 2>&1 | grep -E "src/main.ts|scripts/netClient.ts"`
  returns nothing), so this plan neither added nor removed any.
- **23 failing tests across 8 files** — identical to 04-03's re-confirmation.
  `git diff --name-only master...HEAD` shows this plan touched only
  `src/main.ts` and `scripts/netClient.ts`, neither of which any failing suite
  imports.
- **`dist/` was NOT dirtied by this plan.** `npm run build` is `tsc && vite
  build`, and `tsc` exits non-zero on the pre-existing errors above, so
  `vite build` never runs and no bundle output is emitted. `git status
  --short` was empty after the build attempt. No `git checkout -- dist` was
  needed.
- **`node_modules/.vite/vitest/results.json` is tracked** and is rewritten by
  every `npx vitest run`. Same hazard class as the tracked `dist/`: it must be
  reverted (`git checkout -- node_modules/.vite/vitest/results.json`) before
  staging, or a vitest cache blob rides along in a source commit. Worth adding
  to the same `.gitignore` decision as `dist/`.
- **Room port 1999 hazard did not reproduce.** `npm run net:client` passed all
  13 scenarios on the default port in a single run.

## `scripts/roomRound.ts` can fail to force a 0-vs-1 pairing (flaky), found in 04-06

`npm run room:round` failed once with `ASSERTION FAILED: a 0-vs-1 pairing was
forced within 20 rounds (took 20 rounds)` and passed on an immediate re-run
with no code change in between. Matchmaking is random (`pairSeats`), and the
script's loop caps at `MAX_ROUNDS = 20`; with six seats, some of which get
eliminated mid-run, 20 rounds is not a guaranteed window. `scripts/roomRound.ts`
is Phase 3 surface and untouched by any Phase 4 plan (`git diff --name-only
master...HEAD` for 04-06 lists only `src/main.ts` and `scripts/netClient.ts`),
so this is a pre-existing property of the script, not a regression.

The same pairing-forcing loop was copied into `netClient.ts`'s scenario 14
(also `MAX_ROUNDS = 20`), so it inherits the same flakiness. Candidate fix for
both: raise the cap, or force the pairing deterministically instead of polling
`nextOpponent` — but `pairSeats` currently offers no seat-pinning hook, which
makes that an engine change rather than a script change.

## `npm run build` cannot verify the bundle, so 04-06 built to a throwaway outDir

`npm run build` is `tsc && vite build`, and `tsc` exits non-zero on the 16
pre-existing errors above — so `vite build` never runs and the bundle is never
actually exercised. That is fine for keeping `dist/` clean, but it also means
no plan in this phase has proven its new imports resolve in a real bundle.

04-06 added three new module imports to `src/main.ts` (`fightBuffer`,
`fightWire`, `playbackPerspective`) and checked them with
`npx vite build --outDir dist-check --emptyOutDir`, then deleted `dist-check/`.
That worked (418 modules transformed, clean) but it is a manual dance. Rolling
it into a `npm run build:check` script would make bundle verification routine
without touching the tracked `dist/`.
