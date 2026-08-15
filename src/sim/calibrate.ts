/**
 * Offline calibration prior-fitting CLI.
 *
 * Generates random plausible player boards, produces a generated enemy board
 * for each, runs headless simulations for ground-truth win rates, then batch-
 * fits the calibration model (k, b, feature weights) against those soft
 * targets. Prints suggested priors vs the current hand-tuned constants.
 *
 * READ-ONLY: never writes files or localStorage — the output is a suggestion
 * for a human to apply to src/enemy/calibration.ts / boardPower.ts constants.
 *
 * Usage:
 *   npx tsx src/sim/calibrate.ts --boards 200 --trials 100
 */

import { runSimulation, type UnitSpec } from './runner'
import { generateEnemyTeam } from '../enemy/generator'
import { calcBoardProfile, PRIOR_WEIGHTS } from '../enemy/boardPower'
import { boardFeat, type BoardFeat } from '../enemy/battleLog'
import { PRIOR_K } from '../enemy/calibration'
import { makeUnit } from '../core/unitFactory'
import { ALL_UNITS } from '../data/units'
import type { Unit } from '../core/types'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
const BOARDS = Math.max(5, parseInt(getFlag('boards') ?? '200', 10) || 200)
const TRIALS = Math.max(5, parseInt(getFlag('trials') ?? '100', 10) || 100)

// ─── Random plausible player boards ──────────────────────────────────────────

const POOL = ALL_UNITS.filter(u => !u.isDummy && u.cost > 0)

function randomTier(): 1 | 2 | 3 {
  const r = Math.random()
  return r < 0.55 ? 1 : r < 0.90 ? 2 : 3
}

function randomPlayerBoard(): Unit[] {
  const size = 3 + Math.floor(Math.random() * 6)   // 3–8 units
  const picked = new Set<string>()
  const units: Unit[] = []
  let guard = 0
  while (units.length < size && guard++ < 200) {
    const def = POOL[Math.floor(Math.random() * POOL.length)]
    if (picked.has(def.id)) continue
    picked.add(def.id)
    units.push(makeUnit(def.id, 'player', randomTier()))
  }
  // Layout mirrors run.ts parseSpecs: rows 5+ for player
  units.forEach((u, i) => {
    u.hexPos = { col: 1 + (i % 6), row: 5 + Math.floor(i / 6) }
  })
  return units
}

function toSpecs(units: Unit[], isPlayer: boolean): UnitSpec[] {
  return units
    .filter(u => u.definitionId !== 'cliff_l' && u.definitionId !== 'cliff_r')
    .map((u, i) => ({
      id: u.definitionId,
      tier: u.tier as 1 | 2 | 3,
      col: u.hexPos?.col ?? (1 + (i % 6)),
      row: u.hexPos?.row ?? (isPlayer ? 5 + Math.floor(i / 6) : 2 - Math.floor(i / 6)),
    }))
}

// ─── Collect (features, winRate) samples ─────────────────────────────────────

interface Sample {
  pf: BoardFeat
  ef: BoardFeat
  winRate: number   // soft target from simulation
}

console.log(`\n─── PokéTFT Offline Calibration ─────────────────────────────`)
console.log(`  Boards: ${BOARDS}   Trials per board: ${TRIALS}\n`)

const samples: Sample[] = []
const t0 = Date.now()

for (let i = 0; i < BOARDS; i++) {
  const player = randomPlayerBoard()
  const enemy = generateEnemyTeam(player)
  const pf = boardFeat(calcBoardProfile(player))
  const ef = boardFeat(calcBoardProfile(enemy))
  if (pf.n === 0 || ef.n === 0) continue

  try {
    const report = runSimulation(toSpecs(player, true), toSpecs(enemy, false), TRIALS)
    // Count draws as half-wins for the soft target
    samples.push({ pf, ef, winRate: report.playerWinRate + 0.5 * report.drawRate })
  } catch {
    // Some random matchups can hit sim edge cases — skip them
    continue
  }

  if ((i + 1) % 20 === 0) {
    console.log(`  ${i + 1}/${BOARDS} boards simulated (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
}

console.log(`\n  Collected ${samples.length} samples in ${((Date.now() - t0) / 1000).toFixed(0)}s\n`)

// ─── Batch logistic fit with soft targets ────────────────────────────────────

function featPower(f: BoardFeat, w: { trait: number; tier3: number; cost3: number }): number {
  return f.bp + w.trait * f.tr + w.tier3 * f.t3 + w.cost3 * f.c3 * f.c3
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x))

interface FitVec { dBp: number; dTr: number; dT3: number; dC3: number; y: number }

const vecs: FitVec[] = samples.map(s => {
  const S = Math.max(1, (featPower(s.pf, PRIOR_WEIGHTS) + featPower(s.ef, PRIOR_WEIGHTS)) / 2)
  return {
    dBp: (s.pf.bp - s.ef.bp) / S,
    dTr: (s.pf.tr - s.ef.tr) / S,
    dT3: (s.pf.t3 - s.ef.t3) / S,
    dC3: (s.pf.c3 * s.pf.c3 - s.ef.c3 * s.ef.c3) / S,
    y: s.winRate,
  }
})

function logLoss(k: number, b: number, w: { trait: number; tier3: number; cost3: number }): number {
  let loss = 0
  for (const v of vecs) {
    const d = v.dBp + w.trait * v.dTr + w.tier3 * v.dT3 + w.cost3 * v.dC3
    const p = clamp(1e-6, 1 - 1e-6, sigmoid(k * d + b))
    loss += -(v.y * Math.log(p) + (1 - v.y) * Math.log(1 - p))
  }
  return loss / Math.max(1, vecs.length)
}

// Gradient descent — soft-target BCE, no regularization (offline data is unbiased)
let k = PRIOR_K
let b = 0
const w = { ...PRIOR_WEIGHTS }

for (let e = 0; e < 4000; e++) {
  let gk = 0, gb = 0, gTr = 0, gT3 = 0, gC3 = 0
  for (const v of vecs) {
    const d = v.dBp + w.trait * v.dTr + w.tier3 * v.dT3 + w.cost3 * v.dC3
    const err = sigmoid(k * d + b) - v.y
    gk += err * d
    gb += err
    gTr += err * k * v.dTr
    gT3 += err * k * v.dT3
    gC3 += err * k * v.dC3
  }
  const n = Math.max(1, vecs.length)
  const lr = 2.0 / (1 + e * 0.001)
  k = clamp(0.5, 15, k - lr * gk / n)
  b = clamp(-2, 2, b - lr * gb / n)
  w.trait = clamp(0.0, 0.6, w.trait - 0.4 * lr * gTr / n)
  w.tier3 = clamp(0.0, 1.0, w.tier3 - 0.4 * lr * gT3 / n)
  w.cost3 = clamp(0.0, 5.0, w.cost3 - 0.4 * lr * gC3 / n)
}

// ─── Report ───────────────────────────────────────────────────────────────────

const priorLoss = logLoss(PRIOR_K, 0, PRIOR_WEIGHTS)
const fitLoss   = logLoss(k, b, w)

console.log('─── Suggested priors (vs current constants) ─────────────────')
console.log(`  k        : ${k.toFixed(3)}   (current PRIOR_K = ${PRIOR_K})`)
console.log(`  b        : ${b.toFixed(3)}   (current PRIOR_B = 0; sim has no human skill — expect ≈0)`)
console.log(`  w.trait  : ${w.trait.toFixed(3)}   (current ${PRIOR_WEIGHTS.trait})`)
console.log(`  w.tier3  : ${w.tier3.toFixed(3)}   (current ${PRIOR_WEIGHTS.tier3})`)
console.log(`  w.cost3  : ${w.cost3.toFixed(3)}   (current ${PRIOR_WEIGHTS.cost3})`)
console.log('')
console.log(`  log-loss : prior ${priorLoss.toFixed(4)} → fitted ${fitLoss.toFixed(4)} (${priorLoss > 0 ? ((1 - fitLoss / priorLoss) * 100).toFixed(1) : '0'}% better)`)
console.log('')
console.log('  To adopt: update PRIOR_K in src/enemy/calibration.ts and')
console.log('  PRIOR_WEIGHTS in src/enemy/boardPower.ts, then reset in-game')
console.log('  calibration via window.__pokeTFT.resetCalibration().')
