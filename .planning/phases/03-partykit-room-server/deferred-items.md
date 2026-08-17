# Deferred Items — Phase 3

Out-of-scope discoveries logged per the executor's scope boundary (only auto-fix issues directly
caused by the current task's changes; pre-existing failures in unrelated files are logged, not fixed).

## 03-01: Pre-existing XP/economy test failures (not caused by this plan)

Discovered while running `npx vitest run src/game src/econ` as this plan's phase-level regression
check. 7 tests fail across 4 files, none touched by this plan (last modified at commit `081571e`,
well before this worktree's base commit `898b2ac`):

- `src/econ/bots.test.ts` > `HP-aware rhythm: banked-past-threshold greed spikes; low HP forces desperation spending`
- `src/econ/constants.test.ts` > `XP table covers L1→2 through L9→10`
- `src/econ/income.test.ts` > `grants 2 passive xp and reports level-ups`
- `src/econ/xp.test.ts` > `xpToNext follows the table and is null at cap`
- `src/econ/xp.test.ts` > `grantXp levels up with overflow carrying over`
- `src/econ/xp.test.ts` > `grantXp can jump multiple levels from one large grant`
- `src/econ/xp.test.ts` > `buyXp charges gold and grants 4 xp`

All failures are `XP_TO_NEXT`/leveling-table mismatches unrelated to Phase 3's transport work. The
main repo's working tree (outside this worktree) shows uncommitted local edits to
`src/econ/bots.ts`/`bots.test.ts`/`constants.ts`/`constants.test.ts` at session start, suggesting a
fix for this is already in progress on a separate, unmerged workstream. Not fixed here — outside
this plan's file scope (`src/net/protocol.ts`, `party/lobby.ts`, `scripts/roomHarness.ts`,
`scripts/roomSmoke.ts`) and outside Phase 3's engine-untouched invariant.
