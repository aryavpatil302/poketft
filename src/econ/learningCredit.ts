// Shared credit model for every composition-learning phase (Phase B's
// free-discovery bandit, Phase C's catalog bandit).
//
// THE PROBLEM THIS SOLVES. The naive signal — "this board won the fight, so
// +1 to every trait pair / every unit on it" — measures the wrong thing three
// times over:
//
//   1. CONFOUNDING WITH BOARD STRENGTH. A win is mostly explained by having a
//      stronger board, not by the comp SHAPE. Cheap opener units (Snorunt,
//      Tangela) are still around at stage 5 only on boards that never
//      upgraded, so their traits get blamed for weakness they merely
//      accompany. Fix: score the outcome against what the board's POWER
//      already predicted (expectedWinCredit) — an upset win is strong
//      evidence, a win the board was always going to get is nearly none.
//   2. FLAT CREDIT ACROSS UNITS. A 4,200-damage carry and the 180-damage
//      filler beside it got identical credit. Fix: contributionShares splits
//      the evidence by what each unit actually did.
//   3. CORRELATED FIGHTS COUNTED AS INDEPENDENT. One game emits ~20 fights
//      off nearly the same board, so a Beta posterior treating them as 20
//      independent trials ends up far more confident than the data warrants
//      and stops exploring early. Fix: GameCreditBuffer collapses a whole
//      game into ONE observation per key.
//
// Everything here is pure and headless — no localStorage, no DOM — so the
// training CLIs can use it directly.

import { calcBoardProfile, calibratedPower } from '../enemy/boardPower'
import { makeUnit } from '../core/unitFactory'
import type { Affinity } from './itemAffinity'
import { updateAffinityWeighted } from './itemAffinity'

interface BoardEntry { definitionId: string; tier: 1 | 2 | 3; hexPos?: { col: number; row: number }; item?: string }

// ─── 1. Expectation-relative credit ─────────────────────────────────────────

// Logistic win probability for board A vs board B from calibrated power alone.
// Deliberately uses power only (not the full trained calibration model, which
// lives behind localStorage and would drag UI state into training): the point
// is to divide out the "stronger board wins" effect, and calibrated power is
// exactly that effect.
export function expectedWinProb(aPower: number, bPower: number): number {
  const scale = Math.max(1, (aPower + bPower) / 2)
  const d = (aPower - bPower) / scale
  return 1 / (1 + Math.exp(-EXPECTED_WIN_SHARPNESS * d))
}

// How sharply a power edge maps to a win. ~2.2 puts a 50% power lead at
// roughly 75% expected win, which matches the observed league spread.
const EXPECTED_WIN_SHARPNESS = 2.2

export function boardPowerOf(board: BoardEntry[]): number {
  if (board.length === 0) return 0
  const units = board.map(e => {
    const u = makeUnit(e.definitionId, 'player', e.tier)
    if (e.hexPos) u.hexPos = { ...e.hexPos }
    return u
  })
  return calibratedPower(calcBoardProfile(units))
}

// Converts an outcome + the prior expectation into credit ∈ [0,1]:
//
//   won,  90% expected → 0.55   (barely informative — it was supposed to win)
//   won,  10% expected → 0.95   (big upset — strong evidence the comp is good)
//   lost, 90% expected → 0.05   (should have won and didn't — damning)
//   lost, 10% expected → 0.45   (expected loss — barely counts against it)
//
// A comp that performs exactly as its power predicts lands at ~0.5, i.e. the
// neutral prior: the tables end up measuring OUTPERFORMANCE OF ITS POWER
// CLASS rather than raw win rate.
export function expectedWinCredit(won: boolean, expected: number): number {
  const p = Math.max(0, Math.min(1, expected))
  return won ? 1 - 0.5 * p : 0.5 * (1 - p)
}

// ─── 2. Contribution shares ─────────────────────────────────────────────────

export interface UnitContribution { definitionId: string; dealt: number; taken: number; healed: number; shielded: number }

// Each unit's share of everything its board actually did, as a multiplier on
// the average unit's evidence (shares sum to board size, so a 6-unit board
// still contributes ~6 units' worth of evidence, just redistributed).
// Damage TAKEN counts as contribution — absorbing damage is a tank's whole
// job, and without it every tank would look worthless next to a carry.
export function contributionShares(units: UnitContribution[]): Map<string, number> {
  const raw = new Map<string, number>()
  let total = 0
  for (const u of units) {
    const v = Math.max(0, u.dealt) + Math.max(0, u.taken) + Math.max(0, u.healed) + Math.max(0, u.shielded)
    raw.set(u.definitionId, (raw.get(u.definitionId) ?? 0) + v)
    total += v
  }
  const out = new Map<string, number>()
  const n = raw.size
  if (n === 0) return out
  if (total <= 0) { for (const id of raw.keys()) out.set(id, 1); return out }   // nothing measurable (instant forfeit) → flat
  for (const [id, v] of raw) {
    // share*n = 1.0 for an exactly-average contributor. Clamped so a single
    // hyper-carry can't drown out the rest of the board's evidence entirely,
    // and a unit that did almost nothing still registers faintly.
    out.set(id, Math.max(0.15, Math.min(3, (v / total) * n)))
  }
  return out
}

// ─── 3 + 7. Per-game buffering, with placement folded in ────────────────────

interface Pending { creditSum: number; weightSum: number; observations: number }

// Collects every within-game observation and flushes each key ONCE per game.
//
// Fixes the effective-sample-size problem (#3): 20 correlated fights become a
// single independent sample whose credit is the weighted mean, and whose
// weight is the mean per-observation importance (≈1 for board-level keys,
// ≈contribution share for per-unit keys).
//
// Also where final PLACEMENT is folded in (#7): fight win rate is only a
// proxy — a board can win rounds 4-9 and still finish last by burning its
// economy. flush() blends the game's fight credit with a placement credit so
// the tables optimize the objective the game is actually scored on.
export class GameCreditBuffer {
  private pending = new Map<string, Pending>()

  add(key: string, credit: number, weight = 1): void {
    if (!(weight > 0)) return
    const p = this.pending.get(key) ?? { creditSum: 0, weightSum: 0, observations: 0 }
    p.creditSum += Math.max(0, Math.min(1, credit)) * weight
    p.weightSum += weight
    p.observations += 1
    this.pending.set(key, p)
  }

  // placement: 1 (best) … playerCount (worst), or null to score on fights only.
  flush(
    table: Record<string, Affinity>,
    prior: Affinity,
    placement: number | null,
    playerCount = 5,
    placementBlend = PLACEMENT_BLEND,
  ): void {
    const placementCredit = placement === null
      ? null
      : 1 - (Math.max(1, Math.min(playerCount, placement)) - 1) / Math.max(1, playerCount - 1)
    for (const [key, p] of this.pending) {
      if (p.weightSum <= 0) continue
      const fightCredit = p.creditSum / p.weightSum
      const credit = placementCredit === null
        ? fightCredit
        : (1 - placementBlend) * fightCredit + placementBlend * placementCredit
      // One game = one observation. Its magnitude is the mean importance of
      // the observations that fed it, capped at 1 so no single game can
      // outweigh a genuinely independent one.
      const weight = Math.min(1, p.weightSum / Math.max(1, p.observations))
      updateAffinityWeighted(table, key, credit, weight, prior)
    }
    this.pending.clear()
  }

  clear(): void { this.pending.clear() }
  get size(): number { return this.pending.size }
}

// How much of a game's credit comes from final placement vs. per-fight
// results. Placement is the true objective but a coarse, once-per-game
// signal; fights are noisy but plentiful — so fights lead and placement
// corrects.
export const PLACEMENT_BLEND = 0.3
