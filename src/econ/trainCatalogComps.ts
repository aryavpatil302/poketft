/**
 * Catalog-linked bandit trainer — Phase C of the training pipeline (see
 * train.ts's header comment for the full phase ordering). Links
 * docs/compositions.json (the hand-derived, mechanically-grounded composition
 * reference) to self-play: verifies which catalog entries actually win, at
 * which stage, and softly steers self-play toward under-sampled entries so
 * every entry gets real games, not just the ones that happen to form
 * spontaneously.
 *
 * Match rule (see compositionSignature.ts's matchedCatalogEntries): a catalog
 * entry counts as matched the instant every one of its core units is on a
 * fighting board, at ANY star level — intentionally loose so partial/
 * in-progress builds still count as evidence, not just perfect completions.
 *
 * ─── Sampling budget ───────────────────────────────────────────────────────
 * The catalog holds ~756 entries across 6 stages ≈ 4.5k cells. Biasing ONE
 * bot per game (the original design) gave ~2.6 biased games per entry over a
 * 2000-game run — nowhere near enough to tell 55% from 45%, so most output
 * was prior noise. Two fixes:
 *   • Every living bot slot is biased toward its own distinct entry each
 *     game, 5× the coverage per game.
 *   • Entries are DEDUPED by their core-unit set first. Many of the 756 are
 *     one-unit variations that share an identical core, and those are
 *     literally indistinguishable to the matcher — collapsing them stops the
 *     budget being spent re-measuring the same thing under different names.
 *
 * Soft-bias, not hard scripting: a biased slot gets a flat score bump toward
 * its entry's core units (bots.ts's catalogBiasIds — same mechanism as
 * priorityTraits, never a forced buy). Every fight on every board records
 * evidence for whatever entries it matches, biased or not; the bias only
 * raises how OFTEN deep/rare entries get a real chance to form.
 *
 * Scoring uses the same credit model as Phase B (see learningCredit.ts):
 * expectation-relative credit so a comp is measured against what its board's
 * power already predicted rather than raw win rate, one observation per game
 * per entry rather than ~20 correlated fights, and final placement blended in.
 * Existing counts are decayed each run (--decay) since the policy shifts
 * between runs.
 *
 * Runs against the CURRENT best genomes (frozen — never touches
 * trainedGenomes.ts), with Phase B's free-discovery bandit at its trained
 * posterior mean (explorationMode off — that broad exploration is Phase B's
 * job; this phase's only variance source is the catalog bias itself).
 *
 * Usage:
 *   npx tsx src/econ/trainCatalogComps.ts [--games 2000] [--rounds 26] [--seed 1] [--decay 0.9]
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { simulateBotGame, seededRng, rankBots, type FightResolver } from '../sim/botGame'
import { resolveBotFight } from './botMatches'
import { decayTable, type Affinity } from './itemAffinity'
import { GameCreditBuffer, expectedWinProb, expectedWinCredit, boardPowerOf } from './learningCredit'
import { stageOf } from './constants'
import { matchedCatalogEntries, catalogKey } from './compositionSignature'
import { CATALOG_INDEX } from './catalogIndex'
import { LEARNED_CATALOG_BONUS } from './learnedCatalogAffinities'

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
const N_GAMES    = Math.max(1, parseInt(getFlag('games') ?? '2000', 10) || 2000)
const MAX_ROUNDS = Math.max(5, parseInt(getFlag('rounds') ?? '26', 10) || 26)
const SEED       = parseInt(getFlag('seed') ?? '1', 10) || 1
const DECAY      = Math.max(0, Math.min(1, parseFloat(getFlag('decay') ?? '0.9')))
const BIAS_POOL  = 60   // each game draws its biased entries from the N least-sampled

const NEUTRAL_PRIOR: Affinity = { alpha: 2, beta: 2 }   // must match bots.ts's CATALOG_NEUTRAL_PRIOR

// ─── Warm-start ────────────────────────────────────────────────────────────
function cloneTable(t: Record<string, Affinity>): Record<string, Affinity> {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { alpha: v.alpha, beta: v.beta }]))
}
const catalogTable: Record<string, Affinity> = cloneTable(LEARNED_CATALOG_BONUS)

// ─── Deduped bias candidates ────────────────────────────────────────────────
// Entries sharing an identical core-unit set are indistinguishable to
// matchedCatalogEntries — they always match together — so biasing toward each
// separately just re-measures the same board. Keep one representative each.
const dedupedEntries = (() => {
  const seen = new Map<string, typeof CATALOG_INDEX[number]>()
  for (const e of CATALOG_INDEX) {
    const key = [...e.coreUnitIds].sort().join('+')
    if (!seen.has(key)) seen.set(key, e)
  }
  return [...seen.values()]
})()

// Total real (non-prior) samples per entry, maintained incrementally — with
// ~756 entries and a table that grows into the thousands of keys, rescanning
// per game is far too slow.
const entryTotalSamples = new Map<string, number>(CATALOG_INDEX.map(e => [e.id, 0]))
for (const key of Object.keys(catalogTable)) {
  const entryId = key.slice(key.indexOf('|') + 1)   // key = `${stage}|${entryId}`; entryId may itself contain '|'
  if (entryTotalSamples.has(entryId)) {
    const aff = catalogTable[key]
    entryTotalSamples.set(entryId, (entryTotalSamples.get(entryId) ?? 0) + aff.alpha + aff.beta - (NEUTRAL_PRIOR.alpha + NEUTRAL_PRIOR.beta))
  }
}

// ─── Training loop ──────────────────────────────────────────────────────────

function run(): void {
  console.log(`Training catalog affinities: ${N_GAMES} games (${MAX_ROUNDS} rounds max), soft-bias on`)
  console.log(`Catalog has ${CATALOG_INDEX.length} entries (${dedupedEntries.length} distinct cores). Warm-starting from ${Object.keys(catalogTable).length} stage|entry keys already on file.`)
  if (DECAY < 1) {
    decayTable(catalogTable, DECAY, NEUTRAL_PRIOR)
    console.log(`Decayed prior evidence by ${((1 - DECAY) * 100).toFixed(0)}% (--decay ${DECAY}).`)
  }
  const startedAt = Date.now()

  for (let g = 0; g < N_GAMES; g++) {
    // Bias EVERY slot, each toward a different under-sampled entry.
    const ranked = [...dedupedEntries].sort((a, b) => (entryTotalSamples.get(a.id) ?? 0) - (entryTotalSamples.get(b.id) ?? 0))
    const pool = ranked.slice(0, Math.min(BIAS_POOL, ranked.length))
    const rng0 = seededRng(SEED + g * 7919)
    const biasBySlot = new Map<number, Set<string>>()
    const used = new Set<string>()
    for (let slot = 1; slot <= 5; slot++) {
      // Draw without replacement so five slots never chase the same comp
      // (they share one unit pool — that would just starve each other).
      let pick = pool[Math.floor(rng0() * pool.length)]
      for (let tries = 0; tries < 10 && (!pick || used.has(pick.id)); tries++) pick = pool[Math.floor(rng0() * pool.length)]
      if (!pick || used.has(pick.id)) continue
      used.add(pick.id)
      biasBySlot.set(slot, new Set(pick.coreUnitIds))
    }

    const rng = seededRng(SEED + g * 7919)
    const buffers = new Map<number, GameCreditBuffer>()
    // Which entries this game actually observed, per slot — used to keep the
    // incremental sample counter (which drives under-sampled entry selection)
    // in step with what the flush writes.
    const touched = new Map<number, Set<string>>()
    const bufFor = (idx: number): GameCreditBuffer => {
      let b = buffers.get(idx)
      if (!b) { b = new GameCreditBuffer(); buffers.set(idx, b); touched.set(idx, new Set()) }
      return b
    }

    const recordFight: FightResolver = (a, b, meta) => {
      const stage = stageOf(meta.round)
      const f = resolveBotFight(a, b, rng)
      if (f.winner !== 'draw') {
        const expA = expectedWinProb(boardPowerOf(a.board), boardPowerOf(b.board))
        const aWon = f.winner === 'a'
        const record = (econ: typeof a, idx: number, credit: number) => {
          const owned = new Set(econ.board.map(u => u.definitionId))
          const buf = bufFor(idx)
          const seen = touched.get(idx)!
          for (const entryId of matchedCatalogEntries(owned)) {
            buf.add(catalogKey(stage, entryId), credit)
            seen.add(entryId)
          }
        }
        record(a, meta.aIdx, expectedWinCredit(aWon, expA))
        record(b, meta.bIdx, expectedWinCredit(!aWon, 1 - expA))
      }
      return { winner: f.winner, survivorStars: f.survivorStars }
    }

    const finished = simulateBotGame({
      rng, maxRounds: MAX_ROUNDS, realCadence: true, explorationMode: false,
      fightResolver: recordFight,
      catalogBiasFor: slot => biasBySlot.get(slot),
    })

    // One observation per entry per game, blended with that bot's placement.
    const placement = rankBots(finished)
    for (const [idx, buf] of buffers) {
      buf.flush(catalogTable, NEUTRAL_PRIOR, placement[idx] ?? null)
      for (const entryId of touched.get(idx) ?? []) {
        entryTotalSamples.set(entryId, (entryTotalSamples.get(entryId) ?? 0) + 1)
      }
    }

    if ((g + 1) % 200 === 0) {
      const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(0)
      const covered = [...entryTotalSamples.values()].filter(n => n >= 15).length
      console.log(`  ... ${g + 1}/${N_GAMES} games, ${Object.keys(catalogTable).length} stage|entry keys, ${covered}/${CATALOG_INDEX.length} entries with 15+ samples, ${elapsedS}s elapsed`)
    }
  }

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`Done in ${elapsedS}s.`)

  // ─── Write src/econ/learnedCatalogAffinities.ts ──────────────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const outPath = join(__dirname, 'learnedCatalogAffinities.ts')
  const serialized = Object.entries(catalogTable)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, a]) => `  ${JSON.stringify(key)}: { alpha: ${a.alpha.toFixed(3)}, beta: ${a.beta.toFixed(3)} },`)
    .join('\n')

  const fileContents = `// Evolved by \`npx tsx src/econ/trainCatalogComps.ts\` — do not hand-edit.
// Empty/untested keys fall back to a flat {alpha:2, beta:2} prior (uncertain,
// contributes exactly 0 until trained), so buying works correctly even before
// this has been (re-)trained.
//
// Keyed \`\${stage}|\${catalogEntryId}\` (see compositionSignature.ts's
// catalogKey) — catalogEntryId is the stable id docs/compositions.json's
// entries carry (see src/econ/catalogIndex.ts, generated from that doc).
// Separate file from learnedCompositionAffinities.ts's four free-discovery
// tables because it's written by a different training phase (Phase C) — kept
// apart so re-running either phase can never clobber the other's data.
//
// Counts are FRACTIONAL by design (see learningCredit.ts): one observation
// per game, scored against what the board's power already predicted. A
// posterior mean near 0.5 means "performs as its power predicts", NOT "wins
// half its fights".
import type { Affinity } from './itemAffinity'

export const LEARNED_CATALOG_BONUS: Record<string, Affinity> = {
${serialized}
}
`
  writeFileSync(outPath, fileContents, 'utf-8')
  console.log(`Wrote ${outPath}`)
}

run()
