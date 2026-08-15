/**
 * Bot-vs-bot economy LEAGUE simulator + report.
 *
 * Plays N headless 5-bot economy games (the trained personas, no human) using the
 * shared loop in botGame.ts with real creep/item-round cadence, aggregates
 * standings + balance metrics, and traces ONE seeded game round-by-round with a
 * full combat timeline (who dealt what damage to which unit, and when). Writes a
 * self-contained HTML report (inline SVG charts + text tables) plus optional JSON,
 * and prints a standings summary to stdout.
 *
 * Usage:
 *   npx tsx src/sim/botLeague.ts --games 50 --rounds 30 --seed 1 --out bot-league-report.html
 *   npx tsx src/sim/botLeague.ts --games 100 --format json --out league.json
 *   npx tsx src/sim/botLeague.ts --games 50 --ai-summary   (adds a plain-English summary — see aiSummary.ts)
 *   (or: npm run sim-bots -- --games 50)
 */

import { writeFileSync } from 'node:fs'
import { PERSONAS } from '../econ/bots'
import type { RunState, PlayerEcon } from '../econ/runState'
import { simulateBotGame, rankBots, seededRng, type FightResolver } from './botGame'
import { boardToSpecs } from '../econ/botMatches'
import { makeUnit } from '../core/unitFactory'
import { createCombatState, runCombat } from '../core/combatEngine'
import { calcBoardProfile } from '../enemy/boardPower'
import { UNIT_MAP } from '../data/units'
import { TRAIT_MAP } from '../data/traits'
import { TICK_RATE } from '../core/constants'
import { renderReportHtml, type LeagueReport, type TraceRound, type FightTrace, type LearnedAffinityRow } from './leagueReport'
import {
  establishedTraits, traitPairKey, unitContextKey, boardTraitSignature,
  traitDepths, traitDepthKey, breadthKey,
} from '../econ/compositionSignature'
import { stageOf } from '../econ/constants'
import { generateAiSummary, buildSummaryPrompt, type SummarySection } from '../econ/aiSummary'

// ─── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (n: string): string | null => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : null }
const hasFlag = (n: string): boolean => args.includes(`--${n}`)
const GAMES   = Math.max(1, parseInt(flag('games')  ?? '50', 10) || 50)
const ROUNDS  = Math.max(5, parseInt(flag('rounds') ?? '30', 10) || 30)
const SEED    = parseInt(flag('seed') ?? '1', 10) || 1
const FORMAT  = (flag('format') ?? 'html').toLowerCase()   // 'html' | 'json'
const OUT     = flag('out') ?? (FORMAT === 'json' ? 'bot-league-report.json' : 'bot-league-report.html')

const PIDS   = PERSONAS.map(p => p.id)
const PNAMES = new Map(PERSONAS.map(p => [p.id, p.name]))

// ─── Per-persona aggregate accumulators over N games ──────────────────────────
interface Agg { placements: number[]; finalHp: number[]; elimRound: number[] }
const agg = new Map<string, Agg>(PIDS.map(id => [id, { placements: [], finalHp: [], elimRound: [] }]))
const aliveByRound: number[] = new Array(ROUNDS + 1).fill(0)   // total alive across games, by round
const roundsSeen: number[]   = new Array(ROUNDS + 1).fill(0)
// Head-to-head: `${aId}>${bId}` fight wins, and total fights per unordered pair.
const h2hWins = new Map<string, number>()
const h2hTotal = new Map<string, number>()
const elimReg = new Map<string, number>()   // personaId → round it died (per game, reset each game)

// Per-unit combat aggregate across ALL games, keyed `${defId}|${tier}` (per star level).
// Damage breakdown fields shared by FightUnitStat and UTierAcc (all summable).
// d* = dealt, t* = taken. Type split: Phys/Magic/True. Source split: Auto/Spell/Emp
// (empowered-auto bonus damage). tShield = damage absorbed by this unit's shields.
const BREAK_KEYS = ['dPhys', 'dMagic', 'dTrue', 'dAuto', 'dSpell', 'dEmp', 'tPhys', 'tMagic', 'tTrue', 'tAuto', 'tSpell', 'tShield'] as const
type BreakKey = typeof BREAK_KEYS[number]
type Break = Record<BreakKey, number>
const zeroBreak = (): Break => Object.fromEntries(BREAK_KEYS.map(k => [k, 0])) as Break

// TraitTally: trait id → contributed amount (damage / heal / shield) this fight.
type TraitTally = Record<string, number>
interface Tallies { traitDmg: TraitTally; traitHeal: TraitTally; traitShield: TraitTally; traitMitigated: TraitTally; traitCount: TraitTally }
interface FightUnitStat extends Break, Tallies { defId: string; tier: number; team: 'a' | 'b'; dealt: number; taken: number; casts: number; kills: number; deaths: number; healSelf: number; healAlly: number; shieldSelf: number; shieldAlly: number }
interface UTierAcc extends Break, Tallies { fights: number; wins: number; dealt: number; taken: number; casts: number; kills: number; deaths: number; healSelf: number; healAlly: number; shieldSelf: number; shieldAlly: number }
const unitTierAgg = new Map<string, UTierAcc>()

// Composition-discovery observability (see src/econ/compositionSignature.ts,
// src/econ/learnedCompositionAffinities.ts): win/fight counts per trait-pair
// co-occurrence, per unit-in-board-context, per trait-depth, and per board
// breadth — reusing the same (stage-scoped) key formats the learned-affinity
// training pipeline uses, so this report and the trained tables always agree
// on what a key means. This report only OBSERVES — src/econ/trainCompositionAffinities.ts
// is what actually writes the trained file.
interface CompAcc { fights: number; wins: number }
const traitPairAgg = new Map<string, CompAcc>()
const unitContextAgg = new Map<string, CompAcc>()
const traitDepthAgg = new Map<string, CompAcc>()
const breadthAgg = new Map<string, CompAcc>()
function accComp(agg: Map<string, CompAcc>, key: string, won: boolean): void {
  let a = agg.get(key)
  if (!a) { a = { fights: 0, wins: 0 }; agg.set(key, a) }
  a.fights++; if (won) a.wins++
}
function recordCompositionOutcomes(board: Array<{ definitionId: string }>, round: number, won: boolean): void {
  const stage = stageOf(round)
  const traits = establishedTraits(board)
  for (let i = 0; i < traits.length; i++) {
    for (let j = i + 1; j < traits.length; j++) {
      accComp(traitPairAgg, traitPairKey(stage, traits[i], traits[j]), won)
    }
  }
  const signature = boardTraitSignature(board)
  if (signature) for (const u of board) accComp(unitContextAgg, unitContextKey(stage, u.definitionId, signature), won)
  for (const { trait, depth } of traitDepths(board)) accComp(traitDepthAgg, traitDepthKey(stage, trait, depth), won)
  accComp(breadthAgg, breadthKey(stage, traits.length), won)
}
const mergeTally = (into: TraitTally, from: TraitTally): void => { for (const k in from) into[k] = (into[k] ?? 0) + from[k] }
// Round a live trait tally (drop sub-1 noise) for embedding.
const roundTally = (m: TraitTally): TraitTally => { const o: TraitTally = {}; for (const k in m) if (m[k] >= 0.5) o[k] = Math.round(m[k] * 100) / 100; return o }
const emptyTallies = (): Tallies => ({ traitDmg: {}, traitHeal: {}, traitShield: {}, traitMitigated: {}, traitCount: {} })
const readTallies = (u: { traitDmg: TraitTally; traitHeal: TraitTally; traitShield: TraitTally; traitMitigated: TraitTally; traitCount: TraitTally }): Tallies =>
  ({ traitDmg: roundTally(u.traitDmg), traitHeal: roundTally(u.traitHeal), traitShield: roundTally(u.traitShield), traitMitigated: roundTally(u.traitMitigated), traitCount: roundTally(u.traitCount) })
function accUnit(us: FightUnitStat, won: boolean): void {
  const key = `${us.defId}|${us.tier}`
  let a = unitTierAgg.get(key)
  if (!a) { a = { fights: 0, wins: 0, dealt: 0, taken: 0, casts: 0, kills: 0, deaths: 0, healSelf: 0, healAlly: 0, shieldSelf: 0, shieldAlly: 0, ...emptyTallies(), ...zeroBreak() }; unitTierAgg.set(key, a) }
  a.fights++; if (won) a.wins++
  a.dealt += us.dealt; a.taken += us.taken; a.casts += us.casts; a.kills += us.kills; a.deaths += us.deaths
  a.healSelf += us.healSelf; a.healAlly += us.healAlly; a.shieldSelf += us.shieldSelf; a.shieldAlly += us.shieldAlly
  mergeTally(a.traitDmg, us.traitDmg); mergeTally(a.traitHeal, us.traitHeal); mergeTally(a.traitShield, us.traitShield)
  mergeTally(a.traitMitigated, us.traitMitigated); mergeTally(a.traitCount, us.traitCount)
  for (const k of BREAK_KEYS) a[k] += us[k]
}

function pidOf(run: RunState, slot: number): string { return run.players[slot].personaId! }

// Every game runs with a full combat timeline, but a game's trace is only RETAINED
// when it introduces a unit not already covered by a kept game (greedy online
// set-cover). This GUARANTEES every unit that ever fought has ≥1 clickable traced
// game, while keeping the embedded JSON as small as that guarantee allows — most
// games saturate coverage quickly and are discarded. `game` in a kept trace is its
// original game index (so seeds/labels stay meaningful).
const traceRounds: TraceRound[] = []
const traceFights: FightTrace[] = []
const coveredUnits = new Set<string>()
let tracedGameCount = 0

for (let g = 0; g < GAMES; g++) {
  elimReg.clear()
  const rng = seededRng(SEED + g * 7919)
  const fBefore = traceFights.length, rBefore = traceRounds.length

  const recordFight: FightResolver = (a, b, meta) => {
    // Real combat with per-unit stat capture (+ the full timeline, recorded for
    // possible retention below), plus head-to-head + per-unit aggregate.
    const { result, unitStats } = tracedFight(a, b, meta.round, g)
    for (const us of unitStats) accUnit(us, us.team === result.winner)
    if (result.winner !== 'draw') {
      const wId = result.winner === 'a' ? a.personaId! : b.personaId!
      const lId = result.winner === 'a' ? b.personaId! : a.personaId!
      h2hWins.set(`${wId}>${lId}`, (h2hWins.get(`${wId}>${lId}`) ?? 0) + 1)
      recordCompositionOutcomes(a.board, meta.round, result.winner === 'a')
      recordCompositionOutcomes(b.board, meta.round, result.winner === 'b')
    }
    const key = pairKey(a.personaId!, b.personaId!)
    h2hTotal.set(key, (h2hTotal.get(key) ?? 0) + 1)
    return result
  }

  const run = simulateBotGame({
    rng, maxRounds: ROUNDS, realCadence: true, fightResolver: recordFight,
    onRoundEnd: (round, r) => {
      let alive = 0
      for (let s = 1; s <= 5; s++) {
        if (!r.players[s].eliminated) alive++
        else if (!elimReg.has(pidOf(r, s))) elimReg.set(pidOf(r, s), round)
      }
      aliveByRound[round] += alive
      roundsSeen[round]++
      traceRounds.push(snapshotRound(round, r, g))
    },
  })

  // Keep this game's trace iff it logged a unit no kept game has yet — otherwise
  // roll back everything it pushed. Guarantees full coverage with the fewest games.
  let addsNew = false
  for (let fi = fBefore; fi < traceFights.length; fi++) {
    for (const lg of traceFights[fi].logs) if (!coveredUnits.has(lg.defId)) { addsNew = true; break }
    if (addsNew) break
  }
  if (addsNew) {
    for (let fi = fBefore; fi < traceFights.length; fi++) for (const lg of traceFights[fi].logs) coveredUnits.add(lg.defId)
    tracedGameCount++
  } else {
    traceFights.length = fBefore
    traceRounds.length = rBefore
  }

  const placement = rankBots(run)
  for (let s = 1; s <= 5; s++) {
    const id = pidOf(run, s)
    const a = agg.get(id)!
    a.placements.push(placement[s])
    a.finalHp.push(Math.max(0, run.players[s].hp))
    a.elimRound.push(elimReg.get(id) ?? ROUNDS)   // survived to the end → last round
  }
}
console.log(`Traced ${tracedGameCount}/${GAMES} games for full coverage of ${coveredUnits.size} units.`)

// ─── Metrics → report object ──────────────────────────────────────────────────
const report = buildReport()

if (hasFlag('ai-summary')) {
  console.log('\nAsking `claude` for a plain-English summary…')
  const unitName = (id: string): string => UNIT_MAP.get(id)?.name ?? id
  const traitName = (id: string): string => TRAIT_MAP.get(id)?.name ?? id
  const top = (rows: LearnedAffinityRow[], label: (key: string) => string) => rows.slice(0, 15).map(r => ({ label: label(r.key), winRate: r.winRate, samples: r.samples }))
  const bottom = (rows: LearnedAffinityRow[], label: (key: string) => string) => rows.slice(-15).reverse().map(r => ({ label: label(r.key), winRate: r.winRate, samples: r.samples }))
  const pairLabel = (key: string) => { const [stage, a, b] = key.split('|'); return `stage ${stage}: ${traitName(a)} + ${traitName(b)}` }
  const ctxLabel = (key: string) => { const [stage, defId, sig] = key.split('|'); return `stage ${stage}: ${unitName(defId)} onto ${sig.split('+').map(traitName).join(' + ')}` }
  const depthLabel = (key: string) => { const [stage, trait, depth] = key.split('|'); return `stage ${stage}: ${traitName(trait)} pushed to breakpoint ${depth}` }
  const breadthLabel = (key: string) => { const [stage, count] = key.split('|'); return `stage ${stage}: ${count} distinct active traits` }

  const sections: SummarySection[] = [
    {
      title: 'Standings (win rate by persona)',
      preferred: report.standings.map(s => ({ label: s.name, winRate: s.winRate, samples: GAMES })),
      avoided: [],
    },
    {
      title: 'Trait-pair compositions (this run)',
      preferred: top(report.traitPairs, pairLabel),
      avoided: bottom(report.traitPairs, pairLabel),
    },
    {
      title: 'Unit splashed onto an established comp (this run)',
      preferred: top(report.unitContexts, ctxLabel),
      avoided: bottom(report.unitContexts, ctxLabel),
    },
    {
      title: 'Investing heavy into one trait (this run)',
      preferred: top(report.traitDepths, depthLabel),
      avoided: bottom(report.traitDepths, depthLabel),
    },
    {
      title: 'Wide vs. narrow board breadth (this run)',
      preferred: top(report.breadths, breadthLabel),
      avoided: bottom(report.breadths, breadthLabel),
    },
  ]
  const prompt = buildSummaryPrompt(
    `Below is data from a ${GAMES}-game bot-vs-bot league simulation for an autobattler game — standings, and this-run observed win rates for trait pairs, unit/composition combos, trait investment depth, and board breadth, broken down by game stage.`,
    sections,
  )
  const summary = generateAiSummary(prompt)
  if (summary) report.aiSummary = summary
}

if (FORMAT === 'json') {
  writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf-8')
} else {
  writeFileSync(OUT, renderReportHtml(report), 'utf-8')
}
printSummary()
console.log(`\nWrote ${FORMAT.toUpperCase()} report → ${OUT}`)

// ─── Fight resolvers ──────────────────────────────────────────────────────────
type FightResult = { winner: 'a' | 'b' | 'draw'; survivorStars: number }
const boardOnlyStats = (e: PlayerEcon, team: 'a' | 'b'): FightUnitStat[] =>
  e.board.map(u => ({ defId: u.definitionId, tier: u.tier, team, dealt: 0, taken: 0, casts: 0, kills: 0, deaths: 0, healSelf: 0, healAlly: 0, shieldSelf: 0, shieldAlly: 0, ...emptyTallies(), ...zeroBreak() }))

// Trace-mode fight: real combat with per-unit stats AND the full damage timeline,
// which it records into traceFights tagged with game+round (or a forfeit if a board
// is empty). Every league fight runs through this; discarded games are rolled back.
function tracedFight(a: PlayerEcon, b: PlayerEcon, round: number, game: number): { result: FightResult; unitStats: FightUnitStat[] } {
  if (a.board.length === 0 && b.board.length === 0) return { result: { winner: 'draw', survivorStars: 0 }, unitStats: [] }
  if (a.board.length === 0) return { result: { winner: 'b', survivorStars: starSum(b) }, unitStats: boardOnlyStats(b, 'b') }
  if (b.board.length === 0) return { result: { winner: 'a', survivorStars: starSum(a) }, unitStats: boardOnlyStats(a, 'a') }
  const { result, unitStats, trace } = runOneCombat(a, b, 'full')
  if (trace) { trace.game = game; trace.round = round; trace.aName = a.name; trace.bName = b.name; traceFights.push(trace) }
  return { result, unitStats }
}

// One real combat between two boards. Always returns per-unit stats (dealt/taken/
// casts/kills/deaths for EVERY fielded unit); mode 'full' also builds the timeline.
function runOneCombat(a: PlayerEcon, b: PlayerEcon, mode: 'stats' | 'full'): {
  result: FightResult; unitStats: FightUnitStat[]; trace?: FightTrace
} {
  const full = mode === 'full'
  const aSpecs = boardToSpecs(a, false)
  const bSpecs = boardToSpecs(b, true)
  const pUnits = aSpecs.map(s => { const u = makeUnit(s.id, 'player', s.tier); u.hexPos = { col: s.col, row: s.row }; if (s.item) u.items = [s.item]; return u })
  const eUnits = bSpecs.map(s => { const u = makeUnit(s.id, 'enemy', s.tier); u.hexPos = { col: s.col, row: s.row }; if (s.item) u.items = [s.item]; return u })

  const label = (u: ReturnType<typeof makeUnit>) => `${u.name}${u.tier > 1 ? '★'.repeat(u.tier) : ''}`
  const nameById = new Map<string, string>(), defById = new Map<string, string>(), teamOf = new Map<string, 'a' | 'b'>()
  for (const u of pUnits) { nameById.set(u.id, label(u)); defById.set(u.id, u.definitionId); teamOf.set(u.id, 'a') }
  for (const u of eUnits) { nameById.set(u.id, label(u)); defById.set(u.id, u.definitionId); teamOf.set(u.id, 'b') }

  const dealtBy = new Map<string, number>(), takenBy = new Map<string, number>()
  const castsBy = new Map<string, number>(), killsBy = new Map<string, number>(), deathsBy = new Map<string, number>()
  const healSelfBy = new Map<string, number>(), healAllyBy = new Map<string, number>()       // healing done, split
  const shieldSelfBy = new Map<string, number>(), shieldAllyBy = new Map<string, number>()   // shielding done, split
  const brk = new Map<string, Break>()   // per-unit damage-type / source breakdown
  const B = (id: string): Break => { let b = brk.get(id); if (!b) { b = zeroBreak(); brk.set(id, b) } return b }
  const cumBySecond = new Map<string, number[]>()
  const kills: { tick: number; victimId: string; killerId: string; ability: string }[] = []
  let lastSecond = 0
  const inc = (m: Map<string, number>, k: string, v = 1) => m.set(k, (m.get(k) ?? 0) + v)

  // Full-mode per-unit event log (for the interactive unit-in-a-fight detail view).
  // Compact keys: t=second, a=amount, dt=type(0 phys/1 magic/2 true), s=source(0 auto/1 spell/2 emp),
  // g=other unit name, gd=other unit defId (for its sprite), ab=how the hit was dealt
  // (readable: "an auto-attack" / "an empowered auto-attack" / the ability's name),
  // k/d=kill/died flag. _tid/_sid are stripped before embedding.
  type DealtEv = { t: number; a: number; dt: number; s: number; g: string; gd: string; ab: string; k: number; _tid: string }
  type TakenEv = { t: number; a: number; dt: number; s: number; g: string; gd: string; ab: string; d: number; _sid: string }
  interface ULog { dealt: DealtEv[]; taken: TakenEv[]; cast: number[]; heal: { t: number; a: number; g: string; self: number }[]; shield: { t: number; a: number; g: string; self: number }[]; absorb: { t: number; a: number }[] }
  const uLog = new Map<string, ULog>()
  const L = (id: string): ULog => { let l = uLog.get(id); if (!l) { l = { dealt: [], taken: [], cast: [], heal: [], shield: [], absorb: [] }; uLog.set(id, l) } return l }
  const r2 = (t: number): number => Math.round((t / TICK_RATE) * 100) / 100
  // Readable name for how a hit was dealt, from its source-category + source unit's ability.
  const abName = (sourceId: string, src: number): string =>
    src === 0 ? 'an auto-attack'
    : src === 2 ? 'an empowered auto-attack'
    : (UNIT_MAP.get(defById.get(sourceId) ?? '')?.ability?.name ?? 'its ability')

  const state = createCombatState(pUnits, eUnits)
  runCombat(state, {
    onTickEnd: (tick, events) => {
      const sec = Math.floor(tick / TICK_RATE)
      if (full) lastSecond = Math.max(lastSecond, sec)
      for (const ev of events) {
        if (ev.type === 'damage') {
          if (ev.absorbed && ev.absorbed > 0) { B(ev.targetId).tShield += ev.absorbed; if (full) L(ev.targetId).absorb.push({ t: r2(tick), a: Math.round(ev.absorbed) }) }
          if (ev.amount > 0) {
            inc(dealtBy, ev.sourceId, ev.amount); inc(takenBy, ev.targetId, ev.amount)
            const bs = B(ev.sourceId), bt = B(ev.targetId)
            const dt = ev.damageType === 'physical' ? 0 : ev.damageType === 'magic' ? 1 : 2
            const src = ev.empowered ? 2 : ev.abilityId === 'auto_attack' ? 0 : ev.abilityId ? 1 : 0
            if (dt === 0) { bs.dPhys += ev.amount; bt.tPhys += ev.amount }
            else if (dt === 1) { bs.dMagic += ev.amount; bt.tMagic += ev.amount }
            else { bs.dTrue += ev.amount; bt.tTrue += ev.amount }
            // By source. Dealt: empowered/auto/spell; taken folds empowered into "from autos".
            if (src === 2) { bs.dEmp += ev.amount; bt.tAuto += ev.amount }
            else if (src === 1) { bs.dSpell += ev.amount; bt.tSpell += ev.amount }
            else { bs.dAuto += ev.amount; bt.tAuto += ev.amount }
            if (full) {
              let arr = cumBySecond.get(ev.sourceId); if (!arr) { arr = []; cumBySecond.set(ev.sourceId, arr) } arr[sec] = (arr[sec] ?? 0) + ev.amount
              const ab = abName(ev.sourceId, src)
              L(ev.sourceId).dealt.push({ t: r2(tick), a: Math.round(ev.amount), dt, s: src, g: nameById.get(ev.targetId) ?? '?', gd: defById.get(ev.targetId) ?? '', ab, k: 0, _tid: ev.targetId })
              L(ev.targetId).taken.push({ t: r2(tick), a: Math.round(ev.amount), dt, s: src, g: nameById.get(ev.sourceId) ?? '?', gd: defById.get(ev.sourceId) ?? '', ab, d: 0, _sid: ev.sourceId })
            }
          }
        } else if (ev.type === 'cast') {
          inc(castsBy, ev.unitId)
          if (full) L(ev.unitId).cast.push(r2(tick))
        } else if (ev.type === 'heal' && ev.amount > 0) {
          inc(ev.sourceId === ev.targetId ? healSelfBy : healAllyBy, ev.sourceId, ev.amount)
          if (full) L(ev.sourceId).heal.push({ t: r2(tick), a: Math.round(ev.amount), g: nameById.get(ev.targetId) ?? '?', self: ev.sourceId === ev.targetId ? 1 : 0 })
        } else if (ev.type === 'shield' && ev.amount > 0 && ev.sourceId) {
          inc(ev.sourceId === ev.unitId ? shieldSelfBy : shieldAllyBy, ev.sourceId, ev.amount)
          if (full) L(ev.sourceId).shield.push({ t: r2(tick), a: Math.round(ev.amount), g: nameById.get(ev.unitId) ?? '?', self: ev.sourceId === ev.unitId ? 1 : 0 })
        } else if (ev.type === 'death') {
          inc(deathsBy, ev.unitId); if (ev.sourceId) inc(killsBy, ev.sourceId)
          if (full) {
            kills.push({ tick, victimId: ev.unitId, killerId: ev.sourceId ?? '', ability: ev.abilityId ?? 'auto' })
            // Mark the killing blow: the killer's last damage to this victim, and the victim's last damage taken.
            if (ev.sourceId) { const d = L(ev.sourceId).dealt; for (let i = d.length - 1; i >= 0; i--) if (d[i]._tid === ev.unitId) { d[i].k = 1; break } }
            const tk = L(ev.unitId).taken; if (tk.length) tk[tk.length - 1].d = 1
          }
        }
      }
    },
  })

  const winner: 'a' | 'b' | 'draw' = state.phase === 'playerWin' ? 'a' : state.phase === 'enemyWin' ? 'b' : 'draw'
  const survStars = (team: 'player' | 'enemy') =>
    [...state.units.values()].filter(u => u.team === team && u.state !== 'dead' && !u.isDummy).reduce((s, u) => s + u.tier, 0)
  const survivorStars = winner === 'a' ? survStars('player') : winner === 'b' ? survStars('enemy') : 0

  // Per-unit stats for EVERY fielded unit (so appearances / win rate count units that did nothing).
  const unitStats: FightUnitStat[] = [...pUnits, ...eUnits].map(u => ({
    defId: u.definitionId, tier: u.tier, team: teamOf.get(u.id)!,
    dealt: Math.round(dealtBy.get(u.id) ?? 0), taken: Math.round(takenBy.get(u.id) ?? 0),
    casts: castsBy.get(u.id) ?? 0, kills: killsBy.get(u.id) ?? 0, deaths: deathsBy.get(u.id) ?? 0,
    healSelf: Math.round(healSelfBy.get(u.id) ?? 0), healAlly: Math.round(healAllyBy.get(u.id) ?? 0),
    shieldSelf: Math.round(shieldSelfBy.get(u.id) ?? 0), shieldAlly: Math.round(shieldAllyBy.get(u.id) ?? 0),
    ...readTallies(u),
    ...(brk.get(u.id) ?? zeroBreak()),
  }))

  let trace: FightTrace | undefined
  if (full) {
    const mk = (id: string) => ({ defId: defById.get(id) ?? id, unit: nameById.get(id) ?? id, team: teamOf.get(id) ?? 'a' as const })
    const series = [...cumBySecond.entries()].map(([id, perSec]) => {
      let run = 0; const pts: number[] = []
      for (let s = 0; s <= lastSecond; s++) { run += perSec[s] ?? 0; pts.push(Math.round(run)) }
      return { ...mk(id), points: pts }
    }).sort((x, y) => (y.points[y.points.length - 1] ?? 0) - (x.points[x.points.length - 1] ?? 0))
    const allIds = new Set([...dealtBy.keys(), ...takenBy.keys()])
    const perUnit = [...allIds].map(id => ({ ...mk(id), dealt: Math.round(dealtBy.get(id) ?? 0), taken: Math.round(takenBy.get(id) ?? 0) })).sort((x, y) => y.dealt - x.dealt)
    // Per-unit event logs for the interactive unit-in-a-fight detail view.
    const logs = [...pUnits, ...eUnits].map(u => {
      const l = uLog.get(u.id) ?? { dealt: [], taken: [], cast: [], heal: [], shield: [], absorb: [] }
      return {
        defId: u.definitionId, name: nameById.get(u.id)!, team: teamOf.get(u.id)!, tier: u.tier as 1 | 2 | 3, item: u.items[0],
        dealt: l.dealt.map(({ _tid, ...e }) => e), taken: l.taken.map(({ _sid, ...e }) => e),
        cast: l.cast, heal: l.heal, shield: l.shield, absorb: l.absorb,
        ...readTallies(u),
      }
    })
    trace = {
      game: 0, round: 0, aName: a.name, bName: b.name, winner, durationSec: +(state.tick / TICK_RATE).toFixed(1), seconds: lastSecond, perUnit, series, logs,
      kills: kills.map(k => ({ sec: +(k.tick / TICK_RATE).toFixed(1), victim: nameById.get(k.victimId) ?? k.victimId, victimDef: defById.get(k.victimId) ?? '', killer: nameById.get(k.killerId) ?? '—', killerDef: defById.get(k.killerId) ?? '', ability: k.ability })),
    }
  }
  return { result: { winner, survivorStars }, unitStats, trace }
}

// ─── Per-round econ snapshot for the trace game ───────────────────────────────
function snapshotRound(round: number, run: RunState, game: number): TraceRound {
  const bots = PIDS.map(id => {
    const slot = run.players.findIndex(p => p.personaId === id)
    const p = run.players[slot]
    const profile = calcBoardProfile(p.board.map(u => { const un = makeUnit(u.definitionId, 'player', u.tier); if (u.item) un.items = [u.item]; return un }))
    const traits = profile.activeTraits.map(t => ({ trait: t.trait, count: t.count, level: t.thresholdLevel }))
    const board = [...p.board]
      .sort((x, y) => (UNIT_MAP.get(y.definitionId)!.cost * y.tier) - (UNIT_MAP.get(x.definitionId)!.cost * x.tier))
      .map(u => ({ defId: u.definitionId, tier: u.tier, item: u.item }))
    return {
      persona: id, name: PNAMES.get(id)!,
      hp: Math.max(0, p.hp), gold: p.gold, level: p.level, streak: p.streak,
      power: Math.round(profile.power), units: p.board.length, eliminated: p.eliminated,
      traits, board,
    }
  })
  return { game, round, bots }
}

// ─── Build the report metrics object ──────────────────────────────────────────
function buildReport(): LeagueReport {
  const standings = PIDS.map(id => {
    const a = agg.get(id)!
    const n = a.placements.length || 1
    const dist = [0, 0, 0, 0, 0]
    for (const pl of a.placements) dist[pl - 1]++
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1)
    return {
      persona: id, name: PNAMES.get(id)!,
      winRate: dist[0] / n, top2Rate: (dist[0] + dist[1]) / n,
      avgPlacement: +mean(a.placements).toFixed(2),
      placementDist: dist,
      avgFinalHp: Math.round(mean(a.finalHp)),
      avgElimRound: +mean(a.elimRound).toFixed(1),
    }
  }).sort((x, y) => x.avgPlacement - y.avgPlacement)

  const survival = { rounds: [] as number[], avgAlive: [] as number[] }
  for (let r = 1; r <= ROUNDS; r++) {
    if (roundsSeen[r] === 0) continue
    survival.rounds.push(r)
    survival.avgAlive.push(+(aliveByRound[r] / roundsSeen[r]).toFixed(2))
  }

  const h2h = PIDS.map(aId => PIDS.map(bId => {
    if (aId === bId) return null
    const total = h2hTotal.get(pairKey(aId, bId)) ?? 0
    if (total === 0) return null
    return +((h2hWins.get(`${aId}>${bId}`) ?? 0) / total).toFixed(2)
  }))

  // Per-unit aggregate across ALL games, split by star level.
  const defIds = new Set<string>()
  for (const key of unitTierAgg.keys()) defIds.add(key.split('|')[0])
  const units = [...defIds].map(defId => {
    let fields = 0, wins = 0, dealt = 0, taken = 0, hSelf = 0, hAlly = 0, sSelf = 0, sAlly = 0
    const bsum = zeroBreak()
    const tDmg: TraitTally = {}, tHeal: TraitTally = {}, tShield: TraitTally = {}, tMit: TraitTally = {}, tCount: TraitTally = {}
    const perTier: LeagueReport['units'][number]['perTier'] = []
    for (let tier = 1 as 1 | 2 | 3; tier <= 3; tier++) {
      const acc = unitTierAgg.get(`${defId}|${tier}`)
      if (!acc || acc.fights === 0) continue
      fields += acc.fights; wins += acc.wins; dealt += acc.dealt; taken += acc.taken
      hSelf += acc.healSelf; hAlly += acc.healAlly; sSelf += acc.shieldSelf; sAlly += acc.shieldAlly
      mergeTally(tDmg, acc.traitDmg); mergeTally(tHeal, acc.traitHeal); mergeTally(tShield, acc.traitShield)
      mergeTally(tMit, acc.traitMitigated); mergeTally(tCount, acc.traitCount)
      for (const k of BREAK_KEYS) bsum[k] += acc[k]
      perTier.push({
        tier, fields: acc.fights, winRate: acc.wins / acc.fights,
        avgDealt: acc.dealt / acc.fights, avgTaken: acc.taken / acc.fights,
        avgCasts: acc.casts / acc.fights, avgKills: acc.kills / acc.fights, avgDeaths: acc.deaths / acc.fights,
        avgHealSelf: acc.healSelf / acc.fights, avgHealAlly: acc.healAlly / acc.fights,
        avgShieldSelf: acc.shieldSelf / acc.fights, avgShieldAlly: acc.shieldAlly / acc.fights,
      })
    }
    const per = (n: number): number => fields ? n / fields : 0
    return {
      defId, fields, winRate: fields ? wins / fields : 0,
      avgDealt: per(dealt), avgTaken: per(taken),
      avgHealSelf: per(hSelf), avgHealAlly: per(hAlly), avgShieldSelf: per(sSelf), avgShieldAlly: per(sAlly),
      dealtBreak: { phys: per(bsum.dPhys), magic: per(bsum.dMagic), trueDmg: per(bsum.dTrue), auto: per(bsum.dAuto), spell: per(bsum.dSpell), emp: per(bsum.dEmp) },
      takenBreak: { phys: per(bsum.tPhys), magic: per(bsum.tMagic), trueDmg: per(bsum.tTrue), auto: per(bsum.tAuto), spell: per(bsum.tSpell), shield: per(bsum.tShield) },
      // Per-trait contribution, averaged per fight (only traits that contributed).
      traitContrib: Object.fromEntries([...new Set([...Object.keys(tDmg), ...Object.keys(tHeal), ...Object.keys(tShield), ...Object.keys(tMit), ...Object.keys(tCount)])]
        .map(t => [t, { dmg: per(tDmg[t] ?? 0), heal: per(tHeal[t] ?? 0), shield: per(tShield[t] ?? 0), mitigated: per(tMit[t] ?? 0), count: per(tCount[t] ?? 0) }])),
      perTier,
    }
  }).filter(u => u.fields > 0).sort((x, y) => y.winRate - x.winRate || y.fields - x.fields)

  const MIN_COMP_SAMPLES = 5
  const compRows = (agg: Map<string, CompAcc>) => [...agg.entries()]
    .filter(([, a]) => a.fights >= MIN_COMP_SAMPLES)
    .map(([key, a]) => ({ key, winRate: a.wins / a.fights, samples: a.fights }))
    .sort((x, y) => y.winRate - x.winRate)
  const traitPairs = compRows(traitPairAgg)
  const unitContexts = compRows(unitContextAgg)
  const traitDepthRows = compRows(traitDepthAgg)
  const breadthRows = compRows(breadthAgg)

  return {
    meta: { games: GAMES, rounds: ROUNDS, seed: SEED, generatedAt: new Date().toISOString() },
    personaOrder: PIDS, personaNames: Object.fromEntries(PNAMES),
    standings, survival, h2h, units, traceRounds, traceFights,
    traitPairs, unitContexts, traitDepths: traitDepthRows, breadths: breadthRows,
  }
}

function printSummary(): void {
  console.log(`\nBot League — ${GAMES} games, ${ROUNDS} rounds, seed ${SEED}\n`)
  console.log('  Persona                 Win%   Top2%  AvgPlace  AvgHP  AvgElim')
  console.log('  ' + '─'.repeat(66))
  for (const s of report.standings) {
    console.log(
      '  ' + s.name.padEnd(22) +
      `  ${(s.winRate * 100).toFixed(0).padStart(4)}%` +
      `  ${(s.top2Rate * 100).toFixed(0).padStart(4)}%` +
      `  ${s.avgPlacement.toFixed(2).padStart(7)}` +
      `  ${String(s.avgFinalHp).padStart(5)}` +
      `  ${s.avgElimRound.toFixed(1).padStart(6)}`,
    )
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function starSum(e: PlayerEcon): number { return e.board.reduce((s, u) => s + u.tier, 0) }
function pairKey(a: string, b: string): string { return [a, b].sort().join('|') }
