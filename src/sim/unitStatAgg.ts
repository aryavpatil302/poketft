// Shared per-unit combat-stat shape + the stage/shiny aggregator.
//
// Moved out of src/sim/botLeague.ts on purpose: that file is a CLI script that
// plays a full bot league at import time (top-level `for` loop over --games),
// so nothing defined in it can be unit-tested in place without actually running
// a league. This module is pure, data-only (no combat engine, no fs, no CLI
// arg parsing) so it can be exercised directly with hand-built fixtures.
//
// `accUnit` in botLeague.ts and `recordShinyStageStat` here both funnel through
// the single `addFightStat` below, so the existing per-star-level aggregate and
// the new per-stage shiny/non-shiny aggregate can never drift apart in what
// they count or how they count it.

import { stageOf } from '../econ/constants'
import type { ShinyStageRow, ShinyStageSide } from './leagueReport'

// ─── Damage breakdown (shared by FightUnitStat and UTierAcc, all summable) ────
// d* = dealt, t* = taken. Type split: Phys/Magic/True. Source split: Auto/Spell/Emp
// (empowered-auto bonus damage). tShield = damage absorbed by this unit's shields.
export const BREAK_KEYS = ['dPhys', 'dMagic', 'dTrue', 'dAuto', 'dSpell', 'dEmp', 'tPhys', 'tMagic', 'tTrue', 'tAuto', 'tSpell', 'tShield'] as const
export type BreakKey = typeof BREAK_KEYS[number]
export type Break = Record<BreakKey, number>
export const zeroBreak = (): Break => Object.fromEntries(BREAK_KEYS.map(k => [k, 0])) as Break

// TraitTally: trait id → contributed amount (damage / heal / shield) this fight.
export type TraitTally = Record<string, number>
export interface Tallies { traitDmg: TraitTally; traitHeal: TraitTally; traitShield: TraitTally; traitMitigated: TraitTally; traitCount: TraitTally }
export const emptyTallies = (): Tallies => ({ traitDmg: {}, traitHeal: {}, traitShield: {}, traitMitigated: {}, traitCount: {} })
export const mergeTally = (into: TraitTally, from: TraitTally): void => { for (const k in from) into[k] = (into[k] ?? 0) + from[k] }

// One fielded unit's stats for a single fight. `isShiny` is required (not
// optional) so the compiler points at every construction site — the only two
// places a FightUnitStat is built are runOneCombat's unitStats map and
// boardOnlyStats's forfeit path, both in botLeague.ts.
export interface FightUnitStat extends Break, Tallies {
  defId: string; tier: number; team: 'a' | 'b'; isShiny: boolean
  dealt: number; taken: number; casts: number; kills: number; deaths: number
  healSelf: number; healAlly: number; shieldSelf: number; shieldAlly: number
}

// Running accumulator for a key (per-star-level in botLeague.ts's unitTierAgg,
// per-species-per-stage-per-shiny-flag in this module's shinyStageAgg).
export interface UTierAcc extends Break, Tallies {
  fights: number; wins: number
  dealt: number; taken: number; casts: number; kills: number; deaths: number
  healSelf: number; healAlly: number; shieldSelf: number; shieldAlly: number
}

export function newUTierAcc(): UTierAcc {
  return {
    fights: 0, wins: 0, dealt: 0, taken: 0, casts: 0, kills: 0, deaths: 0,
    healSelf: 0, healAlly: 0, shieldSelf: 0, shieldAlly: 0,
    ...emptyTallies(), ...zeroBreak(),
  }
}

// The accumulate-into-UTierAcc body, shared by every aggregate that feeds off
// a FightUnitStat — so their stat sets cannot drift.
export function addFightStat(acc: UTierAcc, us: FightUnitStat, won: boolean): void {
  acc.fights++; if (won) acc.wins++
  acc.dealt += us.dealt; acc.taken += us.taken; acc.casts += us.casts; acc.kills += us.kills; acc.deaths += us.deaths
  acc.healSelf += us.healSelf; acc.healAlly += us.healAlly; acc.shieldSelf += us.shieldSelf; acc.shieldAlly += us.shieldAlly
  mergeTally(acc.traitDmg, us.traitDmg); mergeTally(acc.traitHeal, us.traitHeal); mergeTally(acc.traitShield, us.traitShield)
  mergeTally(acc.traitMitigated, us.traitMitigated); mergeTally(acc.traitCount, us.traitCount)
  for (const k of BREAK_KEYS) acc[k] += us[k]
}

// At most one shiny may be fielded per board (see hasFieldedShiny in
// runState.ts), so shiny samples are an order of magnitude rarer than the
// composition keys MIN_COMP_SAMPLES = 5 gates in botLeague.ts. A 3-game
// baseline run produced 6-8 shiny fights per stage for the most-fielded
// species and 3 for the rarest, so a 5-sample gate would erase most species.
export const MIN_SHINY_STAGE_SAMPLES = 2

// Keyed `${defId}|${stage}|${'s'|'n'}` — accumulated for EVERY species, shiny
// or not, because we cannot know upfront which species will roll shiny; the
// map is bounded at roughly species × stages × 2. Filtering to shiny-touched
// species happens at build time, in buildShinyStageRows.
export function recordShinyStageStat(agg: Map<string, UTierAcc>, us: FightUnitStat, round: number, won: boolean): void {
  const stage = stageOf(round)
  const key = `${us.defId}|${stage}|${us.isShiny ? 's' : 'n'}`
  let acc = agg.get(key)
  if (!acc) { acc = newUTierAcc(); agg.set(key, acc) }
  addFightStat(acc, us, won)
}

// Matches the perTier computation in botLeague.ts's buildReport, field for field.
function toSide(acc: UTierAcc): ShinyStageSide {
  const fields = acc.fights
  const per = (n: number): number => fields ? n / fields : 0
  return {
    fields,
    winRate: per(acc.wins),
    avgDealt: per(acc.dealt), avgTaken: per(acc.taken),
    avgCasts: per(acc.casts), avgKills: per(acc.kills), avgDeaths: per(acc.deaths),
    avgHealSelf: per(acc.healSelf), avgHealAlly: per(acc.healAlly),
    avgShieldSelf: per(acc.shieldSelf), avgShieldAlly: per(acc.shieldAlly),
  }
}

// Group by defId|stage; keep a row only when its shiny side exists and has at
// least `minSamples` fights. Attach the same defId|stage's non-shiny
// accumulator as the nonShiny side, or null when that species never fought
// non-shiny at that stage. The non-shiny side is NOT gated on sample count —
// it is context, and its own fields count is carried so a reader can judge it.
export function buildShinyStageRows(agg: Map<string, UTierAcc>, minSamples: number = MIN_SHINY_STAGE_SAMPLES): ShinyStageRow[] {
  const byDefStage = new Map<string, { shiny?: UTierAcc; nonShiny?: UTierAcc }>()
  for (const [key, acc] of agg) {
    const [defId, stageStr, flag] = key.split('|')
    const dsKey = `${defId}|${stageStr}`
    let entry = byDefStage.get(dsKey)
    if (!entry) { entry = {}; byDefStage.set(dsKey, entry) }
    if (flag === 's') entry.shiny = acc
    else entry.nonShiny = acc
  }
  const rows: ShinyStageRow[] = []
  for (const [dsKey, entry] of byDefStage) {
    if (!entry.shiny || entry.shiny.fights < minSamples) continue
    const [defId, stageStr] = dsKey.split('|')
    rows.push({
      defId, stage: Number(stageStr),
      shiny: toSide(entry.shiny),
      nonShiny: entry.nonShiny ? toSide(entry.nonShiny) : null,
    })
  }
  rows.sort((a, b) => a.defId.localeCompare(b.defId) || a.stage - b.stage)
  return rows
}
