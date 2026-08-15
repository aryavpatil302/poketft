import { describe, it, expect } from 'vitest'
import {
  priorParams, predictWinProb, fitFromRecords, refitFromLog, recentBrier,
  loadCalibration, saveCalibration, resetCalibration, recordAndLearn,
  PRIOR_K, STAGE2_MIN_N,
} from './calibration'
import { PRIOR_WEIGHTS } from './boardPower'
import type { BattleRecord, BattleStorage, BoardFeat } from './battleLog'

function memStorage(): BattleStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
  }
}

function feat(over: Partial<BoardFeat> = {}): BoardFeat {
  return { bp: 100, tr: 0, t3: 0, c3: 0, n: 4, tk: 1, ...over }
}

function rec(pf: BoardFeat, ef: BoardFeat, y: 0 | 0.5 | 1, margin = 0.5, predWin = 0.5): BattleRecord {
  return { t: 0, pf, ef, rawDelta: 0, predWin, y, margin }
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

// Deterministic LCG for reproducible synthetic streams
function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// Synthetic battles where the TRUE model is sigmoid(trueK·diff + trueB),
// diff uniform in ±0.3 (base power only)
function syntheticRecords(seed: number, n: number, trueK: number, trueB: number): BattleRecord[] {
  const rng = makeRng(seed)
  const records: BattleRecord[] = []
  for (let i = 0; i < n; i++) {
    const diff = (rng() - 0.5) * 0.6
    const pf = feat({ bp: 100 * (1 + diff / 2) })
    const ef = feat({ bp: 100 * (1 - diff / 2) })
    const pTrue = sigmoid(trueK * diff + trueB)
    const y: 0 | 1 = rng() < pTrue ? 1 : 0
    records.push(rec(pf, ef, y, 0.5))
  }
  return records
}

// Synthetic battles where trait raw power matters at trueTraitW, k=5, b=0
function traitRecords(seed: number, n: number, trueTraitW: number): BattleRecord[] {
  const rng = makeRng(seed)
  const records: BattleRecord[] = []
  for (let i = 0; i < n; i++) {
    const ptr = rng() * 120
    const etr = rng() * 120
    const bpD = (rng() - 0.5) * 30
    const pf = feat({ bp: 100 + bpD / 2, tr: ptr })
    const ef = feat({ bp: 100 - bpD / 2, tr: etr })
    const S = Math.max(1, (100 + bpD / 2 + 0.15 * ptr + 100 - bpD / 2 + 0.15 * etr) / 2)
    const dTrue = (bpD + trueTraitW * (ptr - etr)) / S
    const y: 0 | 1 = rng() < sigmoid(5 * dTrue) ? 1 : 0
    records.push(rec(pf, ef, y, 0.5))
  }
  return records
}

describe('calibration — prediction', () => {
  it('even boards at priors → 50% win chance', () => {
    const params = priorParams()
    const { p, d } = predictWinProb(feat(), feat(), params)
    expect(d).toBe(0)
    expect(p).toBeCloseTo(0.5)
  })

  it('+10% player power gap at priors ≈ 62%', () => {
    const params = priorParams()
    // player 105, enemy 95 → d = 10 / 100 = 0.1 → sigmoid(0.5) ≈ 0.622
    const { p } = predictWinProb(feat({ bp: 105 }), feat({ bp: 95 }), params)
    expect(p).toBeCloseTo(0.6225, 3)
  })

  it('trait raw power contributes at prior weight 0.15', () => {
    const params = priorParams()
    const withTrait = predictWinProb(feat({ tr: 100 }), feat(), params)
    expect(withTrait.d).toBeCloseTo(15 / withTrait.S, 6)
  })
})

describe('calibration — fit mechanics and safeguards', () => {
  it('empty log returns priors', () => {
    const params = fitFromRecords([])
    expect(params.k).toBe(PRIOR_K)
    expect(params.b).toBe(0)
    expect(params.n).toBe(0)
  })

  it('with tiny data (n=5) the priors dominate — k barely moves', () => {
    // 5 battles all lost despite even boards: strong contradiction, tiny n
    const records = Array.from({ length: 5 }, () => rec(feat({ bp: 105 }), feat({ bp: 95 }), 0, 0.9))
    const params = fitFromRecords(records)
    expect(params.k).toBeGreaterThan(3.5)   // prior k=5 holds against 5 samples
  })

  it('consistent player over-performance flows into b, not unit weights', () => {
    // Player wins even fights far more than power predicts
    const rng = makeRng(3)
    const records: BattleRecord[] = []
    for (let i = 0; i < 100; i++) {
      const y: 0 | 1 = rng() < 0.75 ? 1 : 0   // 75% wins on even boards
      records.push(rec(feat(), feat(), y, 0.5))
    }
    const params = fitFromRecords(records)
    expect(params.b).toBeGreaterThan(0.3)
    // Even boards have no feature diffs — weights must remain at priors
    expect(params.w.trait).toBeCloseTo(PRIOR_WEIGHTS.trait, 6)
    expect(params.w.tier3).toBeCloseTo(PRIOR_WEIGHTS.tier3, 6)
  })

  it('parameters stay within hard clamps under adversarial data', () => {
    // 300 extreme contradictory results
    const records = Array.from({ length: 300 }, () =>
      rec(feat({ bp: 130, tr: 50, t3: 60, c3: 3 }), feat({ bp: 70 }), 0, 1))
    const params = fitFromRecords(records)
    expect(params.k).toBeGreaterThanOrEqual(1.0)
    expect(params.k).toBeLessThanOrEqual(10.0)
    expect(params.b).toBeGreaterThanOrEqual(-1.25)
    expect(params.w.trait).toBeGreaterThanOrEqual(0.05)
    expect(params.w.trait).toBeLessThanOrEqual(0.35)
    expect(params.w.tier3).toBeGreaterThanOrEqual(0)
    expect(params.w.tier3).toBeLessThanOrEqual(0.60)
    expect(params.w.cost3).toBeGreaterThanOrEqual(0)
    expect(params.w.cost3).toBeLessThanOrEqual(3.0)
  })

  it('stage 2 is inert below STAGE2_MIN_N battles', () => {
    const records = traitRecords(11, STAGE2_MIN_N - 1, 0.30)
    const params = fitFromRecords(records)
    expect(params.w.trait).toBe(PRIOR_WEIGHTS.trait)
    expect(params.w.tier3).toBe(PRIOR_WEIGHTS.tier3)
    expect(params.w.cost3).toBe(PRIOR_WEIGHTS.cost3)
  })

  it('ignores outlier records (extreme power ratios) and empty boards', () => {
    const outlier = rec(feat({ bp: 10000 }), feat({ bp: 1 }), 0, 1)
    const empty = rec(feat({ n: 0 }), feat(), 0, 1)
    const params = fitFromRecords([outlier, empty])
    expect(params.n).toBe(0)
    expect(params.k).toBe(PRIOR_K)
  })

  it('fit is deterministic — same records give identical params', () => {
    const records = syntheticRecords(7, 60, 2, 0.5)
    const a = fitFromRecords(records)
    const b = refitFromLog(records)
    expect(a.k).toBe(b.k)
    expect(a.b).toBe(b.b)
    expect(a.w.trait).toBe(b.w.trait)
    expect(a.n).toBe(b.n)
  })
})

describe('calibration — persistence', () => {
  it('round-trips params through storage', () => {
    const s = memStorage()
    const params = priorParams()
    params.k = 3.3
    params.b = 0.4
    params.n = 17
    saveCalibration(params, s)
    const loaded = loadCalibration(s)
    expect(loaded.k).toBeCloseTo(3.3)
    expect(loaded.b).toBeCloseTo(0.4)
    expect(loaded.n).toBe(17)
  })

  it('corrupt or version-mismatched params reset to priors', () => {
    const s = memStorage()
    s.setItem('pokeTFT_calib_v1', 'garbage{')
    expect(loadCalibration(s).k).toBe(PRIOR_K)
    s.setItem('pokeTFT_calib_v1', JSON.stringify({ v: 99, k: 2 }))
    expect(loadCalibration(s).k).toBe(PRIOR_K)
  })

  it('resetCalibration restores priors in storage', () => {
    const s = memStorage()
    const params = priorParams()
    params.k = 9
    saveCalibration(params, s)
    resetCalibration(s)
    expect(loadCalibration(s).k).toBe(PRIOR_K)
  })

  it('recordAndLearn fits from the log and persists', () => {
    const s = memStorage()
    const records = syntheticRecords(42, 100, 2, 0.5)
    const params = recordAndLearn(records, s)
    expect(params.n).toBe(100)
    expect(loadCalibration(s).k).toBeCloseTo(params.k)
  })
})

describe('calibration — convergence (synthetic ground truth)', () => {
  it('recovers k≈2, b≈0.5 from 300 battles across seeds', () => {
    for (const seed of [42, 1234, 7]) {
      const params = fitFromRecords(syntheticRecords(seed, 300, 2, 0.5))
      expect(Math.abs(params.k - 2)).toBeLessThan(1.0)
      expect(Math.abs(params.b - 0.5)).toBeLessThan(0.25)
    }
  })

  it('is stable: one more battle at n=300 moves k by < 0.05', () => {
    const records = syntheticRecords(1234, 300, 2, 0.5)
    const a = fitFromRecords(records)
    const b = fitFromRecords([...records, ...syntheticRecords(5, 1, 2, 0.5)])
    expect(Math.abs(a.k - b.k)).toBeLessThan(0.05)
    expect(Math.abs(a.b - b.b)).toBeLessThan(0.05)
  })

  it('learned model beats the prior model on held-out Brier score', () => {
    const train = syntheticRecords(42, 250, 2, 0.6)
    const test = syntheticRecords(999, 100, 2, 0.6)
    const learned = fitFromRecords(train)
    const prior = priorParams()

    let brierLearned = 0
    let brierPrior = 0
    for (const r of test) {
      brierLearned += (predictWinProb(r.pf, r.ef, learned).p - r.y) ** 2
      brierPrior   += (predictWinProb(r.pf, r.ef, prior).p  - r.y) ** 2
    }
    expect(brierLearned).toBeLessThan(brierPrior)
  })

  it('anti-bias: w.trait stays near prior when the prior is correct', () => {
    for (const seed of [42, 99]) {
      const params = fitFromRecords(traitRecords(seed, 300, 0.15))
      expect(params.w.trait).toBeGreaterThan(0.10)
      expect(params.w.trait).toBeLessThan(0.20)
    }
  })

  it('w.trait moves decisively toward a higher true value but never past its clamp', () => {
    for (const seed of [42, 99, 777]) {
      const params = fitFromRecords(traitRecords(seed, 300, 0.30))
      expect(params.w.trait).toBeGreaterThan(0.20)
      expect(params.w.trait).toBeLessThanOrEqual(0.35)
    }
  })
})

describe('calibration — brier window', () => {
  it('recentBrier is null below 5 samples then averages stored predictions', () => {
    expect(recentBrier(priorParams())).toBeNull()
    // predWin 0.8 on 10 wins → brier = 0.04 each
    const records = Array.from({ length: 10 }, () =>
      rec(feat({ bp: 105 }), feat({ bp: 95 }), 1, 0.5, 0.8))
    const params = fitFromRecords(records)
    const brier = recentBrier(params)
    expect(brier).not.toBeNull()
    expect(brier!).toBeCloseTo(0.04, 5)
  })
})
