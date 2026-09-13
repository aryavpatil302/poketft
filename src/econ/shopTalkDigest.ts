// Turns a bot-league LeagueReport (src/sim/leagueReport.ts) into grounded, plain-
// English facts for the shop-talk generation pipeline (see genShopTalk.ts). Pure
// function, no I/O — never reads `traceFights`/`traceRounds` (95% of the report's
// JSON weight, per-tick combat logs the LLM never needs) and tolerates every
// section being short or empty (measured: `shinySpecies` was empty at 3 games,
// several tables are min-5-sample gated and can legitimately have nothing pass).

import type { LeagueReport, UnitAggregate, LearnedAffinityRow, ShinyStageRow } from '../sim/leagueReport'
import { UNIT_MAP } from '../data/units'
import { TRAIT_MAP } from '../data/traits'

export interface Fact { id: string; section: string; text: string; samples: number }

// ─── Label helpers ──────────────────────────────────────────────────────────────
// Mirrors botLeague.ts lines 239-248 (pairLabel/ctxLabel/depthLabel/breadthKey/
// shiny labels) rather than importing from aiSummary.ts — that module belongs to
// the training pipeline, not this one, and the labels are tiny enough that
// duplicating them here is cheaper than coupling the two.
const unitName = (id: string): string => UNIT_MAP.get(id)?.name ?? id
const traitName = (id: string): string =>
  id.startsWith('shiny:') ? '✦ ' + (UNIT_MAP.get(id.slice(6))?.name ?? id.slice(6)) : (TRAIT_MAP.get(id)?.name ?? id)

const pairLabel = (key: string): string => {
  const [stage, a, b] = key.split('|')
  return `stage ${stage}: ${traitName(a)} + ${traitName(b)}`
}
const ctxLabel = (key: string): string => {
  const [stage, defId, sig] = key.split('|')
  return `stage ${stage}: ${unitName(defId)} onto ${sig.split('+').map(traitName).join(' + ')}`
}
const depthLabel = (key: string): string => {
  const [stage, trait, depth] = key.split('|')
  return `stage ${stage}: ${traitName(trait)} pushed to breakpoint ${depth}`
}
const breadthLabel = (key: string): string => {
  const [stage, count] = key.split('|')
  return `stage ${stage}: ${count} distinct active traits`
}
const shinyPresenceLabel = (key: string): string => {
  const [stage, label] = key.split('|')
  return `stage ${stage}: ${label === 'shiny' ? 'fielded a shiny' : 'no shiny fielded'}`
}
const shinySpeciesLabel = (key: string): string => {
  const [stage, defId] = key.split('|')
  return `stage ${stage}: shiny ${unitName(defId)}`
}

const pct = (x: number): string => `${(x * 100).toFixed(0)}%`
const round0 = (x: number): number => Math.round(x)

// ─── buildDigest ────────────────────────────────────────────────────────────────
export function buildDigest(r: LeagueReport): Fact[] {
  const facts: Fact[] = []
  let n = 0
  const push = (section: string, text: string, samples: number): void => {
    n++
    facts.push({ id: `F-${String(n).padStart(2, '0')}`, section, text, samples })
  }

  // standings — all 5 personas: win rate, top-2 rate, avg placement
  for (const s of r.standings ?? []) {
    push('standings', `${s.name} win rate: ${pct(s.winRate)} (${r.meta.games} samples)`, r.meta.games)
    push('standings', `${s.name} top-2 rate: ${pct(s.top2Rate)} (${r.meta.games} samples)`, r.meta.games)
    push('standings', `${s.name} avg placement: ${s.avgPlacement.toFixed(2)} (${r.meta.games} samples)`, r.meta.games)
  }

  // units-strong / units-weak — top/bottom 12 by winRate, gated on a minimum
  // sample size so a unit fielded twice can't dominate the ranking.
  const gate = Math.max(5, Math.round(r.meta.games / 2))
  const eligible = (r.units ?? []).filter(u => u.fields >= gate)
  const byWinRate = [...eligible].sort((a, b) => b.winRate - a.winRate)
  const unitLine = (u: UnitAggregate): string => {
    const def = UNIT_MAP.get(u.defId)
    const tag = def ? `${def.cost}-cost${def.role ? `, ${def.role}` : ''}` : 'unknown cost'
    return `${unitName(u.defId)} (${tag}) win rate ${pct(u.winRate)}: avg ${round0(u.avgDealt)} dmg dealt / ${round0(u.avgTaken)} dmg taken per fight, fielded ${u.fields}x`
  }
  for (const u of byWinRate.slice(0, 12)) push('units-strong', `${unitLine(u)} (${u.fields} samples)`, u.fields)
  for (const u of byWinRate.slice(-12).reverse()) push('units-weak', `${unitLine(u)} (${u.fields} samples)`, u.fields)

  // star-scaling — units whose perTier shows a >=15-point win-rate gap between
  // tier 1 and tier 3, both sides gated >=5 fields, max 8.
  const starScaling: { u: UnitAggregate; t1: UnitAggregate['perTier'][number]; t3: UnitAggregate['perTier'][number]; gap: number }[] = []
  for (const u of r.units ?? []) {
    const t1 = u.perTier.find(t => t.tier === 1)
    const t3 = u.perTier.find(t => t.tier === 3)
    if (!t1 || !t3 || t1.fields < 5 || t3.fields < 5) continue
    const gap = Math.abs(t3.winRate - t1.winRate)
    if (gap * 100 >= 15) starScaling.push({ u, t1, t3, gap })
  }
  starScaling.sort((a, b) => b.gap - a.gap)
  for (const { u, t1, t3 } of starScaling.slice(0, 8)) {
    const samples = t1.fields + t3.fields
    push('star-scaling', `${unitName(u.defId)}: tier 1 win rate ${pct(t1.winRate)} vs tier 3 win rate ${pct(t3.winRate)} (${samples} samples)`, samples)
  }

  // trait-pairs — top 10 + bottom 10
  const traitPairRow = (row: LearnedAffinityRow): string => `${pairLabel(row.key)} win rate: ${pct(row.winRate)} (${row.samples} samples)`
  for (const row of (r.traitPairs ?? []).slice(0, 10)) push('trait-pairs', traitPairRow(row), row.samples)
  for (const row of (r.traitPairs ?? []).slice(-10)) push('trait-pairs', traitPairRow(row), row.samples)

  // unit-context — top 8 + bottom 8
  const ctxRow = (row: LearnedAffinityRow): string => `${ctxLabel(row.key)} win rate: ${pct(row.winRate)} (${row.samples} samples)`
  for (const row of (r.unitContexts ?? []).slice(0, 8)) push('unit-context', ctxRow(row), row.samples)
  for (const row of (r.unitContexts ?? []).slice(-8)) push('unit-context', ctxRow(row), row.samples)

  // trait-depth — top 8 + bottom 8
  const depthRow = (row: LearnedAffinityRow): string => `${depthLabel(row.key)} win rate: ${pct(row.winRate)} (${row.samples} samples)`
  for (const row of (r.traitDepths ?? []).slice(0, 8)) push('trait-depth', depthRow(row), row.samples)
  for (const row of (r.traitDepths ?? []).slice(-8)) push('trait-depth', depthRow(row), row.samples)

  // board-breadth — all
  for (const row of r.breadths ?? []) push('board-breadth', `${breadthLabel(row.key)} win rate: ${pct(row.winRate)} (${row.samples} samples)`, row.samples)

  // shiny-presence — all
  for (const row of r.shinyPresence ?? []) push('shiny-presence', `${shinyPresenceLabel(row.key)} win rate: ${pct(row.winRate)} (${row.samples} samples)`, row.samples)

  // shiny-species — all (may be empty)
  for (const row of r.shinySpecies ?? []) push('shiny-species', `${shinySpeciesLabel(row.key)} win rate: ${pct(row.winRate)} (${row.samples} samples)`, row.samples)

  // shiny-impact — top 8 by dmg+heal+shield+mitigated
  const impactTotal = (row: LeagueReport['shinyImpact'][number]): number => row.dmg + row.heal + row.shield + row.mitigated
  const shinyImpact = [...(r.shinyImpact ?? [])].sort((a, b) => impactTotal(b) - impactTotal(a))
  for (const row of shinyImpact.slice(0, 8)) {
    push(
      'shiny-impact',
      `✦ ${unitName(row.defId)} combat contribution: dmg ${round0(row.dmg)}, heal ${round0(row.heal)}, shield ${round0(row.shield)}, mitigated ${round0(row.mitigated)} (${row.fights} samples)`,
      row.fights
    )
  }

  // shiny-by-stage — 10 rows with the largest |shiny.winRate - nonShiny.winRate|
  // where nonShiny exists and shiny.fields >= 5.
  const stageDelta = (row: ShinyStageRow): number | null => {
    if (!row.nonShiny || row.shiny.fields < 5) return null
    return Math.abs(row.shiny.winRate - row.nonShiny.winRate)
  }
  const shinyStage = (r.shinyStageStats ?? [])
    .map(row => ({ row, delta: stageDelta(row) }))
    .filter((x): x is { row: ShinyStageRow; delta: number } => x.delta !== null)
    .sort((a, b) => b.delta - a.delta)
  for (const { row } of shinyStage.slice(0, 10)) {
    const samples = row.shiny.fields + (row.nonShiny?.fields ?? 0)
    push(
      'shiny-by-stage',
      `shiny ${unitName(row.defId)} at stage ${row.stage}: ${pct(row.shiny.winRate)} vs ordinary ${pct((row.nonShiny as NonNullable<typeof row.nonShiny>).winRate)} (${row.shiny.fields} shiny / ${row.nonShiny?.fields ?? 0} ordinary samples)`,
      samples
    )
  }

  return facts
}

// ─── digestText ─────────────────────────────────────────────────────────────────
// Groups facts by section under "## <section>" headings, for embedding directly
// in the topic-plan prompt (see shopTalkPrompts.ts's buildTopicPlanPrompt).
export function digestText(facts: Fact[]): string {
  const bySection = new Map<string, Fact[]>()
  for (const f of facts) {
    if (!bySection.has(f.section)) bySection.set(f.section, [])
    bySection.get(f.section)!.push(f)
  }
  const lines: string[] = []
  for (const [section, rows] of bySection) {
    lines.push(`## ${section}`)
    for (const f of rows) lines.push(`${f.id}. ${f.text}`)
    lines.push('')
  }
  return lines.join('\n')
}
