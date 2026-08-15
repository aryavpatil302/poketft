/**
 * One-command full training pipeline. Runs all four phases in order (see
 * train.ts's header comment for why they're separate, not interleaved),
 * streaming each phase's own progress straight to the terminal, then prints a
 * summary report of what was actually learned: which unit/trait compositions
 * came out preferred vs. avoided, and by how much.
 *
 *   Phase A — genome weight tuning (train.ts, the ES loop)
 *   Phase B — free-discovery composition-affinity bandit (trainCompositionAffinities.ts)
 *   Phase C — catalog-linked bandit: verifies docs/compositions.json entries
 *             against self-play, soft-biasing under-sampled ones so the whole
 *             catalog gets real games (trainCatalogComps.ts)
 *   Phase D — catalog auto-growth: annotates catalog entries with their
 *             measured win rate and appends newly-discovered trait pairings
 *             Phase B found but the catalog doesn't have yet (growCatalog.ts)
 *
 * Item choice is NOT trained — see src/econ/preferredItems.ts, a
 * hand-authored per-unit item reference maintained directly instead.
 *
 * Usage:
 *   npx tsx src/econ/trainAll.ts
 *   npx tsx src/econ/trainAll.ts --comp-games 1000
 *   npx tsx src/econ/trainAll.ts --skip-genome
 *   (or: npm run train-all)
 *
 * Flags:
 *   --generations/--population/--games/--sigma   forwarded to train.ts (Phase A)
 *   --comp-games                                  forwarded as --games to trainCompositionAffinities.ts (Phase B)
 *   --catalog-games                               forwarded as --games to trainCatalogComps.ts (Phase C)
 *   --rounds/--seed                               forwarded to every phase
 *   --decay                                       forwarded to Phases B/C: how much accumulated evidence to keep (default 0.9). Old counts describe a policy that has since changed.
 *   --skip-genome / --skip-comps / --skip-catalog / --skip-grow   skip a phase entirely
 *   --min-samples                                 report filter: minimum REAL (non-prior) samples to show a row (default 15)
 *   --ai-summary                                  opt-in: also ask the `claude` CLI for a plain-English summary of the findings (see aiSummary.ts — reuses your existing `claude` login, no API key needed)
 *
 * Always writes an HTML copy of the terminal report to training_runs/ (repo
 * root), named by run date/time, e.g. training_runs/8.12.26_14:05_report.html
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { UNIT_MAP } from '../data/units'
import { TRAIT_MAP } from '../data/traits'
import { generateAiSummary, buildSummaryPrompt, type SummarySection, type SummaryRow } from './aiSummary'
import { unitSprite } from '../sim/reportAssets'

const args = process.argv.slice(2)
function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
function hasFlag(name: string): boolean { return args.includes(`--${name}`) }

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')

const MIN_SAMPLES = Math.max(1, parseInt(getFlag('min-samples') ?? '15', 10) || 15)

function escHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}
const unitName  = (id: string): string => UNIT_MAP.get(id)?.name ?? id
const traitName = (id: string): string => TRAIT_MAP.get(id)?.name ?? id

// ─── Sprite embedding (see reportAssets.ts) — each sprite inlined once as a
// CSS-class background; spriteImg references it by class, spriteCss() emits
// the accumulated rules at the end of the render. Same pattern as
// src/sim/leagueReport.ts's report.
const usedSprites = new Set<string>()
function spriteImg(defId: string, size = 40): string {
  if (unitSprite(defId)) { usedSprites.add(defId); return `<span class="spr us-${defId}" style="width:${size}px;height:${size}px" title="${escHtml(unitName(defId))}"></span>` }
  return `<span class="spr ph" style="width:${size}px;height:${size}px" title="${escHtml(unitName(defId))}"></span>`
}
function spriteCss(): string {
  let css = ''
  for (const id of usedSprites) { const u = unitSprite(id); if (u) css += `.us-${id}{background-image:url("${u}")}` }
  return css
}

// ─── Phase runner ───────────────────────────────────────────────────────────
// Each phase is its own CLI (unchanged) — spawned as a subprocess with
// inherited stdio so its own progress ticks/gen lines stream live to this
// terminal exactly as if you'd run it directly.
function runPhase(label: string, scriptRelPath: string, extraArgs: string[]): void {
  console.log(`\n━━━ ${label} ━━━`)
  const result = spawnSync('npx', ['tsx', scriptRelPath, ...extraArgs], { stdio: 'inherit', cwd: REPO_ROOT })
  if (result.status !== 0) {
    console.error(`\n${label} failed (exit code ${result.status}). Stopping pipeline — later phases were not run.`)
    process.exit(result.status ?? 1)
  }
}

const sharedArgs: string[] = []
for (const f of ['rounds', 'seed']) { const v = getFlag(f); if (v) sharedArgs.push(`--${f}`, v) }
// --decay applies to the bandit phases (B/C) only — Phase A's ES loop has no
// accumulated counts to decay.
const decayArg: string[] = []
{ const v = getFlag('decay'); if (v) decayArg.push('--decay', v) }

const genomeArgs = [...sharedArgs]
for (const f of ['generations', 'population', 'games', 'sigma']) { const v = getFlag(f); if (v) genomeArgs.push(`--${f}`, v) }

const compArgs = [...sharedArgs, ...decayArg]
{ const v = getFlag('comp-games'); if (v) compArgs.push('--games', v) }

const catalogArgs = [...sharedArgs, ...decayArg]
{ const v = getFlag('catalog-games'); if (v) catalogArgs.push('--games', v) }

console.log('pokeTFT bot training pipeline')
console.log('==============================')
const startedAt = Date.now()

if (!hasFlag('skip-genome')) runPhase('Phase A — genome weight tuning (ES)', 'src/econ/train.ts', genomeArgs)
else console.log('\n━━━ Phase A — skipped (--skip-genome) ━━━')

if (!hasFlag('skip-comps')) runPhase('Phase B — free-discovery composition-affinity bandit', 'src/econ/trainCompositionAffinities.ts', compArgs)
else console.log('\n━━━ Phase B — skipped (--skip-comps) ━━━')

if (!hasFlag('skip-catalog')) runPhase('Phase C — catalog-linked bandit (verifies docs/compositions.json)', 'src/econ/trainCatalogComps.ts', catalogArgs)
else console.log('\n━━━ Phase C — skipped (--skip-catalog) ━━━')

if (!hasFlag('skip-grow')) runPhase('Phase D — catalog auto-growth', 'src/econ/growCatalog.ts', [])
else console.log('\n━━━ Phase D — skipped (--skip-grow) ━━━')

const totalS = ((Date.now() - startedAt) / 1000).toFixed(0)
console.log(`\nAll phases done in ${totalS}s.`)

// ─── Final report: what got learned, preferred vs. avoided ────────────────
await printReport()

interface Affinity { alpha: number; beta: number }
interface Row { key: string; label: string; mean: number; samples: number }

function toRows(table: Record<string, Affinity>, priorTotal: number, label: (key: string) => string): Row[] {
  return Object.entries(table)
    .map(([key, a]) => ({
      key,
      label: label(key),
      mean: a.alpha / (a.alpha + a.beta),
      samples: Math.round(a.alpha + a.beta - priorTotal),
    }))
    .filter(r => r.samples >= MIN_SAMPLES)
    .sort((a, b) => b.mean - a.mean)
}

// Prints the section and returns it in SummarySection shape so it can also be
// handed to the (optional) AI summary prompt without recomputing anything.
function printSection(title: string, rows: Row[], topN = 12): SummarySection {
  console.log(`\n${title} — ${rows.length} entries with ${MIN_SAMPLES}+ real samples`)
  const toSummaryRow = (r: Row): SummaryRow => ({ label: r.label, winRate: r.mean, samples: r.samples })
  if (rows.length === 0) {
    console.log('  (nothing met the sample threshold yet — train more games)')
    return { title, preferred: [], avoided: [] }
  }
  const preferred = rows.slice(0, topN)
  console.log('  Preferred:')
  for (const r of preferred) {
    console.log(`    ${r.label.padEnd(45)} ${(r.mean * 100).toFixed(0).padStart(3)}%  (${r.samples} samples)`)
  }
  const avoided = rows.slice(-topN).reverse().filter(r => !preferred.includes(r))
  if (avoided.length > 0) {
    console.log('  Avoided:')
    for (const r of avoided) {
      console.log(`    ${r.label.padEnd(45)} ${(r.mean * 100).toFixed(0).padStart(3)}%  (${r.samples} samples)`)
    }
  }
  return { title, preferred: preferred.map(toSummaryRow), avoided: avoided.map(toSummaryRow) }
}

async function printReport(): Promise<void> {
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Training report — what was learned')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const sections: SummarySection[] = []
  const COMP_PRIOR_TOTAL = 4   // NEUTRAL_PRIOR = {alpha:2, beta:2}, used by every phase's tables
  let carryTankGroups: CarryTankGroup[] = []

  try {
    const mod = await import(`${pathToFileURL(join(__dirname, 'learnedCompositionAffinities.ts')).href}?t=${Date.now()}`)

    const pairRows = toRows(mod.LEARNED_TRAIT_PAIR_BONUS, COMP_PRIOR_TOTAL, key => {
      const [stage, a, b] = key.split('|')
      return `stage ${stage}: ${traitName(a)} + ${traitName(b)}`
    })
    sections.push(printSection('Trait-pair compositions', pairRows))

    const ctxRows = toRows(mod.LEARNED_UNIT_CONTEXT_BONUS, COMP_PRIOR_TOTAL, key => {
      const [stage, unitId, signature] = key.split('|')
      const sigLabel = signature.split('+').map(traitName).join(' + ')
      return `stage ${stage}: ${unitName(unitId)} onto ${sigLabel}`
    })
    sections.push(printSection('Unit splashed onto an established comp', ctxRows))

    const depthRows = toRows(mod.LEARNED_TRAIT_DEPTH_BONUS, COMP_PRIOR_TOTAL, key => {
      const [stage, trait, depth] = key.split('|')
      return `stage ${stage}: ${traitName(trait)} pushed to breakpoint ${depth}`
    })
    sections.push(printSection('Investing heavy into one trait', depthRows))

    const breadthRows = toRows(mod.LEARNED_BREADTH_BONUS, COMP_PRIOR_TOTAL, key => {
      const [stage, count] = key.split('|')
      return `stage ${stage}: ${count} distinct active traits`
    })
    sections.push(printSection('Wide vs. narrow board breadth', breadthRows))

    carryTankGroups = computeCarryTankGroups(mod.LEARNED_UNIT_CONTEXT_BONUS)
  } catch (e) {
    console.log('\nComposition affinities — no data (phase skipped, or learnedCompositionAffinities.ts missing).')
  }

  const catalogEntries = loadCatalogEntries()
  const catalogTitle = new Map(catalogEntries.map(e => [e.id, e.title]))

  try {
    const catalogMod = await import(`${pathToFileURL(join(__dirname, 'learnedCatalogAffinities.ts')).href}?t=${Date.now()}`)
    const catalogRows = toRows(catalogMod.LEARNED_CATALOG_BONUS, COMP_PRIOR_TOTAL, key => {
      const stage = key.slice(0, key.indexOf('|'))
      const entryId = key.slice(key.indexOf('|') + 1)
      return `stage ${stage}: ${catalogTitle.get(entryId) ?? entryId}`
    })
    sections.push(printSection('Catalog entries (docs/compositions.json), verified by self-play', catalogRows))
  } catch (e) {
    console.log('\nCatalog affinities — no data (phase skipped, or learnedCatalogAffinities.ts missing).')
  }

  const catalogHtml = renderCatalogSection(catalogEntries)
  const carryTankHtml = renderCarryTankSection(carryTankGroups)

  console.log('\n(Full detail, including this-run observational win rates for every unit and')
  console.log(' trait pair, is available via `npm run sim-bots` — see the HTML report it writes.)')
  console.log('\n(Item choice is not trained — see src/econ/preferredItems.ts.)')

  let summary: string | null = null
  let catalogSummary: string | null = null
  let carryTankSummary: string | null = null
  if (hasFlag('ai-summary')) {
    console.log('\n━━━ Asking `claude` for plain-English summaries… ━━━')
    const prompt = buildSummaryPrompt(
      'Below is raw data from an automated self-play training run for an autobattler game\'s bot AI — ' +
      'learned unit/trait compositions, discovered through repeated simulated games.',
      sections,
    )
    summary = generateAiSummary(prompt)
    if (summary) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('  AI summary — overall')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(summary)
    }

    const catPrompt = buildCatalogAiPrompt(catalogEntries)
    if (catPrompt) {
      catalogSummary = generateAiSummary(catPrompt)
      if (catalogSummary) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('  AI summary — composition catalog')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(catalogSummary)
      }
    }

    const ctPrompt = buildCarryTankAiPrompt(carryTankGroups)
    if (ctPrompt) {
      carryTankSummary = generateAiSummary(ctPrompt)
      if (carryTankSummary) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('  AI summary — preferred carries & tanks')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(carryTankSummary)
      }
    }
  }

  writeHtmlReport(sections, summary, catalogHtml, carryTankHtml, catalogSummary, carryTankSummary)
}

// ─── Targeted AI-summary prompts (only sent under --ai-summary) ─────────────
// Separate, focused prompts per section — rather than one giant summary at the
// top, each gets its own short callout placed right next to its data, so the
// narrative next to the composition catalog is actually ABOUT the catalog,
// not a generic blend of everything.
function buildCatalogAiPrompt(entries: CatalogEntry[]): string | null {
  const discovered = entries.filter(e => e.source === 'training').sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
  const tried = entries.filter(e => (e.measuredWinRate ?? e.winRate) !== undefined)
    .sort((a, b) => (b.measuredWinRate ?? b.winRate ?? 0) - (a.measuredWinRate ?? a.winRate ?? 0))
  if (discovered.length === 0 && tried.length === 0) return null

  const lines: string[] = [
    'Below is data from an autobattler game\'s composition catalog (docs/compositions.json) — a hand-derived reference ' +
    'of viable team compositions, now being verified and grown by self-play training.',
    'Write a concise, plain-English summary (under 200 words) of what this run found: call out any standout newly-discovered ' +
    'trait pairings by name, and which hand-derived catalog entries are winning most/least. Weigh higher sample counts as more trustworthy.',
    '',
  ]
  if (discovered.length) {
    lines.push('Newly discovered trait pairings (not previously in the catalog):')
    for (const e of discovered.slice(0, 10)) lines.push(`- ${e.title}: ${((e.winRate ?? 0) * 100).toFixed(0)}% win rate (${e.samples} samples)`)
    lines.push('')
  }
  if (tried.length) {
    lines.push('Best-performing tried catalog entries:')
    for (const e of tried.slice(0, 10)) lines.push(`- ${e.title}: ${((e.measuredWinRate ?? e.winRate ?? 0) * 100).toFixed(0)}% win rate (${e.measuredSamples ?? e.samples} samples)`)
    lines.push('Worst-performing tried catalog entries:')
    for (const e of tried.slice(-10).reverse()) lines.push(`- ${e.title}: ${((e.measuredWinRate ?? e.winRate ?? 0) * 100).toFixed(0)}% win rate (${e.measuredSamples ?? e.samples} samples)`)
  }
  return lines.join('\n')
}

function buildCarryTankAiPrompt(groups: CarryTankGroup[]): string | null {
  if (groups.length === 0) return null
  const lines: string[] = [
    'Below is data on which specific units end up as the preferred carry vs. tank for various trait-direction team ' +
    'compositions in an autobattler game, measured from self-play training. Every unit listed genuinely carries the named trait(s).',
    'Write a concise, plain-English summary (under 200 words) of the clearest patterns — which units are the go-to carry or ' +
    'tank for which comp directions, and note any close contest between two options worth flagging.',
    '',
  ]
  for (const g of groups.slice(0, 20)) {
    lines.push(`Stage ${g.stage}: ${g.sigLabel}`)
    if (g.carries.length) lines.push(`  Carries: ${g.carries.map(c => `${unitName(c.unitId)} ${(c.mean * 100).toFixed(0)}% (${c.samples} samples)`).join(', ')}`)
    if (g.tanks.length) lines.push(`  Tanks: ${g.tanks.map(c => `${unitName(c.unitId)} ${(c.mean * 100).toFixed(0)}% (${c.samples} samples)`).join(', ')}`)
  }
  return lines.join('\n')
}

// ─── HTML report ────────────────────────────────────────────────────────────
// Always written (with or without --ai-summary) so a run's results are easy
// to view in a browser, not just scroll back through terminal output.

function reportFilename(): string {
  const d = new Date()
  const M = d.getMonth() + 1
  const D = d.getDate()
  const YY = d.getFullYear() % 100
  const HH = String(d.getHours()).padStart(2, '0')
  const MM = String(d.getMinutes()).padStart(2, '0')
  return `${M}.${D}.${YY}_${HH}:${MM}_report.html`
}

// ─── Preferred carries & tanks by composition ─────────────────────────────
// Regroups the free-discovery bandit's unit-in-context data (already keyed
// `stage|unitId|boardTraitSignature` — see compositionSignature.ts) by
// stage+signature, then splits each group by the unit's real role (from
// src/data/units.ts) into carries vs. tanks, ranked by win rate. Answers
// "for this trait direction, which specific unit ended up being the
// preferred carry/tank."
//
// IMPORTANT: LEARNED_UNIT_CONTEXT_BONUS deliberately records a unit's win
// rate when splashed onto a board with that signature REGARDLESS of whether
// the unit shares the signature's trait (see bots.ts's learnedCompBonus doc
// comment — that's the point of that table, catching pure splash value). A
// naive group-by would therefore list units with NO relation to the named
// trait(s) under it — e.g. Excadrill (Cave Crawler/Corkscrew) showing up
// under "Spellweaver" just because it once splashed well onto a Spellweaver
// board. Filtered here to units whose OWN types actually intersect the
// signature's trait(s), so "preferred carry of X" means what it says.
interface CtxSample { stage: string; unitId: string; signature: string; mean: number; samples: number }
interface CarryTankGroup { stage: string; signature: string; sigLabel: string; carries: CtxSample[]; tanks: CtxSample[] }

function computeCarryTankGroups(table: Record<string, { alpha: number; beta: number }>): CarryTankGroup[] {
  const rows: CtxSample[] = Object.entries(table)
    .map(([key, a]) => {
      const [stage, unitId, signature] = key.split('|')
      return { stage, unitId, signature, mean: a.alpha / (a.alpha + a.beta), samples: a.alpha + a.beta - 4 }
    })
    .filter(r => r.samples >= MIN_SAMPLES && r.signature)
    // In-trait only: this unit must actually carry ≥1 of the signature's traits.
    .filter(r => {
      const sigTraits = new Set(r.signature.split('+'))
      return (UNIT_MAP.get(r.unitId)?.types ?? []).some(t => sigTraits.has(t))
    })

  const grouped = new Map<string, CtxSample[]>()
  for (const r of rows) { const k = `${r.stage}|${r.signature}`; const g = grouped.get(k) ?? []; g.push(r); grouped.set(k, g) }

  return [...grouped.entries()]
    .filter(([, rs]) => rs.length >= 2)
    .sort((a, b) => b[1].reduce((s, r) => s + r.samples, 0) - a[1].reduce((s, r) => s + r.samples, 0))
    .slice(0, 40)
    .map(([key, rs]) => {
      const [stage, signature] = key.split('|')
      return {
        stage, signature, sigLabel: signature.split('+').map(traitName).join(' + '),
        carries: rs.filter(r => UNIT_MAP.get(r.unitId)?.role !== 'tank').sort((a, b) => b.mean - a.mean).slice(0, 5),
        tanks: rs.filter(r => UNIT_MAP.get(r.unitId)?.role === 'tank').sort((a, b) => b.mean - a.mean).slice(0, 5),
      }
    })
}

function renderCarryTankSection(groups: CarryTankGroup[]): string {
  if (groups.length === 0) return ''
  const unitRow = (list: CtxSample[]) => list.length
    ? list.map(r => `<span class="upick">${spriteImg(r.unitId, 36)}<span class="upick-name">${escHtml(unitName(r.unitId))}</span><span class="upick-wr">${(r.mean * 100).toFixed(0)}% <span class="mut">(${r.samples})</span></span></span>`).join('')
    : '<span class="mut">none tested</span>'
  const cards = groups.map(g => `<div class="ctcard"><div class="ctcard-h">Stage ${escHtml(g.stage)}: ${escHtml(g.sigLabel)}</div>
    <div class="ctcard-b">
      <div class="ctcol"><h4>Preferred carries</h4><div class="upicks">${unitRow(g.carries)}</div></div>
      <div class="ctcol"><h4>Preferred tanks</h4><div class="upicks">${unitRow(g.tanks)}</div></div>
    </div></div>`).join('')

  return `<h2>Preferred carries &amp; tanks, by composition</h2>
    <p class="sub">For every stage + trait-direction with 2+ tested IN-TRAIT units (units that actually carry that trait), which one won most often — split by role. ${MIN_SAMPLES}+ samples per unit. Off-trait splash picks (a unit that does well added to this board without sharing its traits) aren't shown here — see "Unit splashed onto an established comp" below for those.</p>
    <div class="ctgrid">${cards}</div>`
}

// ─── Composition catalog: clickable, sprite-bearing, filterable ──────────────
// Reads docs/compositions.json fresh (post Phase D) so this always reflects
// what's actually on disk: every hand-derived entry PLUS every
// training-discovered one, each showing whether it's been tried in self-play
// (measuredWinRate/measuredSamples, written by growCatalog.ts) and — for
// discovered entries — when it was first added.
interface CatalogEntry {
  id: string; title: string; summary: string
  coreUnitIds?: string[]; source?: string; addedAt?: string
  measuredWinRate?: number; measuredSamples?: number
  winRate?: number; samples?: number
  carriersA?: { id: string }[]; carriersB?: { id: string }[]
}
function catalogCategory(id: string): string {
  if (id.startsWith('discovered|')) return 'Discovered'
  if (id.startsWith('reroll|')) return id.includes('|var|') ? 'Reroll variation' : 'Reroll core'
  if (id.startsWith('cluster|')) return 'High-cost cluster'
  if (id.startsWith('carry|')) return id.includes('|var|') ? 'Carry variation' : 'High-cost carry'
  if (id.startsWith('tank|')) return id.includes('|pairing|') ? 'Tank pairing' : 'High-cost tank'
  return 'Entry'
}
function loadCatalogEntries(): CatalogEntry[] {
  let data: Record<string, unknown>
  try { data = JSON.parse(readFileSync(join(REPO_ROOT, 'docs/compositions.json'), 'utf-8')) }
  catch { return [] }

  const entries: CatalogEntry[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) walk(n); return }
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (typeof o.id === 'string' && typeof o.title === 'string') entries.push(o as unknown as CatalogEntry)
      for (const k in o) walk(o[k])
    }
  }
  walk(data.part1RerollComps)
  walk(data.part2LevelingComps)
  walk(data.discoveredPairings)
  return entries
}

// Every unit an entry actually touches — coreUnitIds for hand-derived
// entries, both traits' carrier lists for discovered pairings — NOT capped to
// the 5 shown as sprites, so trait/cost filtering sees the full picture.
function catalogEntryUnitIds(e: CatalogEntry): string[] {
  return e.coreUnitIds && e.coreUnitIds.length
    ? e.coreUnitIds
    : [...(e.carriersA ?? []), ...(e.carriersB ?? [])].map(u => u.id)
}

function renderCatalogSection(entries: CatalogEntry[]): string {
  if (entries.length === 0) return ''

  const cats = [...new Set(entries.map(e => catalogCategory(e.id)))].sort()
  const catOptions = ['<option value="all">All categories</option>', ...cats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`)].join('')

  const allTraits = new Set<string>()
  const allCosts = new Set<number>()

  const cards = entries.map(e => {
    const unitIds = catalogEntryUnitIds(e)
    const traits = [...new Set(unitIds.flatMap(id => UNIT_MAP.get(id)?.types ?? []))]
    const costs = [...new Set(unitIds.map(id => UNIT_MAP.get(id)?.cost).filter((c): c is number => c !== undefined))]
    for (const t of traits) allTraits.add(t)
    for (const c of costs) allCosts.add(c)

    const spriteIds = unitIds.slice(0, 5)
    const wr = e.measuredWinRate ?? e.winRate
    const n = e.measuredSamples ?? e.samples
    const tried = wr !== undefined && n !== undefined
    const isNew = e.source === 'training'
    const cat = catalogCategory(e.id)
    const wrBadge = tried
      ? `<span class="badge ${wr! >= 0.55 ? 'good' : wr! <= 0.45 ? 'bad' : 'mid'}">${(wr! * 100).toFixed(0)}% <span class="mut">(${n})</span></span>`
      : '<span class="badge untried">not yet tried</span>'
    const newBadge = isNew ? `<span class="badge new">discovered${e.addedAt ? ' ' + new Date(e.addedAt).toLocaleDateString() : ''}</span>` : ''
    return `<details class="ccard" data-cat="${escHtml(cat)}" data-tried="${tried ? 1 : 0}" data-new="${isNew ? 1 : 0}" data-q="${escHtml(e.title.toLowerCase())}" data-traits="${traits.join(' ')}" data-costs="${costs.join(' ')}" data-wr="${tried ? Math.round(wr! * 100) : -1}">
      <summary>
        <span class="ccard-sprites">${spriteIds.map(id => spriteImg(id, 36)).join('') || '<span class="mut">—</span>'}</span>
        <span class="ccard-title">${escHtml(e.title)}</span>
        <span class="ccard-cat">${escHtml(cat)}</span>
        <span class="ccard-badges">${wrBadge}${newBadge}</span>
      </summary>
      <p>${escHtml(e.summary)}</p>
    </details>`
  }).join('')

  const triedCount = entries.filter(e => (e.measuredWinRate ?? e.winRate) !== undefined).length
  const newCount = entries.filter(e => e.source === 'training').length

  const traitOptions = ['<option value="all">All traits</option>',
    ...[...allTraits].sort((a, b) => traitName(a).localeCompare(traitName(b))).map(t => `<option value="${escHtml(t)}">${escHtml(traitName(t))}</option>`)].join('')
  const costChips = [...allCosts].sort((a, b) => a - b)
    .map(c => `<button class="chip cc-cost" data-cost="${c}">${c}c</button>`).join('')
  const winrateOptions = [0, 50, 55, 60, 65, 70, 75].map(v =>
    `<option value="${v}">${v === 0 ? 'Any win rate' : `${v}%+`}</option>`).join('')

  return `<h2>Composition catalog (docs/compositions.json)</h2>
    <p class="sub">${entries.length} entries · ${triedCount} tried in self-play (Phase C) · ${newCount} discovered by training (Phase D). Click an entry for the full write-up.</p>
    <div class="ccctl">
      <input class="cc-search" type="text" placeholder="Search titles…">
      <select class="cc-cat">${catOptions}</select>
      <select class="cc-trait">${traitOptions}</select>
      <select class="cc-minwr">${winrateOptions}</select>
      <span class="ccctl-grp">
        <button class="chip cc-cost is-on" data-cost="all">All costs</button>
        ${costChips}
      </span>
      <span class="ccctl-grp">
        <button class="chip cc-status is-on" data-status="all">All</button>
        <button class="chip cc-status" data-status="tried">Tried</button>
        <button class="chip cc-status" data-status="untried">Not yet tried</button>
        <button class="chip cc-status" data-status="new">Discovered by training</button>
      </span>
      <span class="ccctl-grp">
        <button class="chip cc-sort" data-sort="wr">Sort: win rate <span class="cc-sort-arw"></span></button>
      </span>
      <span class="cc-count mut"></span>
    </div>
    <div class="ccgrid">${cards}</div>`
}

// A function (not a top-level const) — this file runs `await printReport()`
// at module top level, and a const declared further down in the file would
// still be in its temporal-dead-zone at that point; function declarations are
// hoisted, so this is callable regardless of where printReport()'s call chain
// reaches it from.
function catalogFilterScript(): string {
  return `<script>
(function(){
  var grid = document.querySelector('.ccgrid');
  if(!grid) return;
  var cards = [].slice.call(grid.querySelectorAll('.ccard'));
  var catSel = document.querySelector('.cc-cat');
  var traitSel = document.querySelector('.cc-trait');
  var minWrSel = document.querySelector('.cc-minwr');
  var search = document.querySelector('.cc-search');
  var statusBtns = [].slice.call(document.querySelectorAll('.cc-status'));
  var costBtns = [].slice.call(document.querySelectorAll('.cc-cost'));
  var sortBtn = document.querySelector('.cc-sort');
  var countEl = document.querySelector('.cc-count');
  var status = 'all';
  var cost = 'all';
  var sortDir = null;   // null = document order · 'desc' · 'asc'

  statusBtns.forEach(function(b){
    b.addEventListener('click', function(){
      statusBtns.forEach(function(x){ x.classList.remove('is-on'); });
      b.classList.add('is-on'); status = b.dataset.status; apply();
    });
  });
  costBtns.forEach(function(b){
    b.addEventListener('click', function(){
      costBtns.forEach(function(x){ x.classList.remove('is-on'); });
      b.classList.add('is-on'); cost = b.dataset.cost; apply();
    });
  });
  if (sortBtn) sortBtn.addEventListener('click', function(){
    sortDir = sortDir === 'desc' ? 'asc' : sortDir === 'asc' ? null : 'desc';
    var arw = sortBtn.querySelector('.cc-sort-arw');
    if (arw) arw.textContent = sortDir === 'desc' ? '▼' : sortDir === 'asc' ? '▲' : '';
    sortBtn.classList.toggle('is-on', sortDir !== null);
    apply();
  });
  if (catSel) catSel.addEventListener('change', apply);
  if (traitSel) traitSel.addEventListener('change', apply);
  if (minWrSel) minWrSel.addEventListener('change', apply);
  if (search) search.addEventListener('input', apply);

  function apply(){
    var cat = catSel ? catSel.value : 'all';
    var trait = traitSel ? traitSel.value : 'all';
    var minWr = minWrSel ? parseInt(minWrSel.value, 10) : 0;
    var q = search ? search.value.toLowerCase().trim() : '';
    var shown = 0;
    cards.forEach(function(c){
      var ok = true;
      if (cat !== 'all' && c.dataset.cat !== cat) ok = false;
      if (trait !== 'all' && (' ' + c.dataset.traits + ' ').indexOf(' ' + trait + ' ') === -1) ok = false;
      if (cost !== 'all' && (' ' + c.dataset.costs + ' ').indexOf(' ' + cost + ' ') === -1) ok = false;
      if (minWr > 0 && parseInt(c.dataset.wr, 10) < minWr) ok = false;
      if (status === 'tried' && c.dataset.tried !== '1') ok = false;
      if (status === 'untried' && c.dataset.tried === '1') ok = false;
      if (status === 'new' && c.dataset.new !== '1') ok = false;
      if (q && c.dataset.q.indexOf(q) === -1) ok = false;
      c.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (sortDir) {
      var sorted = cards.slice().sort(function(a, b){
        var av = parseInt(a.dataset.wr, 10), bv = parseInt(b.dataset.wr, 10);
        if (av === -1) av = sortDir === 'desc' ? -1000 : 1000;
        if (bv === -1) bv = sortDir === 'desc' ? -1000 : 1000;
        return sortDir === 'desc' ? bv - av : av - bv;
      });
      sorted.forEach(function(c){ grid.appendChild(c); });
    }
    if (countEl) countEl.textContent = shown + ' / ' + cards.length;
  }
  apply();
})();
</script>`
}

// A titled callout box — used for the overall AI summary plus the two
// section-specific ones, each dropped in right next to the data it narrates.
function aiCallout(title: string, text: string | null): string {
  if (!text) return ''
  return `<div class="callout"><div class="callout-h">${escHtml(title)}</div>${escHtml(text).split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>`
}

function renderTrainingReportHtml(sections: SummarySection[], summary: string | null, catalogHtml: string, carryTankHtml: string, catalogSummary: string | null, carryTankSummary: string | null): string {
  const rowsHtml = (rows: SummaryRow[]) => rows.map(r =>
    `<tr><td>${escHtml(r.label)}</td><td class="r">${(r.winRate * 100).toFixed(0)}%</td><td class="r">${r.samples}</td></tr>`).join('')
  const sectionsHtml = sections.map(s => {
    if (s.preferred.length === 0 && s.avoided.length === 0) return ''
    const tbl = (title: string, rows: SummaryRow[]) => rows.length ? `
      <h3>${title}</h3>
      <table><thead><tr><th>Combo</th><th class="r">Win rate</th><th class="r">Samples</th></tr></thead>
      <tbody>${rowsHtml(rows)}</tbody></table>` : ''
    return `<h2>${escHtml(s.title)}</h2>${tbl('Preferred', s.preferred)}${tbl('Avoided', s.avoided)}`
  }).join('')
  const summaryHtml = summary ? `<h2>AI summary — overall</h2>${aiCallout('Overall', summary)}` : ''
  const catalogSummaryHtml = aiCallout('What training found in the catalog', catalogSummary)
  const carryTankSummaryHtml = aiCallout('Carry & tank patterns', carryTankSummary)

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Bot Training Report</title>
<style>
  :root{color-scheme:light dark;--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e1e0d9;--accent:#2a78d6;--plane:#f2f2ef;--good:#1baf7a;--bad:#d1495b;--mid:#eda100}
  @media(prefers-color-scheme:dark){:root{--bg:#111110;--ink:#fff;--ink2:#c3c2b7;--grid:#2c2c2a;--accent:#3987e5;--plane:#1a1a19;--good:#199e70;--bad:#e05a6c;--mid:#c98500}}
  body{background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:1200px;margin:0 auto;padding:28px 20px 60px}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:17px;border-bottom:1px solid var(--grid);padding-bottom:5px;margin:30px 0 10px}
  h3{font-size:13.5px;color:var(--ink2);margin:16px 0 6px}
  h4{font-size:12px;color:var(--ink2);margin:0 0 6px;font-weight:600}
  table{width:100%;border-collapse:collapse;margin:4px 0 14px;font-size:13px}
  th,td{padding:5px 10px;border-bottom:1px solid var(--grid);text-align:left}
  th{color:var(--ink2);font-weight:600;font-size:12px}
  .r{text-align:right}
  .sub{color:var(--ink2);font-size:13px;margin:0 0 10px}
  .mut{color:var(--ink2)}
  .callout{background:var(--plane);border:1px solid var(--grid);border-left:3px solid var(--accent);border-radius:8px;padding:14px 18px;font-size:14.5px;margin:0 0 14px}
  .callout-h{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--accent);margin-bottom:8px}
  .callout p{margin:0 0 10px}.callout p:last-child{margin-bottom:0}
  .meta{color:var(--ink2);font-size:12.5px;margin:0 0 10px}
  .spr{display:inline-block;background-size:cover;background-position:center;border-radius:6px;background-color:var(--plane);vertical-align:middle;margin-right:2px}
  .spr.ph{background-color:var(--grid)}
  /* Composition catalog */
  .ccctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 14px}
  .ccctl input.cc-search{padding:5px 9px;border:1px solid var(--grid);border-radius:6px;background:var(--bg);color:var(--ink);font-size:12.5px;min-width:180px}
  .ccctl select{padding:5px 9px;border:1px solid var(--grid);border-radius:6px;background:var(--bg);color:var(--ink);font-size:12.5px}
  .ccctl-grp{display:inline-flex;gap:4px}
  .chip{border:1px solid var(--grid);background:var(--plane);color:var(--ink);border-radius:999px;padding:4px 10px;font-size:12px;cursor:pointer}
  .chip.is-on{background:var(--accent);border-color:var(--accent);color:#fff}
  .cc-sort-arw{margin-left:2px}
  .cc-count{font-size:12px;margin-left:auto}
  .ccgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;margin-bottom:10px}
  .ccard{border:1px solid var(--grid);border-radius:10px;padding:8px 10px;background:var(--plane)}
  .ccard summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .ccard summary::-webkit-details-marker{display:none}
  .ccard-sprites{display:inline-flex;flex-shrink:0}
  .ccard-title{font-size:13px;font-weight:600;flex:1;min-width:110px}
  .ccard-cat{font-size:10.5px;color:var(--ink2);border:1px solid var(--grid);border-radius:5px;padding:1px 5px}
  .ccard-badges{display:flex;gap:5px;flex-wrap:wrap}
  .badge{font-size:11px;border-radius:5px;padding:2px 6px;font-weight:600}
  .badge.good{background:color-mix(in srgb, var(--good) 22%, transparent);color:var(--good)}
  .badge.bad{background:color-mix(in srgb, var(--bad) 22%, transparent);color:var(--bad)}
  .badge.mid{background:color-mix(in srgb, var(--mid) 22%, transparent);color:var(--mid)}
  .badge.untried{background:var(--grid);color:var(--ink2)}
  .badge.new{background:color-mix(in srgb, var(--accent) 22%, transparent);color:var(--accent)}
  .ccard p{font-size:12.5px;color:var(--ink2);margin:8px 0 2px;line-height:1.5}
  /* Preferred carries & tanks */
  .ctgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px;margin-bottom:10px}
  .ctcard{border:1px solid var(--grid);border-radius:10px;padding:10px 12px;background:var(--plane)}
  .ctcard-h{font-size:12.5px;font-weight:600;margin-bottom:8px}
  .ctcard-b{display:flex;gap:14px}
  .ctcol{flex:1;min-width:0}
  .upicks{display:flex;flex-direction:column;gap:4px}
  .upick{display:flex;align-items:center;gap:6px;font-size:12px}
  .upick-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .upick-wr{font-weight:600;white-space:nowrap}
</style><style>${spriteCss()}</style></head>
<body>
  <h1>Bot Training Report</h1>
  <p class="meta">Generated ${escHtml(new Date().toString())}</p>
  ${summaryHtml}
  ${catalogHtml}
  ${catalogSummaryHtml}
  ${carryTankHtml}
  ${carryTankSummaryHtml}
  ${sectionsHtml}
${catalogFilterScript()}
</body></html>`
}

function writeHtmlReport(sections: SummarySection[], summary: string | null, catalogHtml: string, carryTankHtml: string, catalogSummary: string | null, carryTankSummary: string | null): void {
  const dir = join(REPO_ROOT, 'training_runs')
  mkdirSync(dir, { recursive: true })
  const outPath = join(dir, reportFilename())
  writeFileSync(outPath, renderTrainingReportHtml(sections, summary, catalogHtml, carryTankHtml, catalogSummary, carryTankSummary), 'utf-8')
  console.log(`\nWrote HTML report → ${outPath}`)
}
