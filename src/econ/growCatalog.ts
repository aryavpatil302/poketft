/**
 * Catalog auto-growth — Phase D of the training pipeline (see train.ts's
 * header comment for the full phase ordering). Closes the loop between
 * self-play and docs/compositions.json / docs/compositions.md:
 *
 *   1. MEASURE existing entries: every hand-derived catalog entry gets a
 *      `measuredWinRate` / `measuredSamples` field (in the JSON only) pulled
 *      from src/econ/learnedCatalogAffinities.ts (Phase C's verification
 *      data) — aggregated across every stage that has real samples. Entries
 *      Phase C hasn't touched yet are left unannotated, never fabricated.
 *   2. GROW new entries: scans src/econ/learnedCompositionAffinities.ts's
 *      free-discovery trait-pair table for (stage, traitA, traitB) combos
 *      that clear a real confidence bar (samples + win rate) AND aren't
 *      already represented anywhere in the existing catalog, and appends
 *      them as new `discoveredPairings` entries — tagged `source: "training"`
 *      with their measured win rate/sample count, listing real carriers for
 *      each trait (drawn from src/data/units.ts, never invented). Idempotent:
 *      re-running refreshes an already-discovered pairing's stats in place
 *      rather than duplicating it.
 *
 * Discovered pairings intentionally carry NO coreUnitIds (they name a trait
 * PAIR, not a fixed unit combo — there's no single canonical core to match a
 * live board against) and are excluded from src/econ/catalogIndex.ts by
 * catalogIndexGen.ts for exactly that reason. Their live influence on bots
 * already flows through learnedCompositionAffinities.ts's trait-pair bandit,
 * which bots.ts's scoreUnit already consults directly — this script's job is
 * purely to make that discovery legible in the human-facing catalog, not to
 * add a second wiring path into bot decisions.
 *
 * Usage:
 *   npx tsx src/econ/growCatalog.ts [--min-samples 40] [--min-winrate 0.62]
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { UNIT_MAP } from '../data/units'
import { TRAIT_MAP } from '../data/traits'
import { getThresholds } from '../enemy/boardPower'

const args = process.argv.slice(2)
function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
const MIN_SAMPLES  = Math.max(1, parseInt(getFlag('min-samples') ?? '40', 10) || 40)
const MIN_WIN_RATE = Math.max(0, Math.min(1, parseFloat(getFlag('min-winrate') ?? '0.62') || 0.62))
const PRIOR_TOTAL = 4   // NEUTRAL_PRIOR = {alpha:2, beta:2} everywhere in this pipeline

interface Affinity { alpha: number; beta: number }
interface CatalogNode { id?: string; coreUnitIds?: string[]; [key: string]: unknown }

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')
const jsonPath = join(REPO_ROOT, 'docs/compositions.json')
const mdPath = join(REPO_ROOT, 'docs/compositions.md')

async function run(): Promise<void> {
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'))
  const catalogMod = await import(`${pathToFileURL(join(__dirname, 'learnedCatalogAffinities.ts')).href}?t=${Date.now()}`)
  const compMod = await import(`${pathToFileURL(join(__dirname, 'learnedCompositionAffinities.ts')).href}?t=${Date.now()}`)
  const LEARNED_CATALOG_BONUS: Record<string, Affinity> = catalogMod.LEARNED_CATALOG_BONUS
  const LEARNED_TRAIT_PAIR_BONUS: Record<string, Affinity> = compMod.LEARNED_TRAIT_PAIR_BONUS

  // ─── Step 1: measure existing entries ─────────────────────────────────────
  const existingEntries: CatalogNode[] = []
  const coveredPairs = new Set<string>()   // trait-pair keys (unordered, stage-independent) already represented somewhere in the catalog
  function pairKey(a: string, b: string): string { return [a, b].sort().join('|') }

  function walk(node: unknown): void {
    if (Array.isArray(node)) { for (const n of node) walk(n); return }
    if (node && typeof node === 'object') {
      const o = node as CatalogNode
      if (typeof o.id === 'string' && Array.isArray(o.coreUnitIds)) {
        existingEntries.push(o)
        const traits = new Set<string>()
        for (const id of o.coreUnitIds as string[]) for (const t of UNIT_MAP.get(id)?.types ?? []) traits.add(t)
        const list = [...traits]
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) coveredPairs.add(pairKey(list[i], list[j]))
      }
      for (const k in o) walk(o[k])
    }
  }
  walk(data.part1RerollComps)
  walk(data.part2LevelingComps)

  let annotated = 0
  for (const entry of existingEntries) {
    let alpha = 0, beta = 0, samples = 0
    for (const [key, aff] of Object.entries(LEARNED_CATALOG_BONUS)) {
      if (key.slice(key.indexOf('|') + 1) !== entry.id) continue
      const real = aff.alpha + aff.beta - PRIOR_TOTAL
      if (real <= 0) continue
      alpha += aff.alpha - 2; beta += aff.beta - 2; samples += real
    }
    if (samples >= 5) {
      entry.measuredWinRate = +((alpha) / (alpha + beta)).toFixed(3)
      entry.measuredSamples = Math.round(samples)
      annotated++
    }
  }
  console.log(`Annotated ${annotated}/${existingEntries.length} existing catalog entries with measured win rate (5+ samples).`)

  // ─── Step 2: grow new discovered-pairing entries ──────────────────────────
  const traitName = (id: string): string => TRAIT_MAP.get(id)?.name ?? id
  const carriersOf = (trait: string) =>
    [...UNIT_MAP.values()]
      .filter(u => !u.isDummy && u.cost > 0 && u.types.includes(trait))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)
      .map(u => ({ id: u.id, name: u.name, cost: u.cost, role: u.role }))

  if (!Array.isArray(data.discoveredPairings)) data.discoveredPairings = []
  const existingDiscovered = new Map<string, CatalogNode>(data.discoveredPairings.map((e: CatalogNode) => [e.id as string, e]))

  let added = 0, refreshed = 0, skippedCovered = 0
  for (const [key, aff] of Object.entries(LEARNED_TRAIT_PAIR_BONUS)) {
    const [stageStr, a, b] = key.split('|')
    const samples = aff.alpha + aff.beta - PRIOR_TOTAL
    if (samples < MIN_SAMPLES) continue
    const winRate = (aff.alpha - 2) / (samples)
    if (winRate < MIN_WIN_RATE) continue
    if (coveredPairs.has(pairKey(a, b))) { skippedCovered++; continue }

    const id = `discovered|stage${stageStr}|${pairKey(a, b)}`
    const carriersA = carriersOf(a), carriersB = carriersOf(b)
    const wasAlreadyKnown = existingDiscovered.has(id)
    const entry: CatalogNode = {
      id,
      source: 'training',
      // Set once, on first discovery, and never overwritten by a later refresh
      // — this is what lets the training report show "discovered on <date>"
      // instead of the timestamp resetting every time stats get refreshed.
      addedAt: wasAlreadyKnown ? existingDiscovered.get(id)!.addedAt : new Date().toISOString(),
      stage: parseInt(stageStr, 10),
      title: `Discovered: ${traitName(a)} + ${traitName(b)} (stage ${stageStr})`,
      summary: `Self-play training found fielding both ${traitName(a)} and ${traitName(b)} together correlated with winning ${(winRate * 100).toFixed(0)}% of fights at stage ${stageStr} (${Math.round(samples)} real samples). No fixed core — any real carriers of both traits qualify. ${traitName(a)} (breakpoints ${getThresholds(a).join('/')}) carriers: ${carriersA.map(u => u.name).join(', ')}. ${traitName(b)} (breakpoints ${getThresholds(b).join('/')}) carriers: ${carriersB.map(u => u.name).join(', ')}.`,
      traitA: a, traitB: b,
      traitAName: traitName(a), traitBName: traitName(b),
      breakpointsA: getThresholds(a), breakpointsB: getThresholds(b),
      carriersA, carriersB,
      winRate: +winRate.toFixed(3), samples: Math.round(samples),
    }
    if (existingDiscovered.has(id)) {
      Object.assign(existingDiscovered.get(id)!, entry)
      refreshed++
    } else {
      data.discoveredPairings.push(entry)
      existingDiscovered.set(id, entry)
      added++
    }
  }
  data.discoveredPairings.sort((x: CatalogNode, y: CatalogNode) => (y.winRate as number) - (x.winRate as number))
  console.log(`Discovered pairings: ${added} new, ${refreshed} refreshed, ${skippedCovered} skipped (already covered by an existing entry).`)

  writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`Wrote ${jsonPath}`)

  // ─── Regenerate the "Discovered by training" section of compositions.md ──
  const md = readFileSync(mdPath, 'utf-8')
  const startMarker = '## Part 3 — Discovered by Training'
  const idx = md.indexOf(startMarker)
  const base = idx === -1 ? md.trimEnd() + '\n\n---\n\n' : md.slice(0, idx)

  const section: string[] = []
  section.push(startMarker + '\n')
  section.push('Trait pairings self-play training found winning consistently but that aren\'t already represented')
  section.push('by a Part 1/2 entry above — generated by `npx tsx src/econ/growCatalog.ts`, refreshed every time the')
  section.push(`training pipeline runs. Threshold: ${MIN_SAMPLES}+ real samples, ${(MIN_WIN_RATE * 100).toFixed(0)}%+ win rate.`)
  section.push('Measured win-rate annotations for the hand-derived Part 1/2 entries above live in `compositions.json`')
  section.push('only (`measuredWinRate` / `measuredSamples` fields) — not duplicated into this prose doc.\n')
  if (data.discoveredPairings.length === 0) {
    section.push('_(none yet — train more games with `npm run train-catalog` / `npm run train-all`)_\n')
  } else {
    for (const e of data.discoveredPairings as CatalogNode[]) {
      section.push(`### ${e.title}\n`)
      section.push(`${e.summary}\n`)
    }
  }

  writeFileSync(mdPath, base + section.join('\n'), 'utf-8')
  console.log(`Wrote ${mdPath}`)
}

run()
