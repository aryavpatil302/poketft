/**
 * Composition-affinity bandit trainer — Phase B of the training pipeline (see
 * train.ts's header comment for the full phase ordering). Runs self-play games
 * against the CURRENT best genomes (frozen — this script never touches
 * trainedGenomes.ts) with buy/field decisions in exploration mode (see
 * BotGameOptions.explorationMode): scoreUnit/chooseFielded Thompson-sample
 * their learned-bonus terms at a boosted weight, plus an occasional ε-swap to
 * the runner-up buy, so bots actually try trait-pair, unit-in-context,
 * trait-depth and breadth shapes the hand-coded priorityTraits system wouldn't
 * normally favor — i.e. this explores investing heavy into one or two traits,
 * spreading wide across many shallow traits, and everything between.
 *
 * ─── How an observation is scored (see learningCredit.ts) ──────────────────
 * NOT "this board won, so +1 to everything on it". That measures board
 * strength, not comp quality. Instead each observation carries:
 *
 *   • EXPECTATION-RELATIVE CREDIT — the outcome scored against what the two
 *     boards' calibrated power already predicted. Beating a stronger board is
 *     strong evidence; winning a fight you were 90% to win is nearly none.
 *     A comp that performs exactly as its power predicts sits at the neutral
 *     prior, so these tables measure OUTPERFORMANCE of a power class.
 *   • CONTRIBUTION-WEIGHTED EVIDENCE — per-unit keys are weighted by that
 *     unit's share of the board's actual damage/tanking/healing, so a carry
 *     and the filler beside it no longer get identical credit.
 *   • ONE OBSERVATION PER GAME PER KEY — a game's ~20 fights come off nearly
 *     the same board, so they're buffered and collapsed into a single
 *     independent sample (GameCreditBuffer) instead of 20 fake ones.
 *   • FINAL PLACEMENT BLENDED IN — per-fight win rate is only a proxy for the
 *     objective the game is actually scored on.
 *
 * Separate from train.ts's ES loop because the ES loop's fitness comparisons
 * need a stable environment, so composition-affinity data collection runs as
 * its own phase against a fixed genome. Item choice during this phase comes
 * from src/econ/preferredItems.ts (a hand-authored reference, not trained) —
 * this script never touches item selection.
 *
 * WARM-STARTS from the current src/econ/learnedCompositionAffinities.ts (same
 * pattern as train.ts's resolveGenome): re-running CONTINUES accumulating
 * evidence on top of prior runs. Existing counts are DECAYED first (--decay,
 * default 0.9) because the policy changes between runs — old counts describe
 * bots that no longer exist, and without decay a comp that stopped working
 * could never fall back out of favour.
 *
 * Usage:
 *   npx tsx src/econ/trainCompositionAffinities.ts [--games 3000] [--rounds 26] [--seed 1] [--decay 0.9]
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { simulateBotGame, seededRng, rankBots, type FightResolver } from '../sim/botGame'
import { resolveBotFight, type FightContribution } from './botMatches'
import type { PlayerEcon } from './runState'
import { decayTable, type Affinity } from './itemAffinity'
import {
  GameCreditBuffer, expectedWinProb, expectedWinCredit, contributionShares, boardPowerOf,
} from './learningCredit'
import { stageOf } from './constants'
import {
  establishedTraits, traitPairKey, boardTraitSignature, unitContextKey,
  traitDepths, traitDepthKey, breadthKey,
} from './compositionSignature'
import {
  LEARNED_TRAIT_PAIR_BONUS, LEARNED_UNIT_CONTEXT_BONUS,
  LEARNED_TRAIT_DEPTH_BONUS, LEARNED_BREADTH_BONUS,
} from './learnedCompositionAffinities'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
const N_GAMES     = Math.max(1, parseInt(getFlag('games') ?? '3000', 10) || 3000)
const MAX_ROUNDS  = Math.max(5, parseInt(getFlag('rounds') ?? '26', 10) || 26)
const SEED        = parseInt(getFlag('seed') ?? '1', 10) || 1
const DECAY       = Math.max(0, Math.min(1, parseFloat(getFlag('decay') ?? '0.9')))

const NEUTRAL_PRIOR: Affinity = { alpha: 2, beta: 2 }   // must match bots.ts's COMP_NEUTRAL_PRIOR

// ─── Affinity tables (in-memory during training, serialized at the end) ───────
// Seeded from the CURRENT learnedCompositionAffinities.ts (deep-cloned so this
// run's updates don't mutate the imported module's live objects) — this is
// what makes the script cumulative across runs rather than starting cold.

function cloneTable(t: Record<string, Affinity>): Record<string, Affinity> {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { alpha: v.alpha, beta: v.beta }]))
}

const traitPairTable: Record<string, Affinity> = cloneTable(LEARNED_TRAIT_PAIR_BONUS)
const unitContextTable: Record<string, Affinity> = cloneTable(LEARNED_UNIT_CONTEXT_BONUS)
const traitDepthTable: Record<string, Affinity> = cloneTable(LEARNED_TRAIT_DEPTH_BONUS)
const breadthTable: Record<string, Affinity> = cloneTable(LEARNED_BREADTH_BONUS)
const ALL_TABLES = [traitPairTable, unitContextTable, traitDepthTable, breadthTable]

// ─── Per-game credit buffers, one set per bot slot ───────────────────────────
// Each bot's observations accumulate here across the whole game and flush once
// at game end with that bot's own final placement.

interface SlotBuffers { pair: GameCreditBuffer; ctx: GameCreditBuffer; depth: GameCreditBuffer; breadth: GameCreditBuffer }
function newSlotBuffers(): SlotBuffers {
  return { pair: new GameCreditBuffer(), ctx: new GameCreditBuffer(), depth: new GameCreditBuffer(), breadth: new GameCreditBuffer() }
}

// Record one side of one fight into that bot's buffers.
function bufferCompositionOutcomes(
  buf: SlotBuffers,
  econ: PlayerEcon,
  contrib: FightContribution[],
  stage: number,
  credit: number,
): void {
  const board = econ.board
  const traits = establishedTraits(board)

  // Board-level signals: full weight, credit only.
  for (let i = 0; i < traits.length; i++) {
    for (let j = i + 1; j < traits.length; j++) {
      buf.pair.add(traitPairKey(stage, traits[i], traits[j]), credit)
    }
  }
  for (const { trait, depth } of traitDepths(board)) {
    buf.depth.add(traitDepthKey(stage, trait, depth), credit)
  }
  buf.breadth.add(breadthKey(stage, traits.length), credit)

  // Per-unit signal: weighted by what each unit actually did this fight.
  const signature = boardTraitSignature(board)
  if (signature) {
    const shares = contributionShares(contrib)
    for (const u of board) {
      buf.ctx.add(unitContextKey(stage, u.definitionId, signature), credit, shares.get(u.definitionId) ?? 1)
    }
  }
}

// ─── Training loop ──────────────────────────────────────────────────────────

function run(): void {
  console.log(`Training composition affinities: ${N_GAMES} games (${MAX_ROUNDS} rounds max), exploration on`)
  console.log(`Warm-starting from ${Object.keys(traitPairTable).length} trait-pairs / ${Object.keys(unitContextTable).length} unit-contexts / ${Object.keys(traitDepthTable).length} trait-depths / ${Object.keys(breadthTable).length} breadths already on file.`)
  if (DECAY < 1) {
    for (const t of ALL_TABLES) decayTable(t, DECAY, NEUTRAL_PRIOR)
    console.log(`Decayed prior evidence by ${((1 - DECAY) * 100).toFixed(0)}% (--decay ${DECAY}) — old counts describe a policy that has since changed.`)
  }
  const startedAt = Date.now()

  for (let g = 0; g < N_GAMES; g++) {
    const rng = seededRng(SEED + g * 7919)
    const slots = new Map<number, SlotBuffers>()
    const bufFor = (idx: number): SlotBuffers => {
      let b = slots.get(idx)
      if (!b) { b = newSlotBuffers(); slots.set(idx, b) }
      return b
    }

    const recordFight: FightResolver = (a, b, meta) => {
      const stage = stageOf(meta.round)
      const f = resolveBotFight(a, b, rng)
      if (f.winner !== 'draw') {
        // Expectation-relative credit: how surprising was this result, given
        // what the two boards' power already predicted?
        const pA = boardPowerOf(a.board)
        const pB = boardPowerOf(b.board)
        const expA = expectedWinProb(pA, pB)
        const aWon = f.winner === 'a'
        bufferCompositionOutcomes(bufFor(meta.aIdx), a, f.contribA, stage, expectedWinCredit(aWon, expA))
        bufferCompositionOutcomes(bufFor(meta.bIdx), b, f.contribB, stage, expectedWinCredit(!aWon, 1 - expA))
      }
      return { winner: f.winner, survivorStars: f.survivorStars }
    }

    const finished = simulateBotGame({ rng, maxRounds: MAX_ROUNDS, realCadence: true, explorationMode: true, fightResolver: recordFight })

    // One flush per bot per game — each key becomes a single independent
    // observation, blended with that bot's final placement.
    const placement = rankBots(finished)
    for (const [idx, buf] of slots) {
      const place = placement[idx] ?? null
      buf.pair.flush(traitPairTable, NEUTRAL_PRIOR, place)
      buf.ctx.flush(unitContextTable, NEUTRAL_PRIOR, place)
      buf.depth.flush(traitDepthTable, NEUTRAL_PRIOR, place)
      buf.breadth.flush(breadthTable, NEUTRAL_PRIOR, place)
    }

    if ((g + 1) % 200 === 0) {
      const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(0)
      console.log(`  ... ${g + 1}/${N_GAMES} games, ${Object.keys(traitPairTable).length} trait-pairs / ${Object.keys(unitContextTable).length} unit-contexts / ${Object.keys(traitDepthTable).length} trait-depths / ${Object.keys(breadthTable).length} breadths observed, ${elapsedS}s elapsed`)
    }
  }

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`Done in ${elapsedS}s.`)

  // ─── Write src/econ/learnedCompositionAffinities.ts ──────────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outPath = join(__dirname, 'learnedCompositionAffinities.ts')
  const serialize = (table: Record<string, Affinity>) =>
    Object.entries(table)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, a]) => `  ${JSON.stringify(key)}: { alpha: ${a.alpha.toFixed(3)}, beta: ${a.beta.toFixed(3)} },`)
      .join('\n')

  const fileContents = `// Evolved by \`npx tsx src/econ/trainCompositionAffinities.ts\` — do not hand-edit.
// Empty/untested keys fall back to a flat {alpha:2, beta:2} prior (uncertain,
// defer to the existing hand-coded trait-priority logic in bots.ts), so buying
// works correctly even before this has been (re-)trained. Re-run the training
// script and this file gets overwritten.
//
// Every key is stage-scoped (see compositionSignature.ts) — a comp shape can
// be strong early and weak late, so nothing is pooled across the whole game.
//
// Counts are FRACTIONAL by design (see learningCredit.ts): each entry is one
// observation per game, its credit scored against what the board's power
// already predicted and, for per-unit keys, weighted by that unit's share of
// the board's actual contribution. A posterior mean near 0.5 therefore means
// "performs exactly as its power predicts", NOT "wins half its fights".
import type { Affinity } from './itemAffinity'

// stage|traitA|traitB (sorted) → did fielding both traits together beat what
// the board's raw power predicted, at that stage.
export const LEARNED_TRAIT_PAIR_BONUS: Record<string, Affinity> = {
${serialize(traitPairTable)}
}

// stage|unitDefId|boardTraitSignature (see compositionSignature.ts) → did
// adding this unit onto a board already running that trait signature
// outperform expectation at that stage, independent of whether the unit
// shares a trait with it. Weighted by the unit's real contribution.
export const LEARNED_UNIT_CONTEXT_BONUS: Record<string, Affinity> = {
${serialize(unitContextTable)}
}

// stage|trait|depth → did pushing this trait to this many crossed
// breakpoints (1 = first breakpoint, 2 = second, ...) outperform expectation
// at that stage, independent of what else was on the board. Captures
// "investing heavy into one trait" as its own signal.
export const LEARNED_TRAIT_DEPTH_BONUS: Record<string, Affinity> = {
${serialize(traitDepthTable)}
}

// stage|activeTraitCount → did finishing a fight with this many distinct
// ACTIVE traits (each past its own first breakpoint) outperform expectation
// at that stage. Captures "wide and shallow vs. narrow and deep" as its own
// signal, separate from which specific traits were involved.
export const LEARNED_BREADTH_BONUS: Record<string, Affinity> = {
${serialize(breadthTable)}
}
`
  writeFileSync(outPath, fileContents, 'utf-8')
  console.log(`Wrote ${outPath}`)
}

run()
