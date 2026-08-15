# ML Generation Calibration — Notes & Roadmap

Status: **live** (implemented 2026-07). The enemy generator and the pre-combat
delta are calibrated online from real user-vs-generated battle outcomes.

## Why this exists

The power model (`2^(cost−1)·3^(tier−1)` + 15%/trait-level) is a stack of
hand-tuned guesses. It regularly said "enemy weaker −8%" while the enemy
stomped, because the constants were never validated against real fights, items
and player skill weren't modeled, and every combat result was discarded after
display. Now every battle is recorded and the model refits after each one.

## Architecture

```
combat start (main.ts)
  ├─ loadCalibration() → generateEnemyTeam(playerUnits, calib)
  ├─ predictWinProb(pf, ef, calib) → "Win chance 58% (enemy −8%)" display
  └─ pendingBattle = { features, prediction, starting unit ids }

combat end (main.ts, before the 5s restore timer)
  ├─ y = win/loss/draw, margin = winner's mean surviving-HP fraction
  ├─ appendBattle(record)            → src/enemy/battleLog.ts (ring buffer, 300)
  └─ recordAndLearn(records)         → src/enemy/calibration.ts (full refit)
```

### The model

`P(playerWin) = sigmoid(k·d + b)` where
`d = [Δ basePower + w.trait·Δ traitRaw + w.tier3·Δ tier3Power + w.cost3·Δ cost3Count²] / S`

- **k** — how much a power gap actually matters (prior 5 ≈ "+10% power → 62%").
- **b** — absorbs consistent player skill (positioning, items) so unit-value
  weights don't get corrupted by "the player is just good".
- **w** — learned corrections to the hand-tuned constants (priors: trait 0.15,
  tier3 0.30, cost3 1.0). These same weights feed back into the generator's
  power accounting (`calibratedPower` in `src/enemy/boardPower.ts`).

### The learner: batch MAP refit, not SGD

After every battle the model refits from the **entire** battle log (≤300
records, ~1500 GD epochs, sub-100ms). This was a deliberate change from the
original single-pass-SGD plan: prototyping showed SGD could not extract the
signal from ≤300 samples (k never traveled from 5 to a true value of 2), while
batch refit recovers ground-truth parameters, is deterministic (same log in →
same params out), and cannot oscillate.

### Anti-overshoot / anti-bias safeguards (all in `src/enemy/calibration.ts`)

1. Parameters start at the hand-tuned priors.
2. L2 pull toward priors with strength `λ = 15/(15+n)` — 5 battles: prior
   dominates; 300 battles: data dominates. k and w use λ² (weakly identified
   early), b uses λ (well identified, but must not swing on 3 games).
3. Hard clamps: k∈[1,10], b∈[−1.25,1.25], w.trait∈[0.05,0.35],
   w.tier3∈[0,0.60], w.cost3∈[0,3].
4. Stage 2 (feature weights) frozen until **30 recorded battles**.
5. Records with empty boards or prior-weight |d| > 1.5 (≈7:1 power ratio) are
   ignored as outliers.
6. Margin-weighted loss: sample weight `0.5 + 0.5·margin` — stomps teach more
   than coin-flip finishes; draws count as y=0.5 at half weight.
7. Versioned storage; on corruption/version bump the params reset to priors
   and are re-derived by replaying the log (`refitFromLog`).

### Generation targeting

`generateEnemyTeam(playerUnits, calib?)` keeps the legacy 70/30 variety bands
(±10% tight / up to ±25% wide) but centers them on the **calibrated even
point**: `P_even = calibratedPower(player, w) + S·b/k`. A player who
over-performs their board power gets matched against stronger boards at
"even". `clampToTarget` now clamps toward the rolled target (so intentionally
hard fights are genuinely hard) using the learned weights. Omitting `calib`
reproduces exact legacy behavior.

## Storage & operations

| What | Where | Size cap |
|---|---|---|
| Battle records | `localStorage["pokeTFT_battles_v1"]` | 300 records ≈ 57 KB |
| Learned params | `localStorage["pokeTFT_calib_v1"]` | ~0.5 KB |

Debug (browser console):
- `window.__pokeTFT.getCalibration()` — params + rolling 30-battle Brier score
- `window.__pokeTFT.getBattleLog()` — raw records
- `window.__pokeTFT.resetCalibration()` — back to priors
- Every combat end logs `[calib] {n, k, b, w, brier30, predicted, outcome}`.
  Brier 0.25 = coin-flip guessing; trending below it = the learner is working.

### Offline prior fitting (no user-data bias)

```
npx tsx src/sim/calibrate.ts --boards 200 --trials 100
```
Random boards → generated enemies → headless sims → fitted constants, printed
as **suggestions only** (never auto-applied). An early 40-board run already
suggested traits are undervalued (~0.31 vs 0.15) and cost-3 stacking is
overvalued (~0.26 vs 1.0). Run the full 200×100 before adopting anything; to
adopt, edit `PRIOR_K` (calibration.ts) / `PRIOR_WEIGHTS` (boardPower.ts) and
reset in-game calibration.

### Tests

`src/enemy/{battleLog,calibration,generator}.test.ts` — 30 tests including
synthetic-ground-truth convergence (recovers k=2,b=0.5 from 300 battles),
no-drift-when-prior-is-correct, clamp enforcement under adversarial data, and
held-out Brier improvement over the uncalibrated model.

## Roadmap

### Next: comp-archetype segmentation (NOT yet implemented)

Goal: the learner should know *what kind of board* is winning — "attack-carry
2-cost reroll" vs "level-9 all-legendaries" — not just its total power. The
same +10% power gap plays very differently for a 3★-cost-2 hyper-roll board
than for a tier-1 five-cost board.

Design sketch when we pick this up:
1. **Archetype features, not archetype buckets.** Add continuous features to
   `BoardFeat` rather than hard-classified archetypes (buckets fragment ≤300
   samples into useless shards): e.g. `avgCost`, `star3Share` (power share from
   3★ units), `fiveCostShare`, `carryPowerShare` (top-unit power / total),
   `tankRatio`. The logistic model extends naturally with one weight per
   feature, same priors-and-clamps treatment (prior weight 0 = "no effect
   until proven").
2. **Interaction term for the delta**: let `k` vary with archetype —
   `k_eff = k + k_reroll·star3Share + k_legendary·fiveCostShare` — so the model
   can learn "power gaps matter less against reroll boards" without buckets.
3. **Data implications**: archetype features fatten each record slightly
   (still fine in localStorage), but useful archetype learning wants
   1000+ battles and per-unit telemetry (which unit carried, kill logs like
   `sim/runner.ts` already produces). That is the agreed threshold for moving
   the battle log to **IndexedDB** (not SQL/WASM-SQLite — measured verdict:
   the current dataset is 57 KB and append-only/read-all, a database adds cost
   with zero benefit at this scale).
4. **Validation first**: extend `src/sim/calibrate.ts` to generate archetyped
   random boards (reroll-style, legendary-style) and verify the archetype
   weights are recoverable from sim ground truth before trusting them online.

### Also possible later

- Adopt sim-fitted priors after a full 200×100 calibrate run.
- Item power modeling (items are currently invisible to the power score).
- Per-session skill drift: decay `b` toward 0 over long idle periods.
