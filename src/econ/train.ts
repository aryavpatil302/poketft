/**
 * Offline bot-training CLI — evolution strategy (population-based RL), the
 * same family as "Evolution Strategies as a Scalable Alternative to RL"
 * (Salimans et al. 2017): a black-box optimizer that plays many simulated
 * games and selects on outcome, rather than a hand-tuned heuristic or a
 * differentiable policy-gradient net. Appropriate here because the
 * environment (the existing headless econ + combat sim) is fast, fully
 * controlled, and the thing being optimized — each persona's BotGenome — is
 * a small (~15-float) parameter vector, not a huge network.
 *
 * For each persona in turn, mutate its current-best genome into a
 * population, evaluate each candidate by playing it through many simulated
 * 5-bot games (self-play — the OTHER four seats use their own current-best
 * genomes, so personas keep improving against each other's newest
 * strategies), and keep whichever candidate performed best. Repeat for many
 * generations.
 *
 * Writes the result to src/econ/trainedGenomes.ts, which bots.ts loads at
 * runtime (falling back to the hand-picked seed values for anything a
 * persona's trained genome doesn't cover).
 *
 * Usage:
 *   npx tsx src/econ/train.ts [--generations 20] [--population 8] [--games 20] [--rounds 26] [--sigma 0.15] [--seed 1]
 *
 * ─── Full training pipeline (two phases, run separately) ──────────────────
 * This script is Phase A only. A second script adds a learned bandit layer on
 * top of these genome weights for unit/trait COMPOSITION discovery — see
 * src/econ/itemAffinity.ts and src/econ/compositionSignature.ts for the
 * mechanism. It's deliberately a separate phase, not interleaved with the ES
 * loop above: the ES fitness comparison needs a STABLE environment, so
 * mutating the bandit tables mid-generation would confound "is candidate B
 * better because of its genome, or because the tables shifted under it?".
 *
 * Item choice is NOT trained — see src/econ/preferredItems.ts, a
 * hand-authored per-unit item reference maintained directly instead.
 *
 *   Phase A (this script): tune BotGenome weights → src/econ/trainedGenomes.ts
 *   Phase B: freeze those genomes, then run:
 *     npx tsx src/econ/trainCompositionAffinities.ts → src/econ/learnedCompositionAffinities.ts
 *     (free-discovery bandit: trait pairs, unit-in-context, trait depth, breadth)
 *   Phase C: npx tsx src/econ/trainCatalogComps.ts → src/econ/learnedCatalogAffinities.ts
 *     (verifies docs/compositions.json's hand-derived entries against
 *     self-play, soft-biasing under-sampled entries so the whole catalog gets
 *     real games — see that script's header for the match rule and bias mechanism)
 *   Phase D: npx tsx src/econ/growCatalog.ts
 *     (annotates catalog entries with their measured win rate from Phase C,
 *     and appends newly-discovered trait pairings Phase B found but the
 *     catalog doesn't have yet — this is what makes "the catalog grows from
 *     training" instead of staying a static hand-written doc)
 *
 * Re-running Phase A again afterward (optional) lets the ES weights
 * re-equilibrate around the now-slightly-shifted scoring landscape. Not
 * required for correctness — every learned table above is blended in at a
 * small weight (LEARNED_COMP_WEIGHT / LEARNED_CATALOG_WEIGHT in bots.ts)
 * specifically so this isn't necessary. `npm run train-all` runs A → B → C →
 * D in one command.
 *
 * Phases B and C run self-play with `explorationMode`/soft-bias enabled (see
 * BotGameOptions in src/sim/botGame.ts) — Phase B's Thompson-sampling makes
 * scoreUnit/chooseFielded explore their learned-bonus terms instead of taking
 * the posterior mean, at a boosted weight plus an occasional ε-swap to the
 * runner-up buy so the bandit can actually overturn a hand-coded preference
 * and get the alternative tried; Phase C's catalogBiasFor nudges every bot
 * slot toward its own under-sampled catalog entry. Live bots and this
 * script's own ES runs always use explorationMode: false / no catalog bias
 * and never randomize.
 *
 * ─── How Phases B/C score an observation (src/econ/learningCredit.ts) ──────
 * Deliberately NOT "this board won, so +1 to everything on it" — that mostly
 * measures which board was stronger, so comp shapes get credited for power
 * they merely accompanied. Instead:
 *   • credit is EXPECTATION-RELATIVE — the result scored against what the two
 *     boards' calibrated power already predicted, so the tables measure
 *     outperformance of a power class (0.5 = "exactly as predicted") rather
 *     than raw win rate;
 *   • per-unit keys are weighted by that unit's real share of the board's
 *     damage/tanking/healing, so a carry and the filler beside it stop
 *     getting identical credit;
 *   • a whole game collapses to ONE observation per key, because ~20 fights
 *     off nearly the same board are not 20 independent trials and treating
 *     them as such made the posteriors far too confident to keep exploring;
 *   • final PLACEMENT is blended in, since per-fight win rate is only a proxy
 *     for the objective the game is actually scored on.
 * Counts in the generated tables are therefore FRACTIONAL, and accumulated
 * evidence is decayed each run (--decay) because the policy shifts between
 * runs and stale counts describe bots that no longer exist.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { simulateBotGame, rankBots, seededRng } from '../sim/botGame'
import {
  PERSONAS, resolveGenome, setGenomeOverrides,
  type BotGenome,
} from './bots'
import type { RunState } from './runState'
import type { Rng } from './shop'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
const N_GENERATIONS = Math.max(1, parseInt(getFlag('generations') ?? '15', 10) || 15)
const POP_SIZE       = Math.max(2, parseInt(getFlag('population') ?? '6', 10) || 6)
// 20 games/candidate (default) trades ~4x the wall-clock time of the old
// default (5) for roughly half the sampling-noise band: standard error of the
// fitness mean scales as sigma/sqrt(n), and a --sigma 0 null-mutation run
// (fixed genome, only the sampled games vary) measured a ~±140-point noise
// floor at n=5 — below that, a generation's fitness delta isn't reliably
// distinguishable from noise.
const N_GAMES        = Math.max(1, parseInt(getFlag('games') ?? '20', 10) || 20)
const MAX_ROUNDS      = Math.max(5, parseInt(getFlag('rounds') ?? '26', 10) || 26)
const SIGMA           = parseFloat(getFlag('sigma') ?? '0.15') || 0.15
const SEED            = parseInt(getFlag('seed') ?? '1', 10) || 1

// ─── Seeded RNG (seededRng is shared from src/sim/botGame.ts) ──────────────────

function gaussian(rng: Rng): number {
  // Box-Muller
  const u1 = Math.max(1e-9, rng())
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// ─── Genome mutation ────────────────────────────────────────────────────────
// Each field mutates proportional to its own scale (a flat sigma would let a
// 0-1 ratio field swing wildly while barely moving a 0-50 gold field).

const FIELD_SCALE: Record<keyof BotGenome, number> = {
  targetLevel: 2, reserve: 15, xpReserve: 15,
  hpDesperationRatio: 0.2, hpSpikeSafeRatio: 0.2, spikeBankMultiplier: 1.0,
  starCompleteBonus: 4, starPairBonus: 1.5, star3LongRunBonus: 0.6,
  traitBreakpointBonus: 1.2, traitProgressBonus: 0.5, traitOpenBonus: 0.25,
  costMultiplier: 0.2, highCostLateGameBonus: 0.6, personaLineBiasBase: 0.4,
  rerollBias: 0.4,
}
const FIELD_CLAMP: Record<keyof BotGenome, [number, number]> = {
  targetLevel: [3, 10], reserve: [0, 60], xpReserve: [0, 60],
  hpDesperationRatio: [0.05, 0.6], hpSpikeSafeRatio: [0.4, 0.95], spikeBankMultiplier: [1.2, 5],
  starCompleteBonus: [1, 25], starPairBonus: [0.5, 10], star3LongRunBonus: [0, 4],
  traitBreakpointBonus: [0.5, 8], traitProgressBonus: [0, 4], traitOpenBonus: [0, 2],
  costMultiplier: [0.05, 1.2], highCostLateGameBonus: [0, 4], personaLineBiasBase: [0, 3],
  rerollBias: [0, 3],
}

function mutateGenome(base: BotGenome, sigma: number, rng: Rng): BotGenome {
  const out = { ...base }
  for (const key of Object.keys(FIELD_SCALE) as (keyof BotGenome)[]) {
    const [lo, hi] = FIELD_CLAMP[key]
    const delta = gaussian(rng) * sigma * FIELD_SCALE[key]
    out[key] = Math.min(hi, Math.max(lo, out[key] + delta))
  }
  return out
}

// ─── One simulated training game (bots only — no human seat) ──────────────────
// Delegates to the shared loop (src/sim/botGame.ts) with realCadence:true —
// real creep/item-round cadence, so bots pick up and equip items exactly as in
// a live game (chooseBotItem / equipBotItems in botItems.ts) — the genome is
// evaluated in the same environment it's actually deployed into.

function simulateGame(overrides: Record<string, BotGenome>, rng: Rng): RunState {
  setGenomeOverrides(overrides)
  const run = simulateBotGame({ rng, maxRounds: MAX_ROUNDS, realCadence: true })
  setGenomeOverrides(null)
  return run
}

// ─── Fitness: average (placement, hp) over N_GAMES for one candidate genome ────

// Progress readout. The training loop is synchronous CPU-bound work with no
// await/yield points, so a setInterval timer never gets a turn to fire until
// run() returns — printing has to happen from inside the hot loop itself,
// gated by a manual clock check so it still only prints every ~5s.
let gamesPlayed = 0
let totalGames = 0
let trainingStartedAt = 0
let lastProgressPrintAt = 0

function maybePrintProgress(): void {
  const now = Date.now()
  if (now - lastProgressPrintAt < 5000) return
  lastProgressPrintAt = now
  const pct = Math.min(100, (gamesPlayed / totalGames) * 100)
  const elapsedS = ((now - trainingStartedAt) / 1000).toFixed(0)
  console.log(`  ... ${pct.toFixed(1)}% (${gamesPlayed}/${totalGames} games, ${elapsedS}s elapsed)`)
}

// `gameSeeds` are fixed per generation (see run()) and every candidate for
// every persona this generation is evaluated against the SAME seeds — common
// random numbers. Each seed gets a fresh independent seededRng (not a shared
// running stream), so game #3 is the literal same game regardless of how many
// random draws games #1/#2 consumed under a different candidate — a shared
// sequential stream would desync the moment two candidates roll differently.
function evaluateGenome(
  personaId: string,
  candidate: BotGenome,
  bestOthers: Record<string, BotGenome>,
  gameSeeds: number[],
): number {
  let total = 0
  for (const seed of gameSeeds) {
    const overrides = { ...bestOthers, [personaId]: candidate }
    const run = simulateGame(overrides, seededRng(seed))
    const idx = run.players.findIndex(p => p.personaId === personaId)
    const placement = rankBots(run)[idx]
    const hp = run.players[idx].hp
    total += (6 - placement) * 100 + hp   // placement dominates; hp smooths/breaks ties
    gamesPlayed++
    maybePrintProgress()
  }
  return total / gameSeeds.length
}

// ─── Evolutionary loop ──────────────────────────────────────────────────────

function run(): void {
  const rng = seededRng(SEED)
  console.log(`Training: ${N_GENERATIONS} generations × ${PERSONAS.length} personas × ${POP_SIZE} population × ${N_GAMES} games (${MAX_ROUNDS} rounds max)`)
  console.log('')

  // Seed from resolveGenome (defaults merged with any previously trained
  // values) so re-running the script CONTINUES improving from the last
  // training run instead of restarting from the hand-tuned defaults.
  const best: Record<string, BotGenome> = {}
  const bestFitness: Record<string, number> = {}
  for (const p of PERSONAS) {
    best[p.id] = resolveGenome(p.id)
    bestFitness[p.id] = -Infinity
  }

  // Total game count is known up front (elitism re-evaluates the incumbent
  // too, so it's POP_SIZE games per persona per generation, not POP_SIZE - 1).
  totalGames = N_GENERATIONS * PERSONAS.length * POP_SIZE * N_GAMES
  const startedAt = Date.now()
  trainingStartedAt = startedAt
  lastProgressPrintAt = startedAt

  for (let gen = 1; gen <= N_GENERATIONS; gen++) {
    // Fixed once per generation: every candidate for every persona this
    // generation plays these exact games. Removes "candidate got lucky
    // pairings" as a source of selection error — see evaluateGenome.
    const gameSeeds = Array.from({ length: N_GAMES }, () => Math.floor(rng() * 0x7fffffff))

    for (const persona of PERSONAS) {
      const candidates: BotGenome[] = [best[persona.id]]   // elitism
      for (let i = 1; i < POP_SIZE; i++) candidates.push(mutateGenome(best[persona.id], SIGMA, rng))

      let genBest = candidates[0]
      let genBestFit = -Infinity
      for (const cand of candidates) {
        const fit = evaluateGenome(persona.id, cand, best, gameSeeds)
        if (fit > genBestFit) { genBestFit = fit; genBest = cand }
      }
      best[persona.id] = genBest
      bestFitness[persona.id] = genBestFit
    }
    const line = PERSONAS.map(p => `${p.id}=${bestFitness[p.id].toFixed(1)}`).join('  ')
    console.log(`gen ${String(gen).padStart(2)}: ${line}`)
  }
  setGenomeOverrides(null)

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('')
  console.log(`Done in ${elapsedS}s.`)

  // ─── Write src/econ/trainedGenomes.ts ────────────────────────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outPath = join(__dirname, 'trainedGenomes.ts')
  const body = PERSONAS.map(p => {
    const g = best[p.id]
    const fields = (Object.keys(g) as (keyof BotGenome)[])
      .map(k => `    ${k}: ${Number(g[k].toFixed(4))},`)
      .join('\n')
    return `  ${p.id}: {\n${fields}\n  },`
  }).join('\n')

  const fileContents = `// Evolved by \`npx tsx src/econ/train.ts\` — do not hand-edit.
// Empty/partial entries fall back to bots.ts's DEFAULT_GENOMES on a
// field-by-field basis, so the game works correctly even before training has
// been (re-)run. Re-run the training script and this file gets overwritten.
import type { BotGenome } from './bots'

export const TRAINED_GENOMES: Record<string, Partial<BotGenome>> = {
${body}
}
`
  writeFileSync(outPath, fileContents, 'utf-8')
  console.log(`Wrote ${outPath}`)
}

run()
