// Generic Beta-distribution win/loss bandit math, used by the composition
// bandit (src/econ/compositionSignature.ts, src/econ/learnedCompositionAffinities.ts,
// blended into src/econ/bots.ts's scoreUnit/chooseFielded). Item choice no
// longer uses this — see src/econ/preferredItems.ts, a hand-authored
// reference instead.

export interface Affinity { alpha: number; beta: number }

export function posteriorMean(a: Affinity): number {
  return a.alpha / (a.alpha + a.beta)
}

// Hand-rolled Gamma(shape,1) sampler (Marsaglia-Tsang), used to build a Beta
// sample via the ratio-of-Gammas identity: X~Gamma(a,1), Y~Gamma(b,1) =>
// X/(X+Y)~Beta(a,b). No external stats library exists in this project (see
// train.ts's hand-rolled Box-Muller gaussian for the same pattern).
function sampleGamma(shape: number, rng: () => number): number {
  if (shape < 1) {
    const g = sampleGamma(shape + 1, rng)
    return g * Math.pow(Math.max(rng(), 1e-9), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number, v: number
    do {
      const u1 = Math.max(1e-9, rng())
      const u2 = rng()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

// Draws one sample from the pair's Beta posterior — used ONLY in exploration
// mode (training self-play) so a candidate that might be good gets tried
// occasionally instead of always deferring to the current posterior mean.
export function thompsonSample(a: Affinity, rng: () => number = Math.random): number {
  const x = sampleGamma(a.alpha, rng)
  const y = sampleGamma(a.beta, rng)
  return x / (x + y)
}

export function updateAffinity(table: Record<string, Affinity>, key: string, won: boolean, prior: Affinity): void {
  updateAffinityWeighted(table, key, won ? 1 : 0, 1, prior)
}

// Fractional Beta update — the form every training phase now uses.
//
//   credit ∈ [0,1] : how much of this observation counts as a WIN. Not a
//                    binary outcome: it carries the expectation-relative
//                    surprise (an upset win is worth far more than a win the
//                    board was always going to get — see expectedWinCredit)
//                    and, where available, that entity's share of the board's
//                    actual contribution.
//   weight > 0     : how much evidence this observation is worth. Fights
//                    within one game are highly correlated (a board at round
//                    18 is mostly the same board as at round 17), so counting
//                    each as a full independent trial makes the posterior far
//                    more confident than the data justifies and collapses
//                    exploration early. Callers pass a fractional weight to
//                    keep the EFFECTIVE sample size honest.
//
// alpha gains credit*weight, beta gains (1-credit)*weight, so total evidence
// added is always exactly `weight` regardless of how the credit splits.
export function updateAffinityWeighted(
  table: Record<string, Affinity>,
  key: string,
  credit: number,
  weight: number,
  prior: Affinity,
): void {
  if (!(weight > 0)) return
  const c = Math.max(0, Math.min(1, credit))
  const cur = table[key] ?? { alpha: prior.alpha, beta: prior.beta }
  cur.alpha += c * weight
  cur.beta += (1 - c) * weight
  table[key] = cur
}

// Pulls a table's accumulated counts back toward the prior by `factor`
// (0.9 = keep 90% of the evidence). Training is cumulative across runs, but
// the POLICY changes between them (Phase A re-tunes the genome, Phase B/C
// shift the blended scores) — so old counts describe a bot that no longer
// exists. Decaying each run makes the tables track the current bots instead
// of averaging over every historical version, and lets a comp that stopped
// working actually fall back out of favour.
export function decayTable(table: Record<string, Affinity>, factor: number, prior: Affinity): void {
  for (const key of Object.keys(table)) {
    const a = table[key]
    // Decay only the EVIDENCE above the prior, never the prior itself, so an
    // untouched key stays exactly neutral instead of drifting.
    const alphaEvidence = Math.max(0, a.alpha - prior.alpha) * factor
    const betaEvidence = Math.max(0, a.beta - prior.beta) * factor
    if (alphaEvidence + betaEvidence < 1e-6) { delete table[key]; continue }  // fully decayed → drop it, keeps files from growing forever
    a.alpha = prior.alpha + alphaEvidence
    a.beta = prior.beta + betaEvidence
  }
}
