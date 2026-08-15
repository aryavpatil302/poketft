// Self-contained, navigable HTML report for the bot league (src/sim/botLeague.ts).
// A single portable file: a hash-router turns it into a multi-page report you can
// click through — Overview → a Round → a Unit → back — with inline SVG charts,
// text tables, and real unit sprites / item icons embedded as data-URIs (read from
// public/visuals/…). Theme-aware; palette + marks follow the dataviz skill.

import { UNIT_MAP } from '../data/units'
import { ITEM_MAP } from '../data/items'
import { TRAIT_MAP } from '../data/traits'
import { stageLabel } from '../econ/constants'
import { makeUnit } from '../core/unitFactory'
import { unitSprite, itemIcon, unitName } from './reportAssets'

// Star-scaled base stats beside the sprite (HP & Attack scale per star, shown 1★/2★/3★).
function baseStatStrip(defId: string): string {
  const def = UNIT_MAP.get(defId)
  if (!def) return ''
  const b = def.baseStats
  const hp: number[] = [], atk: number[] = []
  for (let t = 1; t <= 3; t++) { try { const un = makeUnit(defId, 'player', t as 1 | 2 | 3); hp.push(un.maxHp); atk.push(un.attack) } catch { /* skip */ } }
  const bs = (k: string, v: string): string => `<span class="bs"><span class="bk">${k}</span><span class="bv">${v}</span></span>`
  return `<div class="bstats">
    ${bs('HP', hp.join(' / '))}${bs('ATK', atk.join(' / '))}
    ${bs('SP', String(b.special))}${bs('DEF', String(b.defense))}${bs('SP.DEF', String(b.spDefense))}
    ${bs('ATK SPD', b.attackSpeed.toFixed(2))}${bs('RANGE', String(b.range))}${bs('MANA', `${b.startMana}/${b.maxMana}`)}
  </div>`
}

// ─── Report data shapes (built by botLeague.ts) ───────────────────────────────
export interface Standing {
  persona: string; name: string
  winRate: number; top2Rate: number; avgPlacement: number
  placementDist: number[]; avgFinalHp: number; avgElimRound: number
}
export interface TraceRound {
  game: number
  round: number
  bots: {
    persona: string; name: string
    hp: number; gold: number; level: number; streak: number
    power: number; units: number; eliminated: boolean
    traits: { trait: string; count: number; level: number }[]
    board: { defId: string; tier: number; item?: string }[]
  }[]
}
export interface UnitFightLog {
  defId: string; name: string; team: 'a' | 'b'; tier: 1 | 2 | 3; item?: string
  dealt: { t: number; a: number; dt: number; s: number; g: string; gd: string; ab: string; k: number }[]   // dt 0 phys/1 magic/2 true · s 0 auto/1 spell/2 emp · gd target defId · ab how dealt · k killed
  taken: { t: number; a: number; dt: number; s: number; g: string; gd: string; ab: string; d: number }[]   // g/gd = attacker name/defId · ab how · d this unit died
  cast: number[]                                                                    // cast times (seconds)
  heal: { t: number; a: number; g: string; self: number }[]
  shield: { t: number; a: number; g: string; self: number }[]
  absorb: { t: number; a: number }[]                                                // damage absorbed by this unit's shields
  traitDmg: Record<string, number>                                                  // trait id → damage its traits added, this fight
  traitHeal: Record<string, number>
  traitShield: Record<string, number>
  traitMitigated: Record<string, number>                                            // incoming damage its traits reduced/absorbed
  traitCount: Record<string, number>                                                // discrete events (e.g. Sky Striker executes)
}
export interface FightTrace {
  game: number; round: number; aName: string; bName: string
  winner: 'a' | 'b' | 'draw'; durationSec: number; seconds: number
  perUnit: { defId: string; unit: string; team: 'a' | 'b'; dealt: number; taken: number }[]
  series:  { defId: string; unit: string; team: 'a' | 'b'; points: number[] }[]
  kills:   { sec: number; victim: string; victimDef: string; killer: string; killerDef: string; ability: string }[]
  logs:    UnitFightLog[]
}
export interface UnitAggregate {
  defId: string
  fields: number          // total times fielded in a fight (all star levels)
  winRate: number         // fraction of those fights the unit's board won
  avgDealt: number        // per-fight, across all star levels (for archetype coloring)
  avgTaken: number
  avgHealSelf: number; avgHealAlly: number
  avgShieldSelf: number; avgShieldAlly: number
  dealtBreak: { phys: number; magic: number; trueDmg: number; auto: number; spell: number; emp: number }
  takenBreak: { phys: number; magic: number; trueDmg: number; auto: number; spell: number; shield: number }
  // Per-trait contribution, averaged per fight: how much dmg/heal/shield each of the
  // unit's traits added, damage it reduced/absorbed (mitigated), and event counts.
  traitContrib: Record<string, { dmg: number; heal: number; shield: number; mitigated: number; count: number }>
  perTier: {
    tier: 1 | 2 | 3; fields: number; winRate: number
    avgDealt: number; avgTaken: number; avgCasts: number; avgKills: number; avgDeaths: number
    avgHealSelf: number; avgHealAlly: number; avgShieldSelf: number; avgShieldAlly: number
  }[]
}
// One row of the learned-affinity report tables (src/econ/itemAffinity.ts,
// src/econ/compositionSignature.ts) — a human-readable, sample-count-gated
// view into what the bandit layer has actually learned so far.
export interface LearnedAffinityRow { key: string; winRate: number; samples: number }

export interface LeagueReport {
  meta: { games: number; rounds: number; seed: number; generatedAt: string }
  personaOrder: string[]
  personaNames: Record<string, string>
  standings: Standing[]
  survival: { rounds: number[]; avgAlive: number[] }
  h2h: (number | null)[][]
  units: UnitAggregate[]
  traceRounds: TraceRound[]
  traceFights: FightTrace[]
  // Composition-discovery observability (this run only — see
  // src/econ/trainCompositionAffinities.ts for what actually trains the
  // shipped learned-affinity file). Every key is "stage|..." (see
  // compositionSignature.ts). Empty arrays if nothing met the sample
  // threshold this run.
  traitPairs: LearnedAffinityRow[]
  unitContexts: LearnedAffinityRow[]
  traitDepths: LearnedAffinityRow[]   // stage|trait|depth
  breadths: LearnedAffinityRow[]      // stage|activeTraitCount
  // Optional plain-English summary of this run's findings, generated by the
  // `claude` CLI when botLeague.ts is run with --ai-summary (see
  // src/econ/aiSummary.ts). Absent when that flag isn't passed.
  aiSummary?: string
}

// Categorical persona hues (dataviz validated default, fixed order) — light / dark.
const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
const SERIES_DARK  = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']
const ORD_LIGHT = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6']
const ORD_DARK  = ['#3987e5', '#256abf', '#184f95', '#12386e', '#0d2a52']

const esc = (s: string): string => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const pct = (x: number): string => `${(x * 100).toFixed(0)}%`

// ─── Asset embedding: /visuals/… → data URI (see reportAssets.ts) ────────────
const traitName  = (id: string): string => TRAIT_MAP.get(id)?.name ?? id

// Each sprite/icon is inlined ONCE as a CSS-class background (see spriteCss); marks
// reference it by class, so a data-URI never repeats across the file.
const usedSprites = new Set<string>()
const usedItems = new Set<string>()
function spriteImg(defId: string, size: number): string {
  if (unitSprite(defId)) { usedSprites.add(defId); return `<span class="spr us-${defId}" style="width:${size}px;height:${size}px" title="${esc(unitName(defId))}"></span>` }
  return `<span class="spr ph" style="width:${size}px;height:${size}px" title="${esc(unitName(defId))}"></span>`
}
function itemImg(itemId: string, size: number): string {
  const nm = ITEM_MAP.get(itemId)?.name ?? itemId
  if (itemIcon(itemId)) { usedItems.add(itemId); return `<span class="itm ii-${itemId}" style="width:${size}px;height:${size}px" title="${esc(nm)}"></span>` }
  return ''
}
function spriteCss(): string {
  let css = ''
  for (const id of usedSprites) { const u = unitSprite(id); if (u) css += `.us-${id}{background-image:url("${u}")}` }
  for (const id of usedItems) { const u = itemIcon(id); if (u) css += `.ii-${id}{background-image:url("${u}")}` }
  return css
}
const unitLink = (defId: string, inner: string): string => `<a class="ulink" href="#/unit/${defId}">${inner}</a>`

// ─── SVG chart primitives (unchanged core) ────────────────────────────────────
function barsH(rows: { label: string; value: number; colorIdx: number }[], fmt: (v: number) => string): string {
  const W = 620, rowH = 26, padL = 150, padR = 60, top = 8
  const H = top * 2 + rows.length * rowH
  const max = Math.max(1, ...rows.map(r => r.value))
  const bw = W - padL - padR
  const bars = rows.map((r, i) => {
    const y = top + i * rowH, w = Math.max(2, (r.value / max) * bw)
    return `<text x="${padL - 8}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="central" class="lbl">${esc(r.label)}</text>
      <rect x="${padL}" y="${y + 5}" width="${w}" height="${rowH - 12}" rx="4" fill="var(--s${r.colorIdx})"/>
      <text x="${padL + w + 6}" y="${y + rowH / 2}" dominant-baseline="central" class="val">${fmt(r.value)}</text>`
  }).join('')
  return svg(W, H, bars)
}
function stackedH(rows: { label: string; segs: number[] }[]): string {
  const W = 620, rowH = 28, padL = 150, padR = 20, top = 8
  const H = top * 2 + rows.length * rowH, bw = W - padL - padR
  const body = rows.map((r, i) => {
    const total = Math.max(1, r.segs.reduce((s, v) => s + v, 0)), y = top + i * rowH
    let x = padL
    const segs = r.segs.map((v, si) => {
      if (v <= 0) return ''
      const w = (v / total) * bw
      const rect = `<rect x="${x + (si ? 1 : 0)}" y="${y + 5}" width="${Math.max(0.5, w - 2)}" height="${rowH - 12}" fill="var(--ord${si + 1})"/>` +
        (w > 22 ? `<text x="${x + w / 2}" y="${y + rowH / 2}" text-anchor="middle" dominant-baseline="central" class="seg">${v}</text>` : '')
      x += w
      return rect
    }).join('')
    return `<text x="${padL - 8}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="central" class="lbl">${esc(r.label)}</text>${segs}`
  }).join('')
  return svg(W, H, body)
}
function lineChart(series: { name: string; points: (number | null)[]; colorIdx: number }[], xVals: (number | string)[], fmtY: (v: number) => string, yMin = 0): string {
  const W = 680, H = 300, padL = 52, padR = 110, padT = 14, padB = 28
  const flat = series.flatMap(s => s.points.filter((p): p is number => p != null))
  const yMax = Math.max(1, ...flat), n = xVals.length
  const px = (i: number): number => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR))
  const py = (v: number): number => (H - padB) - ((v - yMin) / (yMax - yMin || 1)) * (H - padT - padB)
  let grid = ''
  for (let g = 0; g <= 4; g++) { const v = yMin + (g / 4) * (yMax - yMin), y = py(v); grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid"/><text x="${padL - 6}" y="${y}" text-anchor="end" dominant-baseline="central" class="tick">${fmtY(v)}</text>` }
  let xticks = ''
  for (let i = 0; i < n; i++) { if (n > 10 && i % Math.ceil(n / 8) !== 0 && i !== n - 1) continue; xticks += `<text x="${px(i)}" y="${H - padB + 14}" text-anchor="middle" class="tick">${xVals[i]}</text>` }
  const lines = series.map(s => {
    let d = '', started = false
    s.points.forEach((v, i) => { if (v == null) { started = false; return } const c = `${px(i)},${py(v)}`; d += started ? ` L${c}` : `${d ? ' ' : ''}M${c}`; started = true })
    let lastI = -1
    for (let i = s.points.length - 1; i >= 0; i--) if (s.points[i] != null) { lastI = i; break }
    const lbl = lastI >= 0 ? `<text x="${px(lastI) + 6}" y="${py(s.points[lastI] as number)}" dominant-baseline="central" class="end" fill="var(--s${s.colorIdx})">${esc(s.name)}</text>` : ''
    return `<path d="${d}" fill="none" stroke="var(--s${s.colorIdx})" stroke-width="2" stroke-linejoin="round"/>${lbl}`
  }).join('')
  return svg(W, H, `${grid}<line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" class="axis"/>${xticks}${lines}`)
}
function svg(w: number, h: number, body: string): string {
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="xMinYMin meet" role="img">${body}</svg>`
}
function legend(items: { name: string; colorIdx: number }[]): string {
  return `<div class="legend">${items.map(i => `<span class="lg"><span class="sw" style="background:var(--s${i.colorIdx})"></span>${esc(i.name)}</span>`).join('')}</div>`
}
function table(headers: string[], rows: string[][], right: boolean[] = []): string {
  const th = headers.map((h, i) => `<th class="${right[i] ? 'r' : ''}">${esc(h)}</th>`).join('')
  const trs = rows.map(r => `<tr>${r.map((c, i) => `<td class="${right[i] ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
}
function placeOrdLegend(): string {
  return `<div class="legend">${['1st', '2nd', '3rd', '4th', '5th'].map((n, i) => `<span class="lg"><span class="sw" style="background:var(--ord${i + 1})"></span>${n}</span>`).join('')}</div>`
}

// ─── Archetype coloring: rate a unit's damage against same-cost, same-role peers ─
// Archetype = cost + {tank | carry}, e.g. Snorunt → "1-cost tanks", Claydol → "3-cost carries".
const archOf    = (defId: string): string => { const d = UNIT_MAP.get(defId); return `${d?.cost ?? 0}-${d?.role === 'tank' ? 'tank' : 'carry'}` }
const archLabel = (defId: string): string => { const d = UNIT_MAP.get(defId); return `${d?.cost ?? 0}-cost ${d?.role === 'tank' ? 'tanks' : 'carries'}` }
const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / (xs.length || 1)
const std  = (xs: number[]): number => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) ** 2))) }
interface ArchStat { dMean: number; dStd: number; tMean: number; tStd: number }
function archetypeStats(units: UnitAggregate[]): Map<string, ArchStat> {
  const groups = new Map<string, UnitAggregate[]>()
  for (const u of units) { const k = archOf(u.defId); const g = groups.get(k) ?? []; g.push(u); groups.set(k, g) }
  const out = new Map<string, ArchStat>()
  for (const [k, us] of groups) out.set(k, { dMean: mean(us.map(u => u.avgDealt)), dStd: std(us.map(u => u.avgDealt)), tMean: mean(us.map(u => u.avgTaken)), tStd: std(us.map(u => u.avgTaken)) })
  return out
}
// green=notably better than archetype mean, red=worse, yellow=near. `higherBetter`
// flips it — for damage TAKEN, taking less than peers is the good (green) direction.
function heat(value: number, m: number, sd: number, higherBetter: boolean): string {
  let z = sd > 1e-9 ? (value - m) / sd : 0
  if (!higherBetter) z = -z
  const cls = z > 0.5 ? 'c-good' : z < -0.5 ? 'c-bad' : 'c-mid'
  const arw = z > 0.5 ? '▲' : z < -0.5 ? '▼' : '·'
  return `<span class="${cls}">${Math.round(value)} <span class="arw">${arw}</span></span>`
}

// ─── Report assembly ──────────────────────────────────────────────────────────
export function renderReportHtml(r: LeagueReport): string {
  usedSprites.clear(); usedItems.clear()
  const colorOf = (persona: string): number => r.personaOrder.indexOf(persona) + 1
  const nm = (id: string): string => r.personaNames[id] ?? id
  const arch = archetypeStats(r.units)

  // ── Per-unit-in-a-fight drill-down data (embedded JSON, rendered client-side) ──
  // ur maps "defId|game|round" → that unit's event log for that fight (+ a `fi` ref
  // into the compact fights[] array of cumulative series/meta). Every fielded unit
  // is guaranteed ≥1 entry (see botLeague's coverage tracing); to bound file size
  // we keep at most FIGHTS_PER_UNIT of each unit's busiest fights, and embed only
  // the fights those entries actually reference.
  const FIGHTS_PER_UNIT = 8
  const roundBotByName = new Map<string, Map<string, TraceRound['bots'][number]>>()
  for (const tr of r.traceRounds) {
    const m = new Map<string, TraceRound['bots'][number]>()
    for (const b of tr.bots) m.set(b.name, b)
    roundBotByName.set(`${tr.game}|${tr.round}`, m)
  }
  type URec = { _act: number; _def: string; fi: number; team: 'a' | 'b'; name: string; tier: number
    item: string | null; traits: { n: string; c: number; l: number }[]
    dealt: FightTrace['logs'][number]['dealt']; taken: FightTrace['logs'][number]['taken']
    cast: number[]; heal: FightTrace['logs'][number]['heal']; shield: FightTrace['logs'][number]['shield']
    absorb: FightTrace['logs'][number]['absorb']
    tc: { n: string; dmg: number; heal: number; shield: number; mit: number; cnt: number }[] }   // this-fight trait contributions
  const byKey: Record<string, URec> = {}
  r.traceFights.forEach((f, fi) => {
    for (const lg of f.logs) {
      const key = `${lg.defId}|${f.game}|${f.round}`
      const act = lg.dealt.length + lg.taken.length + lg.heal.length + lg.shield.length
      const prev = byKey[key]
      if (prev && prev._act >= act) continue   // keep the busiest instance of this unit that round
      const ownerName = lg.team === 'a' ? f.aName : f.bName
      const bot = roundBotByName.get(`${f.game}|${f.round}`)?.get(ownerName)
      const traits = (bot?.traits ?? []).map(t => ({ n: traitName(t.trait), c: t.count, l: t.level }))
      const tc = [...new Set([...Object.keys(lg.traitDmg), ...Object.keys(lg.traitHeal), ...Object.keys(lg.traitShield), ...Object.keys(lg.traitMitigated), ...Object.keys(lg.traitCount)])]
        .map(t => ({ n: traitName(t), dmg: lg.traitDmg[t] ?? 0, heal: lg.traitHeal[t] ?? 0, shield: lg.traitShield[t] ?? 0, mit: lg.traitMitigated[t] ?? 0, cnt: lg.traitCount[t] ?? 0 }))
        .filter(x => x.dmg + x.heal + x.shield + x.mit >= 1 || x.cnt >= 1)
        .sort((x, y) => (y.dmg + y.heal + y.shield + y.mit) - (x.dmg + x.heal + x.shield + x.mit))
      byKey[key] = {
        _act: act, _def: lg.defId, fi, team: lg.team, name: lg.name, tier: lg.tier,
        item: lg.item ? (ITEM_MAP.get(lg.item)?.name ?? lg.item) : null, traits,
        dealt: lg.dealt, taken: lg.taken, cast: lg.cast, heal: lg.heal, shield: lg.shield, absorb: lg.absorb, tc,
      }
    }
  })
  // Cap per unit: keep its FIGHTS_PER_UNIT busiest fights (always ≥1 → coverage holds).
  const keysByDef = new Map<string, string[]>()
  for (const k in byKey) { const d = byKey[k]._def; const l = keysByDef.get(d) ?? []; l.push(k); keysByDef.set(d, l) }
  const keptKeys = new Set<string>()
  const keptByDef = new Map<string, { g: number; n: number }[]>()
  for (const [def, ks] of keysByDef) {
    ks.sort((x, y) => byKey[y]._act - byKey[x]._act)
    const kept = ks.slice(0, FIGHTS_PER_UNIT)
    for (const k of kept) keptKeys.add(k)
    keptByDef.set(def, kept.map(k => { const p = k.split('|'); return { g: +p[1], n: +p[2] } }))
  }
  // Embed only the fights referenced by kept entries, remapping fi → compact index.
  const fiRemap = new Map<number, number>()
  const rptFights: { game: number; round: number; aName: string; bName: string; winner: 'a' | 'b' | 'draw'
    seconds: number; series: { unit: string; team: 'a' | 'b'; defId: string; points: (number | null)[] }[] }[] = []
  const rptClean: Record<string, Omit<URec, '_act' | '_def'>> = {}
  for (const k of keptKeys) {
    const rec = byKey[k]
    let ni = fiRemap.get(rec.fi)
    if (ni === undefined) {
      const f = r.traceFights[rec.fi]
      ni = rptFights.length
      fiRemap.set(rec.fi, ni)
      rptFights.push({ game: f.game, round: f.round, aName: f.aName, bName: f.bName, winner: f.winner, seconds: f.seconds,
        series: f.series.map(s => ({ unit: s.unit, team: s.team, defId: s.defId, points: s.points })) })
    }
    const { _act, _def, fi, ...rest } = rec
    rptClean[k] = { ...rest, fi: ni }
  }
  // Per-unit overall averages, so the drill-down can color this-fight totals vs the
  // unit's own norm (±7% = near/yellow · dealt higher = green · taken lower = green).
  const rptAvg: Record<string, { d: number; t: number }> = {}
  for (const u of r.units) rptAvg[u.defId] = { d: u.avgDealt, t: u.avgTaken }
  const rptData = `<script>window.__RPT=${JSON.stringify({ fights: rptFights, ur: rptClean, avg: rptAvg })}</script>`

  // ── Overview page — Units ranked by win rate FIRST (card grid, 5 per row) ────
  // Each card carries data-* attributes so the client control bar can sort/filter
  // (by win rate, cost, archetype, trait) without needing UNIT_MAP at runtime.
  const unitCards = `<div class="ucards">${r.units.map(u => {
    const a = arch.get(archOf(u.defId))!
    const d = UNIT_MAP.get(u.defId)
    const archKind = d?.role === 'tank' ? 'tank' : 'carry'
    return `<a class="ucard2" href="#/unit/${u.defId}"
      data-win="${u.winRate.toFixed(4)}" data-cost="${d?.cost ?? 0}" data-arch="${archKind}"
      data-fields="${u.fields}" data-traits="${(d?.types ?? []).join(' ')}" data-name="${esc(unitName(u.defId))}">
      <span class="uc-win">${pct(u.winRate)}</span>
      ${spriteImg(u.defId, 60)}
      <span class="uc-name">${esc(unitName(u.defId))}</span>
      <span class="uc-arch">${d ? `${d.cost}c · ${d.role ?? 'unit'}` : ''}</span>
      <span class="uc-field">${u.fields}× fielded</span>
      <span class="uc-row"><span class="uc-k">DMG</span> ${heat(u.avgDealt, a.dMean, a.dStd, true)}</span>
      <span class="uc-row"><span class="uc-k">TKN</span> ${heat(u.avgTaken, a.tMean, a.tStd, false)}</span>
    </a>`
  }).join('')}</div>`

  // Distinct traits present on any fielded unit, for the trait filter dropdown.
  const cardTraitIds = [...new Set(r.units.flatMap(u => UNIT_MAP.get(u.defId)?.types ?? []))]
    .sort((x, y) => traitName(x).localeCompare(traitName(y)))
  const traitOptions = ['<option value="all">All traits</option>',
    ...cardTraitIds.map(t => `<option value="${t}">${esc(traitName(t))}</option>`)].join('')
  const cardControls = `<div class="cardctl">
    <div class="cardctl-grp"><span class="cardctl-lbl">Sort</span>
      <button class="chip cc-sort is-on" data-sort="win">Win rate</button>
      <button class="chip cc-sort" data-sort="cost">Cost</button>
      <button class="chip cc-sort" data-sort="arch">Archetype</button>
      <button class="chip cc-sort" data-sort="fields">Fielded</button>
      <button class="chip cc-dir" data-dir="desc" title="Toggle sort direction">▼ High→Low</button>
    </div>
    <div class="cardctl-grp"><span class="cardctl-lbl">Type</span>
      <button class="chip cc-arch is-on" data-arch="all">All</button>
      <button class="chip cc-arch" data-arch="tank">Tanks</button>
      <button class="chip cc-arch" data-arch="carry">Carries</button>
    </div>
    <div class="cardctl-grp"><span class="cardctl-lbl">Cost</span>
      <button class="chip cc-cost is-on" data-cost="all">All</button>
      ${[1, 2, 3, 4, 5].map(c => `<button class="chip cc-cost" data-cost="${c}">${c}</button>`).join('')}
    </div>
    <div class="cardctl-grp"><span class="cardctl-lbl">Trait</span>
      <select class="cc-trait">${traitOptions}</select>
    </div>
    <span class="cardctl-count"></span>
  </div>`

  const winBars = barsH(r.standings.map(s => ({ label: s.name, value: s.winRate, colorIdx: colorOf(s.persona) })), pct)
  const placeStack = stackedH(r.standings.map(s => ({ label: s.name, segs: s.placementDist })))
  const standTable = table(['Persona', 'Win%', 'Top-2%', 'Avg Place', 'Avg HP', 'Avg Elim Rd'],
    r.standings.map(s => [esc(s.name), pct(s.winRate), pct(s.top2Rate), s.avgPlacement.toFixed(2), String(s.avgFinalHp), s.avgElimRound.toFixed(1)]),
    [false, true, true, true, true, true])
  const survChart = lineChart([{ name: 'avg alive', points: r.survival.avgAlive, colorIdx: 1 }], r.survival.rounds.map(stageLabel), v => v.toFixed(1))
  const h2hHead = ['', ...r.personaOrder.map(nm)]
  const h2hRows = r.personaOrder.map((aId, i) => [`<b>${esc(nm(aId))}</b>`, ...r.personaOrder.map((_, j) => {
    const v = r.h2h[i][j]; if (v == null) return '<span class="mut">—</span>'
    return `<span class="heat" style="background:rgba(42,120,214,${(0.12 + v * 0.6).toFixed(2)})">${pct(v)}</span>`
  })])
  // The round-by-round timeline browse shows ONE representative game (the lowest
  // traced index). Other traced games exist only to guarantee per-unit drill-down
  // coverage and are reached through unit pages, not the round nav.
  const g0 = r.traceRounds.length ? Math.min(...r.traceRounds.map(t => t.game)) : 0
  const g0Rounds = r.traceRounds.filter(t => t.game === g0)
  const roundNav = `<div class="chips">${g0Rounds.map(t => `<a class="chip" href="#/round/${t.round}">${stageLabel(t.round)}</a>`).join('')}</div>`

  // Learned composition affinities (src/econ/compositionSignature.ts) — THIS
  // RUN's observed win rates only, for visibility/debugging. The file bots
  // actually load at runtime is src/econ/learnedCompositionAffinities.ts,
  // trained separately by trainCompositionAffinities.ts. Every key is
  // "stage|..." — a comp shape strong early can be weak late.
  const learnedTraitPairRows = r.traitPairs.slice(0, 30).map(row => {
    const [stage, a, b] = row.key.split('|')
    return [stage, `${esc(traitName(a))} + ${esc(traitName(b))}`, pct(row.winRate), String(row.samples)]
  })
  const learnedUnitContextRows = r.unitContexts.slice(0, 30).map(row => {
    const [stage, defId, sig] = row.key.split('|')
    const sigLabel = sig.split('+').map(traitName).join(' + ')
    return [stage, unitLink(defId, esc(unitName(defId))), esc(sigLabel), pct(row.winRate), String(row.samples)]
  })
  const learnedTraitDepthRows = r.traitDepths.slice(0, 30).map(row => {
    const [stage, trait, depth] = row.key.split('|')
    return [stage, esc(traitName(trait)), depth, pct(row.winRate), String(row.samples)]
  })
  const learnedBreadthRows = r.breadths.slice(0, 30).map(row => {
    const [stage, count] = row.key.split('|')
    return [stage, count, pct(row.winRate), String(row.samples)]
  })
  const hasLearnedData = r.traitPairs.length || r.unitContexts.length || r.traitDepths.length || r.breadths.length
  const learnedSection = hasLearnedData ? `
    <h2>Learned composition affinities (this run)</h2>
    <p class="sub">Win rate broken down by stage (min 5 samples this run). This is observational — the table bots actually use at runtime is trained separately by trainCompositionAffinities.ts.</p>
    ${r.traitPairs.length ? `<h3>Trait pairs fielded together</h3>${table(['Stage', 'Traits', 'Win rate', 'Samples'], learnedTraitPairRows, [false, false, true, true])}` : ''}
    ${r.unitContexts.length ? `<h3>Unit added onto an established board direction</h3>${table(['Stage', 'Unit', 'Board direction', 'Win rate', 'Samples'], learnedUnitContextRows, [false, false, false, true, true])}` : ''}
    ${r.traitDepths.length ? `<h3>Investing heavy into one trait</h3>${table(['Stage', 'Trait', 'Breakpoint reached', 'Win rate', 'Samples'], learnedTraitDepthRows, [false, false, true, true, true])}` : ''}
    ${r.breadths.length ? `<h3>Wide vs. narrow board breadth</h3>${table(['Stage', 'Distinct active traits', 'Win rate', 'Samples'], learnedBreadthRows, [false, true, true, true])}` : ''}
  ` : ''

  const aiSummarySection = r.aiSummary ? `
    <h2>AI summary</h2>
    <p class="sub">Generated by the \`claude\` CLI from this run's learned-affinity data (see src/econ/aiSummary.ts).</p>
    <div class="callout">${esc(r.aiSummary).split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>
  ` : ''

  const overview = `<section class="page" id="page-overview">
    ${aiSummarySection}
    <h2>Units — ranked by board win rate</h2>
    <p class="sub">How often a board fielding this unit won its fight, across all ${r.meta.games} games. Damage is colored vs same-archetype peers (▲ better · ▼ worse). Click a unit for per-star-level detail.</p>
    ${cardControls}
    ${unitCards}
    <h2>Standings</h2>
    <div class="cols"><div class="fig"><h3>Win rate (1st place)</h3>${winBars}</div>
      <div class="fig"><h3>Placement distribution</h3>${placeOrdLegend()}${placeStack}</div></div>
    ${standTable}
    <h2>Survival curve</h2><div class="fig">${survChart}<p class="cap">Average bots alive at each round (x = stage-round index), across all games.</p></div>
    <h2>Head-to-head win rate</h2><p class="sub">Row beats column.</p>${table(h2hHead, h2hRows)}
    ${learnedSection}
    <h2>Traced game — rounds</h2><p class="sub">Click a stage-round to inspect every board, comp and fight.</p>${roundNav}
  </section>`

  // ── Round pages ────────────────────────────────────────────────────────────
  const fightsByRound = new Map<number, FightTrace[]>()
  for (const f of r.traceFights) { if (f.game !== g0) continue; const l = fightsByRound.get(f.round) ?? []; l.push(f); fightsByRound.set(f.round, l) }

  const roundPages = g0Rounds.map(t => {
    const boards = t.bots.map(b => {
      const traits = b.traits.length ? b.traits.map(tr => `<span class="tag">${esc(traitName(tr.trait))} ${tr.count}</span>`).join('') : '<span class="mut">—</span>'
      const board = b.board.length ? b.board.map(u =>
        `<span class="bu">${unitLink(u.defId, spriteImg(u.defId, 40))}${u.tier > 1 ? `<span class="star">${'★'.repeat(u.tier)}</span>` : ''}${u.item ? itemImg(u.item, 16) : ''}</span>`).join('') : '<span class="mut">empty</span>'
      return `<div class="botcard ${b.eliminated ? 'elim' : ''}"><div class="bh"><span class="dot" style="background:var(--s${colorOf(b.persona)})"></span><b>${esc(b.name)}</b>${b.eliminated ? ' <span class="mut">☠ eliminated</span>' : ''}</div>
        <div class="bstat">${b.hp} HP · L${b.level} · ${b.gold}g · ${b.power} pw · ${b.units} units</div>
        <div class="bboard">${board}</div><div class="btraits">${traits}</div></div>`
    }).join('')
    const fights = (fightsByRound.get(t.round) ?? []).map(f => fightBlock(f)).join('') || '<p class="mut">No combat this round (creep / item round).</p>'
    return `<section class="page" id="page-round-${t.round}"><div class="crumb"><a href="#/">← Overview</a> / Stage-round ${stageLabel(t.round)}</div>
      <h2>Stage-round ${stageLabel(t.round)}</h2><div class="botgrid">${boards}</div>
      <h3>Fights</h3>${fights}</section>`
  }).join('')

  // ── Unit pages — per-star-level averages across ALL games ───────────────────
  const unitPages = r.units.map(u => {
    const def = UNIT_MAP.get(u.defId)
    const a = arch.get(archOf(u.defId))!
    const traits = (def?.types ?? []).map(t => `<span class="tag">${esc(traitName(t))}</span>`).join(' ')
    const ability = def?.ability ? `<div class="ability"><b>${esc(def.ability.name)}</b><p>${esc(def.ability.description)}</p></div>` : ''
    const stat = (k: string, v: string): string => `<div class="stt"><span class="sk">${k}</span><span class="sv">${v}</span></div>`
    // Expandable damage-done / damage-taken breakdown tiles (click to reveal).
    const db = u.dealtBreak, tb = u.takenBreak
    const xrow = (k: string, v: number, tot: number): string =>
      `<div class="xrow"><span class="xk">${k}</span><span class="xv">${Math.round(v)}</span><span class="xp">${tot > 0 ? pct(v / tot) : '—'}</span></div>`
    const dmgCards = `<div class="dmg-cards">
      <details class="dmg-card"><summary><span class="sk">Avg dmg / round</span><span class="sv">${Math.round(u.avgDealt)} <span class="caret">▾</span></span></summary>
        <div class="xb"><div class="xb-h">By type</div>${xrow('Physical (atk)', db.phys, u.avgDealt)}${xrow('Magic (sp)', db.magic, u.avgDealt)}${xrow('True', db.trueDmg, u.avgDealt)}
          <div class="xb-h">By source</div>${xrow('Autos', db.auto, u.avgDealt)}${xrow('Spells', db.spell, u.avgDealt)}${xrow('Empowered autos', db.emp, u.avgDealt)}</div></details>
      <details class="dmg-card"><summary><span class="sk">Avg taken / round</span><span class="sv">${Math.round(u.avgTaken)} <span class="caret">▾</span></span></summary>
        <div class="xb"><div class="xb-h">By type</div>${xrow('Physical (atk)', tb.phys, u.avgTaken)}${xrow('Magic (sp)', tb.magic, u.avgTaken)}${xrow('True', tb.trueDmg, u.avgTaken)}
          <div class="xb-h">By source</div>${xrow('From autos', tb.auto, u.avgTaken)}${xrow('From spells', tb.spell, u.avgTaken)}
          <div class="xb-h">Mitigation</div>${xrow('Absorbed by shields', tb.shield, u.avgTaken + tb.shield)}</div></details>
    </div>`
    // Trait contributions — how much each of the unit's traits added to its output.
    const tc = Object.entries(u.traitContrib)
      .map(([t, v]) => ({ t, ...v, total: v.dmg + v.heal + v.shield + v.mitigated }))
      .filter(x => x.total >= 1 || x.count >= 0.05)
      .sort((x, y) => y.total - x.total)
    const cell = (v: number, share?: number): string => v >= 1
      ? `${Math.round(v)}${share !== undefined && share > 0 ? ` <span class="mut">(${pct(v / share)})</span>` : ''}`
      : '<span class="mut">—</span>'
    const nameCell = (x: { t: string; count: number }): string =>
      `<span class="tag">${esc(traitName(x.t))}</span>${x.count >= 0.05 ? ` <span class="mut">${x.count >= 1 ? x.count.toFixed(1) : x.count.toFixed(2)}×/fight</span>` : ''}`
    const traitContribBlock = tc.length ? `
      <h3>Trait contributions <span class="cap" style="font-weight:400">— avg per fight each trait added to this unit</span></h3>
      ${table(['Trait', 'Damage', 'Healing', 'Shielding', 'Dmg reduced'],
        tc.map(x => [nameCell(x), cell(x.dmg, u.avgDealt), cell(x.heal), cell(x.shield), cell(x.mitigated)]),
        [false, true, true, true, true])}
      <p class="cap">Estimated marginal contribution: for damage, the trait's share of the hits it scaled or amplified (% of this unit's avg damage); for healing/shielding, the amount the trait's amplification or effect added; <b>Dmg reduced</b> = incoming damage its durability reduced or its shields absorbed. A ×/fight count (e.g. Sky Striker executes) appears next to the trait.</p>`
      : ''
    // Per star level — each average is its own horizontal tile, grouped under a star heading.
    const tierBlocks = u.perTier.map(t => `
      <div class="tc-head">${'★'.repeat(t.tier)} <span class="mut">(${t.tier}★)</span></div>
      <div class="stats">
        ${stat('Fielded', String(t.fields))}${stat('Win rate', pct(t.winRate))}
        ${stat('Avg dmg', heat(t.avgDealt, a.dMean, a.dStd, true))}${stat('Avg taken', heat(t.avgTaken, a.tMean, a.tStd, false))}
        ${stat('Self heal / rd', String(Math.round(t.avgHealSelf)))}${stat('Ally heal / rd', String(Math.round(t.avgHealAlly)))}
        ${stat('Self shield / rd', String(Math.round(t.avgShieldSelf)))}${stat('Ally shield / rd', String(Math.round(t.avgShieldAlly)))}
        ${stat('Casts / rd', t.avgCasts.toFixed(1))}${stat('Kills / rd', t.avgKills.toFixed(2))}${stat('Deaths / rd', t.avgDeaths.toFixed(2))}
      </div>`).join('')
    // The unit's retained fight drill-downs, grouped by game. Every fielded unit
    // has ≥1 (coverage guarantee); commonly-fielded units are capped at the
    // FIGHTS_PER_UNIT busiest fights, so this is a representative set, not all.
    const byGame = new Map<number, number[]>()
    for (const { g, n } of keptByDef.get(u.defId) ?? []) { const l = byGame.get(g) ?? []; l.push(n); byGame.set(g, l) }
    const gameList = [...byGame.keys()].sort((x, y) => x - y)
    const chips = gameList.map(g => {
      const inner = byGame.get(g)!.sort((x, y) => x - y)
        .map(n => `<a class="chip" href="#/unit/${u.defId}/game/${g}/round/${n}">${stageLabel(n)}</a>`).join('')
      const label = gameList.length > 1 ? `<span class="chip-glabel">Game ${g + 1}</span>` : ''
      return `<div class="chip-grow">${label}${inner}</div>`
    }).join('')
    return `<section class="page" id="page-unit-${u.defId}"><div class="crumb"><a href="#/">← Overview</a> / ${esc(unitName(u.defId))}</div>
      <div class="uhead">${spriteImg(u.defId, 96)}<div class="uhead-body"><h2>${esc(unitName(u.defId))}</h2>
        <div class="sub">${def ? `${def.cost}-cost · ${def.role ?? 'unit'}` : ''}</div><div class="tags">${traits}</div>
        ${baseStatStrip(u.defId)}</div></div>
      ${ability}
      <div class="stats">${stat('Board win rate', pct(u.winRate))}${stat('Times fielded', String(u.fields))}${stat('Self heal / rd', String(Math.round(u.avgHealSelf)))}${stat('Ally heal / rd', String(Math.round(u.avgHealAlly)))}${stat('Self shield / rd', String(Math.round(u.avgShieldSelf)))}${stat('Ally shield / rd', String(Math.round(u.avgShieldAlly)))}</div>
      ${dmgCards}
      ${traitContribBlock}
      <h3>Per star level</h3>${tierBlocks}
      <p class="cap">Averages are per fight. Damage colored vs ${esc(archLabel(u.defId))} (▲ better than the archetype mean · ▼ worse). Taken is green when <em>below</em> peers.</p>
      <h3>In traced games (click a stage-round for the fight detail)</h3><div class="chipgroups">${chips || '<span class="mut">— not fielded in any traced game</span>'}</div>
    </section>`
  }).join('')

  const body = `<div class="viz-root">
  <header><h1><a href="#/" class="home">Bot League Report</a></h1>
    <p class="sub">${r.meta.games} games · ${r.meta.rounds} rounds · seed ${r.meta.seed} · ${new Date(r.meta.generatedAt).toLocaleString()}</p></header>
  ${overview}${roundPages}${unitPages}
  <section class="page" id="page-uround" hidden><div id="uround-body"></div></section>
</div>${rptData}${UR_RENDERER}${CARD_CONTROLS}${ROUTER}`
  // spriteCss() must run AFTER the pages above (which populate the used-sprite sets).
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bot League Report</title>${STYLE}<style>${spriteCss()}</style></head><body>${body}</body></html>`
}

// One fight's combat timeline (chart + damage table + kill log), units linkable.
function fightBlock(f: FightTrace): string {
  const top = f.series.slice(0, 5)
  const dmgSeries = top.map((s, i) => ({ name: s.unit, points: s.points as (number | null)[], colorIdx: i + 1 }))
  const xs = Array.from({ length: f.seconds + 1 }, (_, i) => i)
  const chart = dmgSeries.length ? lineChart(dmgSeries, xs, v => String(Math.round(v))) : '<p class="mut">no damage recorded</p>'
  const lg = legend(top.map((s, i) => ({ name: s.unit, colorIdx: i + 1 })))
  const dmgTable = table(['Unit', 'Side', 'Dealt', 'Taken'],
    f.perUnit.map(u => [`${spriteImg(u.defId, 20)} ${unitLink(u.defId, esc(u.unit))}`, u.team === 'a' ? esc(f.aName) : esc(f.bName), String(u.dealt), String(u.taken)]),
    [false, false, true, true])
  const killTable = f.kills.length
    ? table(['@ s', 'Victim', 'Killer', 'Ability'], f.kills.map(k => [k.sec.toFixed(1),
        k.victimDef ? unitLink(k.victimDef, esc(k.victim)) : esc(k.victim),
        k.killerDef ? unitLink(k.killerDef, esc(k.killer)) : esc(k.killer), esc(k.ability)]))
    : '<p class="mut">no deaths</p>'
  const wlabel = f.winner === 'a' ? esc(f.aName) : f.winner === 'b' ? esc(f.bName) : 'draw'
  return `<details open><summary><b>${esc(f.aName)}</b> vs <b>${esc(f.bName)}</b> — winner <b>${wlabel}</b> · ${f.durationSec}s</summary>
    <div class="fig"><h4>Cumulative damage over time (top dealers)</h4>${lg}${chart}<p class="cap">X = seconds, Y = cumulative post-mitigation damage.</p></div>
    <div class="cols"><div><h4>Damage by unit</h4>${dmgTable}</div><div><h4>Kill log</h4>${killTable}</div></div></details>`
}

// Client control bar for the overview unit-card grid: sort (win rate / cost /
// archetype / fielded, either direction) and filter (archetype, cost, trait).
// Reads the data-* attributes emitted on each .ucard2 and reorders/hides DOM nodes
// in place — a CSS grid lays out its children in DOM order, so reordering sorts.
const CARD_CONTROLS = `<script>
(function(){
  var grid = document.querySelector('.ucards');
  var ctl  = document.querySelector('.cardctl');
  if(!grid || !ctl) return;
  var cards = [].slice.call(grid.querySelectorAll('.ucard2'));
  var state = { sort:'win', dir:'desc', arch:'all', cost:'all', trait:'all' };
  var countEl = ctl.querySelector('.cardctl-count');

  function keyOf(c){
    if(state.sort==='cost')   return +c.dataset.cost;
    if(state.sort==='fields') return +c.dataset.fields;
    if(state.sort==='arch')   return (+c.dataset.cost)*10 + (c.dataset.arch==='tank'?1:0);
    return +c.dataset.win;
  }
  function apply(){
    var shown = 0;
    cards.forEach(function(c){
      var ok = (state.arch==='all'  || c.dataset.arch===state.arch)
            && (state.cost==='all'  || c.dataset.cost===state.cost)
            && (state.trait==='all' || (' '+c.dataset.traits+' ').indexOf(' '+state.trait+' ')>=0);
      c.style.display = ok ? '' : 'none';
      if(ok) shown++;
    });
    var vis = cards.filter(function(c){ return c.style.display!=='none'; });
    var sign = state.dir==='desc' ? -1 : 1;
    vis.sort(function(a,b){
      var d = (keyOf(a)-keyOf(b)) * sign;
      if(d) return d;
      var w = (+b.dataset.win)-(+a.dataset.win);   // tiebreak: win rate desc, then name
      return w || a.dataset.name.localeCompare(b.dataset.name);
    });
    vis.forEach(function(c){ grid.appendChild(c); });   // reattach in sorted order
    if(countEl) countEl.textContent = shown + (shown===1?' unit':' units');
  }
  function selectOne(groupClass, el, key){
    ctl.querySelectorAll(groupClass).forEach(function(b){ b.classList.remove('is-on'); });
    el.classList.add('is-on');
    state[key] = el.dataset[key];
  }
  ctl.querySelectorAll('.cc-sort').forEach(function(b){ b.addEventListener('click', function(){ selectOne('.cc-sort', b, 'sort'); apply(); }); });
  ctl.querySelectorAll('.cc-arch').forEach(function(b){ b.addEventListener('click', function(){ selectOne('.cc-arch', b, 'arch'); apply(); }); });
  ctl.querySelectorAll('.cc-cost').forEach(function(b){ b.addEventListener('click', function(){ selectOne('.cc-cost', b, 'cost'); apply(); }); });
  var traitSel = ctl.querySelector('.cc-trait');
  if(traitSel) traitSel.addEventListener('change', function(){ state.trait = traitSel.value; apply(); });
  var dirBtn = ctl.querySelector('.cc-dir');
  if(dirBtn) dirBtn.addEventListener('click', function(){
    state.dir = state.dir==='desc' ? 'asc' : 'desc';
    dirBtn.textContent = state.dir==='desc' ? '\\u25BC High\\u2192Low' : '\\u25B2 Low\\u2192High';
    apply();
  });
  apply();
})();
</script>`

const ROUTER = `<script>
(function(){
  function route(){
    var h=(location.hash||'').replace(/^#\\/?/,'');
    var id='page-overview', m;
    if((m=h.match(/^unit\\/(.+)\\/game\\/(\\d+)\\/round\\/(\\d+)$/))){ id='page-uround'; if(window.__renderUR) window.__renderUR(decodeURIComponent(m[1]), m[2], m[3]); }
    else if((m=h.match(/^round\\/(\\d+)/))) id='page-round-'+m[1];
    else if((m=h.match(/^unit\\/(.+)$/))) id='page-unit-'+decodeURIComponent(m[1]);
    if(!document.getElementById(id)) id='page-overview';
    document.querySelectorAll('.page').forEach(function(p){p.hidden=(p.id!==id)});
    window.scrollTo(0,0);
  }
  window.addEventListener('hashchange',route); route();
})();
</script>`

// Client-side renderer for the per-unit fight drill-down (#/unit/ID/game/G/round/N).
// Reads window.__RPT (embedded above) and draws the header + four SVG charts into
// #uround-body. Damage colors are FIXED by request: physical=red, magic=blue,
// true=white; heal=green, shield=teal, shield-absorb=gray. Damage dealt/taken are
// CUMULATIVE lines whose vertices (clickable) are colored by hit type; kills are ✕,
// casts thin dotted verticals. Any chart expands to a full row on caption-click.
const UR_RENDERER = `<script>
(function(){
  var RED='#e34948', BLUE='#3d7fd6', WHITE='#ffffff', GREEN='#17a34a', TEAL='#13b6a6', GRAY='#8a8880';
  // Distinct many-line palette for the cumulative-all chart's per-unit legend.
  var PAL=['#4e79a7','#f28e2b','#59a14f','#b07aa1','#edc948','#76b7b2','#9c755f','#ff9da7'];
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  var RED_LT='#f2aaa9', BLUE_LT='#accbf0';   // lighter tints for spell / empowered-auto hits
  function typeName(dt){return dt===0?'physical':dt===1?'magic':'true';}
  function typeCol(dt){return dt===0?RED:dt===1?BLUE:WHITE;}
  // Colour by damage type, but LIGHTEN physical/magic when the hit came from a
  // spell or empowered auto (s>0) — so full-saturation red/blue = plain autos.
  function typeColSrc(dt,s){ if(dt===2||s===0) return typeCol(dt); return dt===0?RED_LT:dt===1?BLUE_LT:WHITE; }
  function srcName(s){return s===0?'auto':s===1?'spell':'empowered auto';}
  function niceMax(v){ v=Math.max(1,v); var step=Math.pow(10,Math.floor(Math.log10(v))); var n=Math.ceil(v/step)*step; return n<v?v:n; }

  function frame(g,W,H){ return '<svg viewBox="0 0 '+W+' '+H+'" class="uf-svg" preserveAspectRatio="xMidYMid meet">'+g+'</svg>'; }
  function axes(px,py,nice,secs,W,H,pL,pR,pT,pB){
    var g='', yt=[0,nice/2,nice], k;
    for(k=0;k<yt.length;k++){var yy=py(yt[k]); g+='<line x1="'+pL+'" y1="'+yy+'" x2="'+(W-pR)+'" y2="'+yy+'" class="uf-grid"/><text x="'+(pL-6)+'" y="'+(yy+3)+'" class="uf-ylab">'+Math.round(yt[k])+'</text>';}
    var xt=Math.max(1,Math.round(secs/5)), s;
    for(s=0;s<=secs;s+=xt){var xx=px(s); g+='<line x1="'+xx+'" y1="'+(H-pB)+'" x2="'+xx+'" y2="'+(H-pB+4)+'" class="uf-axis"/><text x="'+xx+'" y="'+(H-pB+15)+'" class="uf-xlab">'+s+'s</text>';}
    return g;
  }
  // Draw a data point carrying a (possibly rich, sprite-bearing) HTML tooltip. The
  // HTML is URI-encoded into data-tip so quotes in the sprite markup survive.
  function dot(x,y,col,killed,html){
    var stroke=(col===WHITE)?'#555':'rgba(0,0,0,.3)', tip=encodeURIComponent(html);
    if(killed) return '<path d="M'+(x-4.5)+' '+(y-4.5)+'L'+(x+4.5)+' '+(y+4.5)+'M'+(x-4.5)+' '+(y+4.5)+'L'+(x+4.5)+' '+(y-4.5)+'" stroke="'+col+'" stroke-width="2.4" fill="none" class="uf-pt" data-tip="'+tip+'"/>';
    return '<circle cx="'+x+'" cy="'+y+'" r="3.6" fill="'+col+'" stroke="'+stroke+'" stroke-width=".6" class="uf-pt" data-tip="'+tip+'"/>';
  }
  function chip(gd){ return gd ? '<span class="spr us-'+gd+'" style="width:18px;height:18px;margin:0 3px;vertical-align:middle"></span>' : ' '; }
  // Readable sentence for a damage vertex, e.g.
  // "Killed [🐦] Vigoroth with Brave Bird doing 295 physical damage @ 28.9s, total 2899".
  function dmgTip(e, mode, total){
    var amt=Math.round(e.a), type=typeName(e.dt), who=chip(e.gd)+esc(e.g), tot=' total '+Math.round(total);
    if(mode==='dealt') return (e.flag?'Killed':'Attacked')+who+' with '+esc(e.ab)+' doing '+amt+' '+type+' damage @ '+e.t+'s,'+tot;
    return (e.flag?'Killed by':'Hit by')+who+' using '+esc(e.ab)+' for '+amt+' '+type+' damage @ '+e.t+'s,'+tot;
  }
  function heatClass(v, avg, higherGood){ if(!avg||avg<=0) return 'c-mid'; var r=v/avg; if(r>=1.07) return higherGood?'c-good':'c-bad'; if(r<=0.93) return higherGood?'c-bad':'c-good'; return 'c-mid'; }
  function heatArrow(v, avg){ if(!avg||avg<=0) return '·'; var r=v/avg; return r>=1.07?'▲':(r<=0.93?'▼':'·'); }

  // Cumulative running-total line for a single unit's damage dealt/taken. Each
  // event is a clickable vertex colored by hit type; spikes read as steep jumps.
  function cumEvents(evs, casts, seconds, mode){
    var W=560,H=210,pL=46,pR=14,pT=14,pB=26, i, secs=Math.max(1,seconds);
    var cum=0, pts=[]; for(i=0;i<evs.length;i++){ cum+=evs[i].a; pts.push({t:evs[i].t,c:cum,e:evs[i]}); }
    var nice=niceMax(cum);
    function px(t){return pL+(t/secs)*(W-pL-pR);}
    function py(a){return (H-pB)-(a/nice)*(H-pT-pB);}
    var g=axes(px,py,nice,secs,W,H,pL,pR,pT,pB), c;
    if(casts) for(c=0;c<casts.length;c++){var cx=px(casts[c]); g+='<line x1="'+cx+'" y1="'+pT+'" x2="'+cx+'" y2="'+(H-pB)+'" class="uf-cast"/>';}
    if(pts.length){ var d='M'+px(0)+' '+py(0); for(i=0;i<pts.length;i++) d+='L'+px(pts[i].t)+' '+py(pts[i].c); g+='<path d="'+d+'" fill="none" stroke="var(--ink2)" stroke-width="2"/>'; }
    for(i=0;i<pts.length;i++){
      var e=pts[i].e;
      g+=dot(px(pts[i].t),py(pts[i].c),typeColSrc(e.dt,e.s),e.flag,dmgTip(e,mode,pts[i].c));
    }
    return frame(g,W,H);
  }

  // Heal/shield/absorb scatter (kept as points — amounts, not a running total).
  function helpScatter(evs, seconds){
    var W=560,H=210,pL=46,pR=14,pT=14,pB=26, i, maxA=1;
    for(i=0;i<evs.length;i++) if(evs[i].a>maxA) maxA=evs[i].a;
    var nice=niceMax(maxA), secs=Math.max(1,seconds);
    function px(t){return pL+(t/secs)*(W-pL-pR);}
    function py(a){return (H-pB)-(a/nice)*(H-pT-pB);}
    var g=axes(px,py,nice,secs,W,H,pL,pR,pT,pB);
    for(i=0;i<evs.length;i++){
      var e=evs[i], col=e.kind===0?GREEN:e.kind===1?TEAL:GRAY, amt=Math.round(e.a), tip;
      if(e.kind===2) tip='Shield absorbed '+amt+' damage @ '+e.t+'s';
      else { var verb=e.kind===0?'Healed':'Shielded'; tip=verb+' '+(e.self?'self':esc(e.g))+' for '+amt+' @ '+e.t+'s'; }
      g+=dot(px(e.t),py(e.a),col,false,tip);
    }
    return frame(g,W,H);
  }

  // Cumulative damage for EVERY unit in the fight. Top damage-dealers get a named
  // color + legend entry; the rest fold into a muted "others". This unit is bold.
  function cumAll(fight, boldDef, boldTeam){
    var W=560,H=210,pL=46,pR=14,pT=14,pB=26, series=fight.series, secs=Math.max(1,fight.seconds), i,k;
    var boldIdx=-1; for(i=0;i<series.length;i++) if(series[i].defId===boldDef && series[i].team===boldTeam) boldIdx=i;
    var ranked=series.map(function(s,idx){ var p=s.points,fin=0; for(k=p.length-1;k>=0;k--){ if(p[k]!=null){fin=p[k];break;} } return {idx:idx,fin:fin}; })
      .sort(function(a,b){return b.fin-a.fin;});
    var order=[]; for(i=0;i<ranked.length && order.length<8;i++) order.push(ranked[i].idx);
    if(boldIdx>=0 && order.indexOf(boldIdx)<0) order[order.length-1]=boldIdx;   // always show this unit
    var colorByIdx={}; for(i=0;i<order.length;i++) colorByIdx[order[i]]=PAL[i%PAL.length];
    var maxV=1; for(i=0;i<series.length;i++){var p=series[i].points; for(k=0;k<p.length;k++) if(p[k]>maxV)maxV=p[k];}
    var nice=niceMax(maxV);
    function px(t){return pL+(t/secs)*(W-pL-pR);}
    function py(a){return (H-pB)-(a/nice)*(H-pT-pB);}
    var g=axes(px,py,nice,secs,W,H,pL,pR,pT,pB);
    function line(s,col,w,op){ var p=s.points,d='',t; for(t=0;t<p.length;t++){ if(p[t]==null)continue; d+=(d?'L':'M')+px(t)+' '+py(p[t]); } return d?('<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" opacity="'+op+'"/>'):''; }
    for(i=0;i<series.length;i++) if(colorByIdx[i]===undefined && i!==boldIdx) g+=line(series[i],'var(--mut)',1,.32);
    for(i=0;i<order.length;i++){ var ix=order[i]; if(ix===boldIdx)continue; g+=line(series[ix],colorByIdx[ix],1.6,.95); }
    if(boldIdx>=0) g+=line(series[boldIdx],colorByIdx[boldIdx]||BLUE,3.6,1);
    var legParts=[], used={}, nOther=0;
    for(i=0;i<ranked.length;i++){ var jx=ranked[i].idx; if(colorByIdx[jx]===undefined||used[jx])continue; used[jx]=1;
      var isB=(jx===boldIdx);
      legParts.push('<span'+(isB?' style="font-weight:700"':'')+'><i style="background:'+colorByIdx[jx]+(isB?';outline:2px solid var(--ink);outline-offset:1px':'')+'"></i>'+esc(series[jx].unit)+(isB?' (this unit)':'')+'</span>');
    }
    for(i=0;i<series.length;i++) if(colorByIdx[i]===undefined && i!==boldIdx) nOther++;
    if(nOther>0) legParts.push('<span><i style="background:var(--mut)"></i>'+nOther+' other'+(nOther>1?'s':'')+'</span>');
    return { svg:frame(g,W,H), legend:'<div class="uf-leg">'+legParts.join('')+'</div>' };
  }

  function fig(title, sub, svg, legend){
    return '<figure class="uf-fig"><figcaption class="uf-cap" title="Click to expand">'+title+(sub?' <span class="uf-sub">'+sub+'</span>':'')+'<span class="uf-exp">⤢</span></figcaption>'+svg+(legend||'')+'</figure>';
  }
  function colorLegend(pairs, note){
    var s='<div class="uf-leg">', i;
    for(i=0;i<pairs.length;i++){ var c=pairs[i][1]; var st=(c===WHITE)?('background:'+c+';border:1px solid #888'):('background:'+c); s+='<span><i style="'+st+'"></i>'+pairs[i][0]+'</span>'; }
    if(note)s+='<span class="uf-note">'+note+'</span>';
    return s+'</div>';
  }
  function mapDealt(e){return {t:e.t,a:e.a,dt:e.dt,s:e.s,g:e.g,gd:e.gd,ab:e.ab,flag:e.k};}
  function mapTaken(e){return {t:e.t,a:e.a,dt:e.dt,s:e.s,g:e.g,gd:e.gd,ab:e.ab,flag:e.d};}

  var tipEl;
  function attachTips(root){
    if(!tipEl){ tipEl=document.createElement('div'); tipEl.className='uf-tip'; tipEl.hidden=true; (document.querySelector('.viz-root')||document.body).appendChild(tipEl); }
    root.querySelectorAll('.uf-pt').forEach(function(pt){
      pt.addEventListener('mouseenter',function(){ tipEl.innerHTML=decodeURIComponent(pt.getAttribute('data-tip')); tipEl.hidden=false; });
      pt.addEventListener('mousemove',function(ev){ tipEl.style.left=(ev.clientX+12)+'px'; tipEl.style.top=(ev.clientY+12)+'px'; });
      pt.addEventListener('mouseleave',function(){ tipEl.hidden=true; });
    });
    root.querySelectorAll('.uf-cap').forEach(function(cap){ cap.addEventListener('click',function(){ cap.parentNode.classList.toggle('uf-fig--wide'); }); });
  }

  window.__renderUR=function(defId, game, round){
    var el=document.getElementById('uround-body'); if(!el)return;
    var D=window.__RPT, d=D&&D.ur[defId+'|'+game+'|'+round];
    if(!d){ el.innerHTML='<div class="crumb"><a href="#/">← Overview</a></div><p class="mut">No fight detail recorded for this unit that round.</p>'; return; }
    var f=D.fights[d.fi], other=(d.team==='a'?f.bName:f.aName), won=(f.winner===d.team), i;
    var totDealt=0,totTaken=0,totHeal=0,totShield=0,totAbs=0,kills=0;
    for(i=0;i<d.dealt.length;i++){totDealt+=d.dealt[i].a; if(d.dealt[i].k)kills++;}
    for(i=0;i<d.taken.length;i++)totTaken+=d.taken[i].a;
    for(i=0;i<d.heal.length;i++)totHeal+=d.heal[i].a;
    for(i=0;i<d.shield.length;i++)totShield+=d.shield[i].a;
    for(i=0;i<d.absorb.length;i++)totAbs+=d.absorb[i].a;
    var help=[];
    for(i=0;i<d.heal.length;i++)help.push({t:d.heal[i].t,a:d.heal[i].a,kind:0,g:d.heal[i].g,self:d.heal[i].self});
    for(i=0;i<d.shield.length;i++)help.push({t:d.shield[i].t,a:d.shield[i].a,kind:1,g:d.shield[i].g,self:d.shield[i].self});
    for(i=0;i<d.absorb.length;i++)help.push({t:d.absorb[i].t,a:d.absorb[i].a,kind:2});

    var traitTags=d.traits.length ? d.traits.map(function(t){return '<span class="tag">'+esc(t.n)+' '+t.c+(t.l?(' · bp'+t.l):'')+'</span>';}).join('') : '<span class="mut">no active traits</span>';
    var ca=cumAll(f,defId,d.team);
    // Color this-fight dealt/taken vs the unit's own average (dealt: more=green · taken: less=green · ±7%=near).
    var avgU=(D.avg&&D.avg[defId])||{d:0,t:0};
    var dCls=heatClass(totDealt,avgU.d,true), tCls=heatClass(totTaken,avgU.t,false);
    // This-fight trait contributions (how much each trait added to dmg/heal/shield).
    var tcHtml='';
    if(d.tc && d.tc.length){
      tcHtml='<div class="uf-tc"><span class="uf-tc-lbl">Trait added</span>'+d.tc.map(function(x){
        var p=[];
        if(x.dmg>=1)p.push('+'+Math.round(x.dmg)+' dmg');
        if(x.heal>=1)p.push('+'+Math.round(x.heal)+' heal');
        if(x.shield>=1)p.push('+'+Math.round(x.shield)+' shield');
        if(x.mit>=1)p.push('−'+Math.round(x.mit)+' dmg taken');
        if(x.cnt>=1)p.push(Math.round(x.cnt)+' execute'+(x.cnt>=2?'s':''));
        return '<span class="tag">'+esc(x.n)+' <b>'+p.join(' · ')+'</b></span>';
      }).join('')+'</div>';
    }

    el.innerHTML=
      '<div class="crumb"><a href="#/">← Overview</a> / <a href="#/unit/'+defId+'">'+esc(d.name)+'</a> / Game '+(Number(game)+1)+' · Stage-round '+esc(String(round))+'</div>'
      +'<div class="uf-head"><span class="spr us-'+defId+'" style="width:72px;height:72px"></span><div><h2>'+esc(d.name)+'</h2>'
      +'<div class="sub">'+(d.item?('holds <b>'+esc(d.item)+'</b> · '):'')+'vs '+esc(other)+' · <b class="'+(won?'uf-win':'uf-loss')+'">'+(won?'won':'lost')+'</b></div>'
      +'<div class="tags">'+traitTags+'</div></div></div>'
      +'<div class="stats">'
      +'<div class="stt"><span class="sk">Damage dealt</span><span class="sv '+dCls+'">'+Math.round(totDealt)+' <span class="arw">'+heatArrow(totDealt,avgU.d)+'</span></span></div>'
      +'<div class="stt"><span class="sk">Kills</span><span class="sv">'+kills+'</span></div>'
      +'<div class="stt"><span class="sk">Damage taken</span><span class="sv '+tCls+'">'+Math.round(totTaken)+' <span class="arw">'+heatArrow(totTaken,avgU.t)+'</span></span></div>'
      +'<div class="stt"><span class="sk">Healed</span><span class="sv">'+Math.round(totHeal)+'</span></div>'
      +'<div class="stt"><span class="sk">Shielded</span><span class="sv">'+Math.round(totShield)+'</span></div>'
      +'<div class="stt"><span class="sk">Shield mitigation</span><span class="sv">'+Math.round(totAbs)+'</span></div>'
      +'</div>'
      +tcHtml
      +'<p class="cap">Dealt/taken totals are colored vs this unit\\'s average (±7% = near · <span class="c-good">green</span> = dealt more / took less · <span class="c-bad">red</span> = the reverse). Damage charts are cumulative — steep jumps are burst; hover any point for detail, click a chart title (⤢) to expand.</p>'
      +'<div class="uf-charts">'
      +fig('Damage dealt','cumulative, by type &amp; how',cumEvents(d.dealt.map(mapDealt),d.cast,f.seconds,'dealt'),colorLegend([['physical',RED],['magic',BLUE],['true',WHITE]],'lighter = spell/empowered · ✕ kill · dotted = cast'))
      +fig('Damage taken','cumulative, by type &amp; source',cumEvents(d.taken.map(mapTaken),null,f.seconds,'taken'),colorLegend([['physical',RED],['magic',BLUE],['true',WHITE]],'lighter = spell/empowered · ✕ = killing blow'))
      +fig('Healing &amp; shielding','per event, incl. shield mitigation',helpScatter(help,f.seconds),colorLegend([['heal',GREEN],['shield',TEAL],['absorbed',GRAY]],''))
      +fig('Cumulative damage — all units','this unit bold',ca.svg,ca.legend)
      +'</div>';
    attachTips(el);
  };
})();
</script>`

const STYLE = `<style>
  :root{color-scheme:light dark}
  .viz-root{
    --surface-1:#fcfcfb;--plane:#f9f9f7;--ink:#0b0b0b;--ink2:#52514e;--mut:#898781;--grid:#e1e0d9;--axis:#c3c2b7;--chip:#eef0ee;
    --good:#0a7d0a;--mid:#9a7400;--bad:#c23934;
    --s1:${SERIES_LIGHT[0]};--s2:${SERIES_LIGHT[1]};--s3:${SERIES_LIGHT[2]};--s4:${SERIES_LIGHT[3]};--s5:${SERIES_LIGHT[4]};
    --ord1:${ORD_LIGHT[0]};--ord2:${ORD_LIGHT[1]};--ord3:${ORD_LIGHT[2]};--ord4:${ORD_LIGHT[3]};--ord5:${ORD_LIGHT[4]};
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--plane);
    max-width:1040px;margin:0 auto;padding:22px 20px 72px;line-height:1.45}
  @media (prefers-color-scheme:dark){:root:where(:not([data-theme=light])) .viz-root{
    --surface-1:#1a1a19;--plane:#0d0d0d;--ink:#fff;--ink2:#c3c2b7;--mut:#898781;--grid:#2c2c2a;--axis:#383835;--chip:#232322;
    --good:#4ac24a;--mid:#e0b64d;--bad:#ef6b66;
    --s1:${SERIES_DARK[0]};--s2:${SERIES_DARK[1]};--s3:${SERIES_DARK[2]};--s4:${SERIES_DARK[3]};--s5:${SERIES_DARK[4]};
    --ord1:${ORD_DARK[0]};--ord2:${ORD_DARK[1]};--ord3:${ORD_DARK[2]};--ord4:${ORD_DARK[3]};--ord5:${ORD_DARK[4]}}}
  :root[data-theme=dark] .viz-root{
    --surface-1:#1a1a19;--plane:#0d0d0d;--ink:#fff;--ink2:#c3c2b7;--grid:#2c2c2a;--axis:#383835;--chip:#232322;
    --good:#4ac24a;--mid:#e0b64d;--bad:#ef6b66;
    --s1:${SERIES_DARK[0]};--s2:${SERIES_DARK[1]};--s3:${SERIES_DARK[2]};--s4:${SERIES_DARK[3]};--s5:${SERIES_DARK[4]};
    --ord1:${ORD_DARK[0]};--ord2:${ORD_DARK[1]};--ord3:${ORD_DARK[2]};--ord4:${ORD_DARK[3]};--ord5:${ORD_DARK[4]}}
  a{color:var(--s1);text-decoration:none}a:hover{text-decoration:underline}.home{color:inherit}
  h1{font-size:24px;margin:0 0 2px}h2{font-size:19px;margin:26px 0 10px;border-bottom:1px solid var(--grid);padding-bottom:5px}
  h3{font-size:15px;margin:18px 0 8px}h4{font-size:13px;margin:12px 0 6px;color:var(--ink2)}
  .sub,.cap{color:var(--ink2);font-size:12.5px;margin:2px 0}.cap{margin-top:4px}.mut{color:var(--mut)}
  .callout{background:var(--plane);border:1px solid var(--grid);border-left:3px solid var(--s1);border-radius:8px;padding:12px 16px;margin:8px 0 4px;font-size:14px;line-height:1.5}
  .callout p{margin:0 0 8px}.callout p:last-child{margin-bottom:0}
  .page{background:var(--surface-1);border:1px solid var(--grid);border-radius:10px;padding:16px 18px;margin:14px 0}
  .crumb{font-size:12.5px;color:var(--ink2);margin-bottom:6px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:760px){.cols{grid-template-columns:1fr}}
  .fig{min-width:0}.chart{width:100%;height:auto;overflow:visible}
  .chart .lbl{fill:var(--ink);font-size:12px}.chart .val{fill:var(--ink2);font-size:11.5px;font-variant-numeric:tabular-nums}
  .chart .seg{fill:#fff;font-size:11px}.chart .tick{fill:var(--mut);font-size:10.5px;font-variant-numeric:tabular-nums}
  .chart .end{font-size:11px}.chart .grid{stroke:var(--grid);stroke-width:1}.chart .axis{stroke:var(--axis);stroke-width:1}
  .legend{display:flex;flex-wrap:wrap;gap:12px;margin:2px 0 6px;font-size:12px;color:var(--ink2)}
  .lg{display:inline-flex;align-items:center;gap:5px}.sw{width:11px;height:11px;border-radius:3px;display:inline-block}
  table{border-collapse:collapse;width:100%;font-size:12.5px;margin:6px 0}
  th,td{text-align:left;padding:5px 9px;border-bottom:1px solid var(--grid);white-space:nowrap}
  th{color:var(--ink2);font-weight:600}td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
  .heat{display:inline-block;min-width:38px;text-align:center;border-radius:4px;padding:1px 6px;color:var(--ink)}
  .un2{color:var(--ink)}
  .c-good{color:var(--good);font-variant-numeric:tabular-nums}.c-mid{color:var(--mid);font-variant-numeric:tabular-nums}.c-bad{color:var(--bad);font-variant-numeric:tabular-nums}
  .arw{font-size:9px;opacity:.85}
  details{border:1px solid var(--grid);border-radius:8px;padding:6px 12px;margin:8px 0}
  summary{cursor:pointer;font-size:13.5px;padding:4px 0}
  .uf-head{display:flex;align-items:center;gap:14px;margin:6px 0 12px}
  .uf-head h2{font-size:19px;margin:0}.uf-star{color:#e0b64d;font-size:15px}
  .uf-win{color:var(--good)}.uf-loss{color:var(--bad)}
  .uf-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
  @media(max-width:760px){.uf-charts{grid-template-columns:1fr}}
  .uf-fig{min-width:0;margin:0}
  .uf-fig--wide{grid-column:1 / -1}
  .uf-cap{font-size:13px;font-weight:600;margin-bottom:2px;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none}
  .uf-cap:hover{color:var(--ink2)}
  .uf-exp{margin-left:auto;color:var(--mut);font-size:14px;font-weight:400}
  .uf-sub{font-weight:400;color:var(--mut);font-size:11.5px}
  .uf-svg{width:100%;height:auto;overflow:visible;background:var(--plane);border:1px solid var(--grid);border-radius:8px}
  .uf-grid{stroke:var(--grid);stroke-width:1}.uf-axis{stroke:var(--axis);stroke-width:1}
  .uf-ylab{fill:var(--mut);font-size:10px;text-anchor:end;font-variant-numeric:tabular-nums}
  .uf-xlab{fill:var(--mut);font-size:10px;text-anchor:middle;font-variant-numeric:tabular-nums}
  .uf-cast{stroke:var(--axis);stroke-width:1;stroke-dasharray:2 3;opacity:.7}
  .uf-pt{cursor:pointer}.uf-pt:hover{stroke:var(--ink);stroke-width:1.4}
  .uf-leg{display:flex;flex-wrap:wrap;gap:10px;margin:5px 2px 0;font-size:11.5px;color:var(--ink2);align-items:center}
  .uf-leg i{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle}
  .uf-note{color:var(--mut);font-style:italic}
  .uf-tc{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0 8px}
  .uf-tc-lbl{font-size:11px;color:var(--mut);font-weight:600;margin-right:2px}
  .uf-tc .tag b{color:var(--ink);font-weight:600}
  .uf-tip{position:fixed;z-index:50;background:var(--surface-1);color:var(--ink);border:1px solid var(--axis);border-radius:6px;padding:4px 8px;font-size:12px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:280px}
  .spr{display:inline-block;image-rendering:pixelated;vertical-align:middle;background-size:contain;background-repeat:no-repeat;background-position:center}
  .spr.ph{background:var(--chip);border-radius:6px}
  .itm{display:inline-block;vertical-align:middle;margin-left:-6px;background-size:contain;background-repeat:no-repeat;background-position:center}
  .chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
  .chipgroups{display:flex;flex-direction:column;gap:8px;margin:4px 0}
  .chip-grow{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .chip-glabel{font-size:11px;color:var(--mut);font-weight:600;min-width:56px}
  .chip{display:inline-block;background:var(--chip);border:1px solid var(--grid);border-radius:6px;padding:3px 9px;font-size:12px;color:var(--ink)}
  .cardctl{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin:10px 0 6px}
  .cardctl-grp{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
  .cardctl-lbl{font-size:11px;color:var(--mut);font-weight:600;margin-right:1px}
  button.chip{font:inherit;line-height:1.3;cursor:pointer}
  button.chip:hover{border-color:var(--axis)}
  .chip.is-on{background:var(--s1);border-color:var(--s1);color:#fff}
  .cardctl select{font:inherit;font-size:12px;color:var(--ink);background:var(--chip);border:1px solid var(--grid);border-radius:6px;padding:3px 8px;cursor:pointer}
  .cardctl-count{font-size:11px;color:var(--mut);margin-left:auto}
  .ucards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:8px}
  @media(max-width:900px){.ucards{grid-template-columns:repeat(3,1fr)}}
  @media(max-width:560px){.ucards{grid-template-columns:repeat(2,1fr)}}
  .ucard2{display:flex;flex-direction:column;align-items:center;gap:1px;background:var(--chip);border:1px solid var(--grid);border-radius:10px;padding:9px 8px 10px;color:var(--ink);text-align:center;position:relative}
  .ucard2:hover{text-decoration:none;border-color:var(--axis)}
  .uc-win{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
  .uc-name{font-size:13px;font-weight:600;margin-top:1px;line-height:1.2}
  .uc-arch{font-size:10.5px;color:var(--mut)}
  .uc-field{font-size:10.5px;color:var(--mut);margin-bottom:3px}
  .uc-row{font-size:11.5px;color:var(--ink2);display:flex;align-items:center;gap:5px}
  .uc-k{font-size:9.5px;letter-spacing:.03em;color:var(--mut);width:26px;text-align:right}
  .ugrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:6px}
  .ucard{display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--chip);border:1px solid var(--grid);border-radius:8px;padding:8px 4px}
  .un{font-size:11.5px;color:var(--ink);text-align:center}.ud{font-size:10.5px;color:var(--mut)}
  .ulink{color:inherit}.ulink:hover{text-decoration:none;opacity:.85}
  .botgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
  .botcard{background:var(--chip);border:1px solid var(--grid);border-radius:9px;padding:9px 11px}.botcard.elim{opacity:.55}
  .bh{display:flex;align-items:center;gap:6px;font-size:13.5px}.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
  .bstat{font-size:11.5px;color:var(--ink2);margin:3px 0 6px;font-variant-numeric:tabular-nums}
  .bboard{display:flex;flex-wrap:wrap;gap:2px;min-height:44px}
  .bu{position:relative;display:inline-flex;align-items:center}.star{position:absolute;bottom:-2px;left:2px;font-size:8px;color:#ffd24a;text-shadow:0 0 2px #000}
  .btraits{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
  .tag{background:var(--surface-1);border:1px solid var(--grid);border-radius:5px;padding:1px 6px;font-size:11px;color:var(--ink2)}
  .uhead{display:flex;align-items:flex-start;gap:16px;margin:4px 0 10px}.uhead-body{min-width:0}.tags{margin-top:5px;display:flex;gap:5px;flex-wrap:wrap}
  .bstats{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}
  .bs{display:flex;flex-direction:column;background:var(--chip);border:1px solid var(--grid);border-radius:7px;padding:4px 9px;min-width:42px}
  .bk{font-size:9px;color:var(--mut);letter-spacing:.03em}
  .bv{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums}
  .ability{background:var(--chip);border:1px solid var(--grid);border-radius:8px;padding:8px 12px;margin:6px 0}.ability p{margin:4px 0 0;font-size:12.5px;color:var(--ink2)}
  .tcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:8px 0}
  .tcard{background:var(--chip);border:1px solid var(--grid);border-radius:10px;padding:11px 13px}
  .tc-head{font-size:15px;font-weight:700;margin-bottom:9px;color:#f0b429}
  .tc-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px}
  .tc-stat{display:flex;flex-direction:column}
  .tc-k{font-size:10.5px;color:var(--mut)}
  .tc-v{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
  .stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:8px 0}
  .dmg-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}@media(max-width:620px){.dmg-cards{grid-template-columns:1fr}}
  .dmg-card{background:var(--chip);border:1px solid var(--grid);border-radius:9px;padding:0}
  .dmg-card>summary{list-style:none;cursor:pointer;padding:9px 12px;display:flex;flex-direction:column;gap:1px}
  .dmg-card>summary::-webkit-details-marker{display:none}
  .dmg-card>summary .sv{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}
  .dmg-card .caret{font-size:11px;color:var(--mut)}.dmg-card[open] .caret{transform:rotate(180deg);display:inline-block}
  .xb{padding:2px 12px 11px;border-top:1px solid var(--grid);margin-top:2px}
  .xb-h{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--mut);margin:9px 0 3px}
  .xrow{display:grid;grid-template-columns:1fr auto 48px;gap:8px;font-size:12.5px;padding:2px 0;align-items:baseline}
  .xk{color:var(--ink2)}.xv{font-variant-numeric:tabular-nums;font-weight:600;text-align:right}.xp{color:var(--mut);font-variant-numeric:tabular-nums;text-align:right}
  .stt{background:var(--chip);border:1px solid var(--grid);border-radius:8px;padding:7px 11px;display:flex;flex-direction:column}
  .sk{font-size:11px;color:var(--mut)}.sv{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}
</style>`
