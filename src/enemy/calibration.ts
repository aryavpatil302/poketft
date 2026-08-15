// Online calibration of the enemy-generation power model.
//
// After every battle the model is REFIT from the full battle log (≤300
// records) as a regularized MAP logistic regression:
//
//   P(playerWin) = sigmoid(k·d + b)
//   d = calibrated power diff (player − enemy) / scale
//
// `k` learns how much a power gap actually matters in combat; `b` absorbs
// consistent player skill (positioning, items) so unit-value weights don't get
// distorted by it. Feature weights w correct the hand-tuned power constants —
// trait bonus (0.15), tier-3 surcharge (0.30), cost-3 quadratic (1.0).
//
// Batch refit (vs single-pass SGD) is deliberate: with tiny data volumes,
// sample efficiency and stability matter far more than compute. A full refit
// is deterministic, uses every stored battle optimally, and cannot oscillate.
//
// Anti-overshoot / anti-bias safeguards (all named constants below):
//   • Parameters start at the hand-tuned priors and are pulled toward them by
//     L2 penalties whose strength SHRINKS as the log grows — with 5 battles
//     the priors dominate; with 300 the data dominates.
//   • k and w use squared-decay priors (they are weakly identified early);
//     b uses linear decay (well identified, but must not swing on 3 games).
//   • Hard clamps on every parameter.
//   • Feature weights (stage 2) stay frozen until STAGE2_MIN_N battles.
//   • Records with degenerate boards or extreme power ratios are ignored.
//   • Margin-weighted loss: stomps teach more than coin-flip finishes.

import type { BattleRecord, BattleStorage, BoardFeat } from './battleLog'
import { PRIOR_WEIGHTS, type PowerWeights } from './boardPower'

export interface CalibParams {
  v: number
  n: number                 // records the current fit was computed from
  k: number                 // logit slope on normalized power diff
  b: number                 // bias (player-skill absorber)
  w: PowerWeights           // learned corrections to power constants
  brierWindow: number[]     // (predWin − outcome)² of the most recent battles
}

// ─── Safeguard constants ──────────────────────────────────────────────────────

export const PRIOR_K = 5      // +10% power gap → logit 0.5 ≈ 62% win chance
export const PRIOR_B = 0

const K_MIN = 1.0,   K_MAX = 10.0
const B_MIN = -1.25, B_MAX = 1.25
const W_TRAIT_MIN = 0.05, W_TRAIT_MAX = 0.35
const W_TIER3_MIN = 0.00, W_TIER3_MAX = 0.60
const W_COST3_MIN = 0.00, W_COST3_MAX = 3.00

export const STAGE2_MIN_N = 30   // battles before feature weights unfreeze

const PRIOR_N   = 15    // prior "pseudo-battle" count: λ = PRIOR_N/(PRIOR_N+n)
const PRIOR_PK  = 0.3   // k prior strength (applied at λ²)
const PRIOR_PB  = 0.3   // b prior strength (applied at λ)
const PRIOR_PW  = 10    // w prior strength (applied at λ²)

const FIT_EPOCHS  = 1500
const FIT_LR      = 4.0
const FIT_LR_W    = 1.2   // slower step for feature weights

const OUTLIER_D   = 1.5   // ignore records whose prior-weight |d| exceeds this
const BRIER_WINDOW = 30

const CALIB_KEY = 'pokeTFT_calib_v1'
const CALIB_VERSION = 1

// ─── Params lifecycle ─────────────────────────────────────────────────────────

export function priorParams(): CalibParams {
  return {
    v: CALIB_VERSION,
    n: 0,
    k: PRIOR_K,
    b: PRIOR_B,
    w: { ...PRIOR_WEIGHTS },
    brierWindow: [],
  }
}

function defaultStorage(): BattleStorage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function loadCalibration(storage: BattleStorage | null = defaultStorage()): CalibParams {
  if (!storage) return priorParams()
  try {
    const raw = storage.getItem(CALIB_KEY)
    if (!raw) return priorParams()
    const parsed = JSON.parse(raw)
    if (parsed?.v !== CALIB_VERSION || typeof parsed.k !== 'number') return priorParams()
    return parsed as CalibParams
  } catch {
    return priorParams()
  }
}

export function saveCalibration(params: CalibParams, storage: BattleStorage | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(CALIB_KEY, JSON.stringify(params))
  } catch {
    // storage unavailable — keep learning in memory only
  }
}

export function resetCalibration(storage: BattleStorage | null = defaultStorage()): CalibParams {
  const params = priorParams()
  saveCalibration(params, storage)
  return params
}

// ─── Prediction ───────────────────────────────────────────────────────────────

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z))
}

function featPower(f: BoardFeat, w: PowerWeights): number {
  return f.bp + w.trait * f.tr + w.tier3 * f.t3 + w.cost3 * f.c3 * f.c3
}

export interface Prediction {
  p: number    // P(player win)
  d: number    // normalized calibrated power diff (player − enemy)
  S: number    // normalization scale (frozen at prior weights)
}

// P(player win) given both boards' features. The scale S is computed with the
// PRIOR weights so the model stays linear in the learned parameters.
export function predictWinProb(pf: BoardFeat, ef: BoardFeat, params: CalibParams): Prediction {
  const S = Math.max(1, (featPower(pf, PRIOR_WEIGHTS) + featPower(ef, PRIOR_WEIGHTS)) / 2)
  const d = (featPower(pf, params.w) - featPower(ef, params.w)) / S
  const p = sigmoid(params.k * d + params.b)
  return { p, d, S }
}

// ─── Batch MAP fit ────────────────────────────────────────────────────────────

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x))

interface FitSample {
  dBp: number    // Δ basePower / S
  dTr: number    // Δ traitRaw / S
  dT3: number    // Δ tier3Power / S
  dC3: number    // Δ cost3Count² / S
  y: number
  m: number      // margin-based sample weight
}

function toSample(rec: BattleRecord): FitSample | null {
  if (rec.pf.n === 0 || rec.ef.n === 0) return null
  const S = Math.max(1, (featPower(rec.pf, PRIOR_WEIGHTS) + featPower(rec.ef, PRIOR_WEIGHTS)) / 2)
  const dPrior = (featPower(rec.pf, PRIOR_WEIGHTS) - featPower(rec.ef, PRIOR_WEIGHTS)) / S
  if (!isFinite(dPrior) || Math.abs(dPrior) > OUTLIER_D) return null
  return {
    dBp: (rec.pf.bp - rec.ef.bp) / S,
    dTr: (rec.pf.tr - rec.ef.tr) / S,
    dT3: (rec.pf.t3 - rec.ef.t3) / S,
    dC3: (rec.pf.c3 * rec.pf.c3 - rec.ef.c3 * rec.ef.c3) / S,
    y: rec.y,
    m: rec.y === 0.5 ? 0.5 : 0.5 + 0.5 * clamp(0, 1, rec.margin),
  }
}

// Refit all parameters from the battle log. Deterministic: same records in →
// same params out, so a schema bump can always replay the log.
export function fitFromRecords(records: BattleRecord[]): CalibParams {
  const params = priorParams()
  const samples = records.map(toSample).filter((s): s is FitSample => s !== null)
  const n = samples.length
  if (n === 0) return params

  const lam  = PRIOR_N / (PRIOR_N + n)
  const lamSq = lam * lam
  const stage2 = n >= STAGE2_MIN_N

  let { k, b } = params
  const w = { ...params.w }

  for (let e = 0; e < FIT_EPOCHS; e++) {
    let gk = 0, gb = 0, gTr = 0, gT3 = 0, gC3 = 0

    for (const s of samples) {
      const d = s.dBp + w.trait * s.dTr + w.tier3 * s.dT3 + w.cost3 * s.dC3
      const err = s.m * (sigmoid(k * d + b) - s.y)
      gk += err * d
      gb += err
      if (stage2) {
        gTr += err * k * s.dTr
        gT3 += err * k * s.dT3
        gC3 += err * k * s.dC3
      }
    }

    k = clamp(K_MIN, K_MAX, k - FIT_LR * (gk / n + lamSq * PRIOR_PK * (k - PRIOR_K)))
    b = clamp(B_MIN, B_MAX, b - FIT_LR * (gb / n + lam * PRIOR_PB * (b - PRIOR_B)))

    if (stage2) {
      w.trait = clamp(W_TRAIT_MIN, W_TRAIT_MAX,
        w.trait - FIT_LR_W * (gTr / n + lamSq * PRIOR_PW * (w.trait - PRIOR_WEIGHTS.trait)))
      w.tier3 = clamp(W_TIER3_MIN, W_TIER3_MAX,
        w.tier3 - FIT_LR_W * (gT3 / n + lamSq * PRIOR_PW * (w.tier3 - PRIOR_WEIGHTS.tier3)))
      w.cost3 = clamp(W_COST3_MIN, W_COST3_MAX,
        w.cost3 - FIT_LR_W * (gC3 / n + lamSq * PRIOR_PW * (w.cost3 - PRIOR_WEIGHTS.cost3)))
    }
  }

  params.k = k
  params.b = b
  params.w = w
  params.n = n
  // Brier window from stored at-combat-start predictions (honest out-of-sample)
  params.brierWindow = records
    .slice(-BRIER_WINDOW)
    .map(r => (r.predWin - r.y) * (r.predWin - r.y))
  return params
}

// Alias kept for the "replay after schema bump" use case.
export const refitFromLog = fitFromRecords

// Refit from the full log and persist. Main entry point for the game loop —
// call AFTER appending the newest record to the battle log.
export function recordAndLearn(
  records: BattleRecord[],
  storage: BattleStorage | null = defaultStorage(),
): CalibParams {
  const params = fitFromRecords(records)
  saveCalibration(params, storage)
  return params
}

// Mean Brier score over the recent window (lower = better predictions).
// null until at least 5 samples. 0.25 = coin-flip guessing.
export function recentBrier(params: CalibParams): number | null {
  if (params.brierWindow.length < 5) return null
  return params.brierWindow.reduce((a, x) => a + x, 0) / params.brierWindow.length
}
