// Bot opponents: five fixed personas, each playing a real economy game with
// the same primitives as the human (shop.ts / xp.ts / combine.ts on a shared
// pool). Personas have consistent trait lines and econ styles so the same bot
// is recognizable from run to run.

import { UNIT_MAP } from '../data/units'
import { TRAIT_MAP } from '../data/traits'
import { makeUnit } from '../core/unitFactory'
import { getNeighbors, hexId } from '../core/hexGrid'
import { calcBoardProfile, calibratedPower, unitPowerScore, getThresholds } from '../enemy/boardPower'
import type { PlayerEcon, RunState } from './runState'
import { rollShop, reroll, buyUnit, sellFromBench } from './shop'
import { buyXp, boardCap } from './xp'
import { wouldCombine } from './combine'
import { REROLL_COST, XP_BUY_COST, MAX_LEVEL, MAX_INTEREST, STARTING_HP, stageOf, copiesHeld } from './constants'
import { TRAINED_GENOMES } from './trainedGenomes'
import { equipBotItems } from './botItems'
import type { Rng } from './shop'
import { posteriorMean, thompsonSample, type Affinity } from './itemAffinity'
import {
  LEARNED_TRAIT_PAIR_BONUS, LEARNED_UNIT_CONTEXT_BONUS,
  LEARNED_TRAIT_DEPTH_BONUS, LEARNED_BREADTH_BONUS,
} from './learnedCompositionAffinities'
import {
  boardTraitSignature, establishedTraits, traitPairKey, unitContextKey,
  traitDepthLevel, traitDepthKey, breadthKey,
  catalogKey, catalogEntriesForUnit, traitPoolAvailable, nextBreakpointReachable,
} from './compositionSignature'
import { LEARNED_CATALOG_BONUS } from './learnedCatalogAffinities'

// Identity only — id/name/lines are never evolved, so each persona stays a
// recognizable "character" across runs regardless of how its numbers train.
// lines are trait BIASES (soft nudges, not strategies) — actual comps emerge
// from what the shared-pool shops offer.
export interface BotPersona {
  id: string
  name: string
  lines: string[]
}

export const PERSONAS: BotPersona[] = [
  { id: 'rilla', name: 'Rilla the Reroller', lines: ['jungle', 'corkscrew', 'river'] },
  { id: 'kass',  name: 'Kass the Climber',   lines: ['froststone', 'mystic', 'sky_striker'] },
  { id: 'echo',  name: 'Echo',               lines: ['spellweaver', 'keen_eye', 'temporal_woods'] },
  { id: 'brick', name: 'Brick',              lines: ['stalwart', 'bruiser', 'cave_crawler'] },
  { id: 'vex',   name: 'Vex',                lines: ['ruiner', 'crashout', 'volcanic'] },
]

export function botSeats(): Array<{ personaId: string; name: string }> {
  return PERSONAS.map(p => ({ personaId: p.id, name: p.name }))
}

export function personaById(id: string | null): BotPersona | null {
  return PERSONAS.find(p => p.id === id) ?? null
}

// ─── Genome: every numeric knob that drives a persona's decisions ────────────
// Evolved offline by src/econ/train.ts (see TRAINED_GENOMES); these are the
// seed/fallback values used until training has (re-)run, and the starting
// point each persona's evolution begins from.
export interface BotGenome {
  targetLevel: number          // levels toward this aggressively, drifts up late
  reserve: number              // gold floor kept while rolling
  xpReserve: number            // buys XP only while gold stays above this
  // HP-aware spending rhythm
  hpDesperationRatio: number   // hp/STARTING_HP below this → spend everything, no reserve
  hpSpikeSafeRatio: number     // hp/STARTING_HP above this is "safe enough" to bank for a spike
  spikeBankMultiplier: number  // gold >= reserve * this while safe+ahead → dump it this round
  // scoreUnit weights
  starCompleteBonus: number
  starPairBonus: number
  star3LongRunBonus: number
  traitBreakpointBonus: number
  traitProgressBonus: number
  traitOpenBonus: number
  costMultiplier: number
  highCostLateGameBonus: number
  personaLineBiasBase: number
  rerollBias: number           // eagerness to commit to a cheap 3★ reroll comp (0 = fast-8, high = reroller)
}

// Today's hand-tuned numbers, kept as the seed every persona's evolution
// starts from and the fallback for any persona/field missing from
// TRAINED_GENOMES (so the game never breaks before training has run).
const GENOME_DEFAULTS: Omit<BotGenome, 'targetLevel' | 'reserve' | 'xpReserve'> = {
  hpDesperationRatio: 0.35,
  hpSpikeSafeRatio: 0.65,
  spikeBankMultiplier: 2.5,
  starCompleteBonus: 10,
  starPairBonus: 3.5,
  star3LongRunBonus: 1,
  traitBreakpointBonus: 3,
  traitProgressBonus: 1,
  traitOpenBonus: 0.4,
  costMultiplier: 0.45,
  highCostLateGameBonus: 1.4,
  personaLineBiasBase: 1.0,
  rerollBias: 1.0,
}

export const DEFAULT_GENOMES: Record<string, BotGenome> = {
  rilla: { targetLevel: 6, reserve: 6,  xpReserve: 24, ...GENOME_DEFAULTS, rerollBias: 2.2 },  // the reroller — leans into 3★ comps
  kass:  { targetLevel: 8, reserve: 24, xpReserve: 8,  ...GENOME_DEFAULTS, rerollBias: 0.3 },  // fast-8 — rarely rerolls
  echo:  { targetLevel: 7, reserve: 14, xpReserve: 14, ...GENOME_DEFAULTS, rerollBias: 1.0 },
  brick: { targetLevel: 7, reserve: 10, xpReserve: 18, ...GENOME_DEFAULTS, rerollBias: 1.3 },
  vex:   { targetLevel: 8, reserve: 30, xpReserve: 30, ...GENOME_DEFAULTS, rerollBias: 0.8 },
}

// Training hook (src/econ/train.ts): temporarily override resolveGenome's
// output for specific personas — e.g. to evaluate a candidate genome in
// self-play — without touching TRAINED_GENOMES. Pass null to clear. Not used
// during normal gameplay.
let genomeOverrides: Record<string, BotGenome> | null = null
export function setGenomeOverrides(overrides: Record<string, BotGenome> | null): void {
  genomeOverrides = overrides
}

// Trained values win field-by-field over the seed defaults, so a partially
// (or not-yet) trained genome still falls back safely.
export function resolveGenome(personaId: string): BotGenome {
  if (genomeOverrides?.[personaId]) return genomeOverrides[personaId]
  const base = DEFAULT_GENOMES[personaId] ?? DEFAULT_GENOMES.echo
  return { ...base, ...TRAINED_GENOMES[personaId] }
}

// ─── Power measurement (governor + fielding) ─────────────────────────────────

export function econBoardPower(econ: PlayerEcon): number {
  if (econ.board.length === 0) return 0
  const units = econ.board.map(e => {
    const u = makeUnit(e.definitionId, 'player', e.tier)
    u.hexPos = { ...e.hexPos }
    return u
  })
  return calibratedPower(calcBoardProfile(units))
}

// ─── Unit desirability scoring ────────────────────────────────────────────────

function traitCounts(econ: PlayerEcon): Map<string, Set<string>> {
  const perTrait = new Map<string, Set<string>>()
  const addUnit = (defId: string) => {
    const def = UNIT_MAP.get(defId)
    if (!def) return
    for (const t of def.types) {
      if (!perTrait.has(t)) perTrait.set(t, new Set())
      perTrait.get(t)!.add(defId)
    }
  }
  for (const b of econ.bench) if (b) addUnit(b.definitionId)
  for (const u of econ.board) addUnit(u.definitionId)
  return perTrait
}

// ─── Learned composition bonus (bandit layer) ─────────────────────────────────
// The carry/tank/secondary-carry priorityTraits system below only rewards
// SHARED traits with an already-recognized carry/tank. This adds a learned,
// win-rate-driven bonus discovered from self-play — trait pairs that
// correlate with winning when fielded together, and units that do well
// splashed onto a board with a given established trait direction, even with
// no shared trait at all. Purely additive: an untested pair (the flat
// {alpha:2,beta:2} prior → posteriorMean 0.5) contributes exactly 0.

const LEARNED_COMP_WEIGHT = 0.18
const COMP_NEUTRAL_PRIOR: Affinity = { alpha: 2, beta: 2 }

// TRAINING-ONLY authority boost. At the live weight the learned terms move a
// unit's score by fractions of a point, while the hand-coded terms swing it by
// +20 (committed reroll target), +10 (completes a 2★) or +4 (legendary) — so
// Thompson sampling could never actually flip a decision, and the bandit spent
// its games re-recording the hand-coded policy's existing habits instead of
// discovering anything new. During exploration the learned layer is scaled up
// so it can genuinely outvote a heuristic and get the alternative TRIED; live
// bots (explorationMode false) keep the conservative blend unchanged.
const EXPLORATION_WEIGHT_MULT = 5
const learnedWeight = (base: number, explorationMode: boolean): number =>
  base * (explorationMode ? EXPLORATION_WEIGHT_MULT : 1)
// Chance, per shop-buy decision during training, of taking the second-best
// affordable unit instead of the best (see buyFromShop). Deliberately small:
// enough to seed unexplored options with real observations over thousands of
// games without derailing the board into nonsense.
const EXPLORATION_SWAP_CHANCE = 0.10

function compAffinity(table: Record<string, Affinity>, key: string): Affinity {
  return table[key] ?? COMP_NEUTRAL_PRIOR
}

// `explorationMode` Thompson-samples instead of using the posterior mean —
// training-only (see BotGameOptions.explorationMode); live bots always get
// the stable posterior-mean blend. Every lookup is scoped to the current
// STAGE (a comp shape strong early can be weak late, and vice versa).
function learnedCompBonus(econ: PlayerEcon, defId: string, types: string[], stage: number, explorationMode: boolean, rng: Rng): number {
  const board = econ.board
  const p = (aff: Affinity) => (explorationMode ? thompsonSample(aff, rng) : posteriorMean(aff))
  let bonus = 0

  const active = establishedTraits(board)
  for (const t of types) {
    for (const other of active) {
      if (other === t) continue
      bonus += (p(compAffinity(LEARNED_TRAIT_PAIR_BONUS, traitPairKey(stage, t, other))) - 0.5) * 2
    }
  }

  const signature = boardTraitSignature(board)
  if (signature) bonus += (p(compAffinity(LEARNED_UNIT_CONTEXT_BONUS, unitContextKey(stage, defId, signature))) - 0.5) * 2

  // Depth: for each of this unit's own traits, would owning it (a new
  // species for that trait) push the trait to a deeper breakpoint — and has
  // going that deep, at this stage, historically paid off? Captures
  // "invest heavy into one or two traits" as its own signal.
  const owned = traitCounts(econ)
  for (const t of types) {
    if (owned.get(t)?.has(defId)) continue   // already own this species — doesn't advance the trait further
    const have = owned.get(t)?.size ?? 0
    const depth = traitDepthLevel(t, have + 1)
    if (depth > 0) bonus += (p(compAffinity(LEARNED_TRAIT_DEPTH_BONUS, traitDepthKey(stage, t, depth))) - 0.5) * 2
  }

  // Breadth: does this unit open a trait the board doesn't already have
  // active (pushing breadth wider — "play a lot of low-level traits"), or
  // does it only deepen traits already active (breadth unchanged)? Compares
  // the learned breadth bonus at the resulting active-trait count either way.
  const opensNewActiveTrait = types.some(t => !active.includes(t))
  const projectedBreadth = active.length + (opensNewActiveTrait ? 1 : 0)
  bonus += (p(compAffinity(LEARNED_BREADTH_BONUS, breadthKey(stage, projectedBreadth))) - 0.5) * 2

  return bonus * learnedWeight(LEARNED_COMP_WEIGHT, explorationMode)
}

// ─── Learned catalog bonus (docs/compositions.json, linked to training) ──────
// Separate from the free-discovery bandit above: this checks whether buying
// `defId` advances a KNOWN catalog entry (a hand-derived, mechanically-grounded
// reference composition) that self-play has verified pays off, at this stage.
// Only counts an entry once at least one of its OTHER core units is already
// owned — otherwise every entry that happens to mention a cheap unit would
// fire on nearly every shop, diluting the signal into noise.
const LEARNED_CATALOG_WEIGHT = 0.15
const CATALOG_NEUTRAL_PRIOR: Affinity = { alpha: 2, beta: 2 }
// Training-only nudge (see trainCatalogComps.ts): a flat score bump applied to
// a catalog entry's core units for ONE bot per game, so under-sampled entries
// still get tried even before their learned bonus has any data. Never set
// outside that script — live bots never receive a catalogBiasIds set.
const CATALOG_BIAS_BONUS = 6

function learnedCatalogBonus(econ: PlayerEcon, defId: string, stage: number, explorationMode: boolean, rng: Rng): number {
  const entries = catalogEntriesForUnit(defId)
  if (entries.length === 0) return 0
  const owned = ownedDefIdSet(econ)
  const p = (aff: Affinity) => (explorationMode ? thompsonSample(aff, rng) : posteriorMean(aff))
  let bonus = 0
  for (const entry of entries) {
    if (entry.coreUnitIds.length > 1) {
      const advancesIt = entry.coreUnitIds.some(id => id !== defId && owned.has(id))
      if (!advancesIt) continue
    }
    const aff = LEARNED_CATALOG_BONUS[catalogKey(stage, entry.id)] ?? CATALOG_NEUTRAL_PRIOR
    bonus += (p(aff) - 0.5) * 2
  }
  return bonus * learnedWeight(LEARNED_CATALOG_WEIGHT, explorationMode)
}

// ─── Live gap analysis + opponent trait awareness ─────────────────────────────
// Per-trait viability multiplier (0-1-ish), computed ONCE per planning round
// (not per scoreUnit call — this loops every trait) and applied to the
// trait-synergy bonus in scoreUnit. Two real signals, both discounts rather
// than hard cutoffs (rivals can still die/pivot, a tight pool can still open
// up):
//   - reachability: is the NEXT breakpoint for this trait still gettable from
//     what's left in the shared pool (same have+avail math docs/compositions.json's
//     static breakpoint plans use, computed live against the actual pool)?
//   - contest: how many still-living rivals already have this trait active —
//     every copy they hold is a copy this bot can't get.
function ownedDefIdSet(econ: PlayerEcon): Set<string> {
  const s = new Set<string>()
  for (const b of econ.bench) if (b) s.add(b.definitionId)
  for (const u of econ.board) s.add(u.definitionId)
  return s
}

function computeTraitViability(econ: PlayerEcon, pool: Record<string, number>, rivalTraitCounts?: Map<string, number>): Map<string, number> {
  const owned = ownedDefIdSet(econ)
  const counts = traitCounts(econ)
  const map = new Map<string, number>()
  for (const traitId of TRAIT_MAP.keys()) {
    const have = counts.get(traitId)?.size ?? 0
    const avail = traitPoolAvailable(traitId, owned, pool)
    const reachable = nextBreakpointReachable(traitId, have, avail)
    const contestedBy = rivalTraitCounts?.get(traitId) ?? 0
    map.set(traitId, (reachable ? 1 : 0.3) * (1 - Math.min(0.45, contestedBy * 0.15)))
  }
  return map
}

// How much this bot wants a given shop unit right now. Board-aware: star-up
// copies dominate, then trait synergy with what it already owns, then raw
// unit strength. The persona is only a soft bias — comps emerge from shops.
// All the magnitudes are genome-driven (trained by src/econ/train.ts).
function scoreUnit(econ: PlayerEcon, persona: BotPersona, genome: BotGenome, defId: string, rerollTargetIds?: string[], catchUp = 0, concentrate = false, priorityTraits?: Map<string, number>, legendaryMode = false, stage = 0, explorationMode = false, rng: Rng = Math.random, traitViability?: Map<string, number>, catalogBiasIds?: Set<string>): number {
  const def = UNIT_MAP.get(defId)
  if (!def) return -1
  let score = 0

  // Committed reroll target (single species or a trait-package member): buy
  // every copy on sight, above everything else.
  if (rerollTargetIds?.includes(defId)) score += 20

  score += learnedCompBonus(econ, defId, def.types, stage, explorationMode, rng)
  score += learnedCatalogBonus(econ, defId, stage, explorationMode, rng)
  // Training-only soft-bias toward one catalog entry's core units (see
  // trainCatalogComps.ts) — never set outside that script.
  if (catalogBiasIds?.has(defId)) score += CATALOG_BIAS_BONUS

  // Star-up progress dominates: TFT players always take upgrades
  let copies1 = 0
  let has2Star = false
  for (const b of econ.bench) {
    if (b?.definitionId !== defId) continue
    if (b.tier === 1) copies1++
    else if (b.tier === 2) has2Star = true
  }
  for (const u of econ.board) {
    if (u.definitionId !== defId) continue
    if (u.tier === 1) copies1++
    else if (u.tier === 2) has2Star = true
  }
  // Star-ups dominate, and starring a COSTLIER unit is a far bigger power spike, so
  // scale the bonus by cost — this is what makes bots chase 2★/3★ on carries & tanks.
  // DISCOUNTED (not zeroed) when the unit's traits share nothing with the rest of
  // an already-established roster — otherwise a random cheap unit that happens to
  // hit 2 copies early can out-score genuine comp-building for the rest of the
  // game (e.g. a 3★ carry that shares zero traits with the board built around it).
  // Only kicks in once the roster has an actual direction (some trait already at
  // 2+ species) so early-game opportunism on the first couple of buys is untouched.
  const owned = traitCounts(econ)
  const hasEstablishedComp = [...owned.values()].some(species => species.size >= 2)
  const connectsToRoster = def.types.some(t => {
    const species = owned.get(t)
    return species !== undefined && [...species].some(s => s !== defId)
  })
  const starUpMult = (hasEstablishedComp && !connectsToRoster) ? 0.5 : 1
  if (copies1 >= 2) score += (genome.starCompleteBonus + def.cost * 1.6) * starUpMult   // completes a 2★ right now
  else if (copies1 === 1) score += (genome.starPairBonus + def.cost * 0.5) * starUpMult // forms a pair
  if (has2Star) score += (genome.star3LongRunBonus + def.cost * 0.8) * starUpMult       // chasing a costly 3★ is worth more

  // Trait synergy with the units it already owns (unique species only)
  for (const t of def.types) {
    if (owned.get(t)?.has(defId)) continue          // duplicate species doesn't advance traits
    const have = owned.get(t)?.size ?? 0
    const thresholds = getThresholds(t)
    const next = thresholds.find(th => th > have)
    if (next === undefined) continue
    const viability = traitViability?.get(t) ?? 1   // live gap-analysis: pool-reachability × rival-contest discount
    if (have > 0) {
      score += (next - (have + 1) === 0 ? genome.traitBreakpointBonus : genome.traitProgressBonus) * viability
    } else {
      score += genome.traitOpenBonus * viability       // opens a new trait tree
    }
  }

  // Raw strength: expensive units are individually strong; premium once the
  // bot has the levels to actually field a big board around them. Gated a touch
  // earlier (lvl 6) and scaled by level so boards keep acquiring costlier pieces
  // as the game goes rather than plateauing on their opening cheap core.
  score += def.cost * genome.costMultiplier
  if (def.cost >= 4 && econ.level >= 6) score += genome.highCostLateGameBonus
  // Late-game splash: once leveled, a strong 4/5-cost is worth fielding even with no
  // combo. This flat bump clears the shop buy threshold so bots actually pick them up.
  if (def.cost >= 4 && econ.level >= 7) score += (def.cost - 3) * (econ.level >= 8 ? 2.4 : 1.5)

  // 5-COST BIAS: legendaries are the biggest single power spike in the game and are
  // rare in every shop — every board takes one on sight, and takes it harder when it
  // slots into a trait the board already runs (or switches a new one on).
  // Sized as a SPLASH, not a strategy: aim for ~1-3 legendaries alongside a mostly-2★
  // board, with most of the pull coming from trait fit so they slot into the comp.
  // The taper past the target is what stops boards becoming 1★-legendary soup.
  // EXCEPTION — legendaryMode (a level-9 variance roll): the bot goes all-in on a
  // starred-up 5-cost board supported by cheap trait-activators.
  if (def.cost === 5) {
    let own5 = 0
    for (const u of econ.board) if ((UNIT_MAP.get(u.definitionId)?.cost ?? 0) === 5) own5++
    for (const b of econ.bench) if (b && (UNIT_MAP.get(b.definitionId)?.cost ?? 0) === 5) own5++
    const want = legendaryMode ? 8 : 3
    if (own5 < want || copies1 > 0 || has2Star) {
      score += legendaryMode ? 7 : 4
      const owned5 = traitCounts(econ)
      for (const t of def.types) {
        const have = owned5.get(t)?.size ?? 0
        if (owned5.get(t)?.has(defId)) continue
        if (have > 0) score += 1.5                                 // fits the active comp
        if (getThresholds(t).includes(have + 1)) score += 3        // switches a breakpoint on
      }
    } else {
      score -= 4      // past the splash target — a 4th+ 1★ legendary just dilutes
    }
  }

  // 4-costs are the classic board-filler trap: individually strong but almost never
  // starred, so a board stuffed with them is WEAKER than 2★ cheap units plus a
  // legendary splash. Cap them at ~2 unless this copy actually stars one up.
  if (def.cost === 4) {
    let own4 = 0
    for (const u of econ.board) if ((UNIT_MAP.get(u.definitionId)?.cost ?? 0) === 4) own4++
    for (const b of econ.bench) if (b && (UNIT_MAP.get(b.definitionId)?.cost ?? 0) === 4) own4++
    // Mid-game: cap at 2 so 1★ 4-costs don't crowd out cheap star-ups. Late game the
    // board is meant to be built on 2★ 4-costs, so allow a wider base to star from.
    const want4 = stage >= 5 ? 4 : 2
    if (own4 >= want4 && copies1 === 0 && !has2Star) score -= 14

    // TECH-IN: a 4-cost that shares a trait the board has ALREADY genuinely
    // invested in (2+ species, not just one stray unit) is a real "lean into
    // this line" pickup, not a random splash — e.g. already running Weavile +
    // Froslass (Froststone) and Abomasnow (also Froststone) shows up. Bigger
    // than the generic trait-synergy bump above so it actually competes with
    // an unrelated 4-cost, but still just a bias: a strong off-trait 4-cost
    // can still win on raw power/rarity if nothing established fits.
    for (const t of def.types) {
      const have = owned.get(t)?.size ?? 0
      if (owned.get(t)?.has(defId)) continue
      if (have >= 2) score += 3.5
    }
  }

  // RARITY SNAP-UP: a 4/5-cost seen at a LOW level is a genuinely rare roll (shop odds
  // for them are tiny until lvl 8+). Take it on sight and build the comp around it —
  // the trait-synergy term above then pulls matching units toward it in later shops.
  // Scales with how improbable the sighting was, so a lvl-4 5-cost is a near-auto-buy.
  if (def.cost >= 4 && econ.level < 8) {
    const rarity = (8 - econ.level) / 7          // ~0.14 at lvl 7 → 1.0 at lvl 1
    score += (def.cost - 3) * 6 * rarity
  }

  // Star-up progress is the main win condition, so weight it once the bot has the
  // levels to hold a full board.
  if (econ.level >= 7) {
    if (copies1 >= 2)      score += 6      // completes a 2★ right now
    else if (copies1 === 1) score += 3     // forms the pair
    if (has2Star)           score += 2     // chasing the 3★
  }

  // COST TRANSITION: cheap 2★s carry the early/mid game, but by stage 5+ a board of
  // 1-cost 2★s is out-statted — the upgrade path becomes 2★ FOUR-costs. Reroll comps
  // are exempt: their whole plan is a cheap 3★, so they keep chasing copies.
  const lateBoard = stage >= 5 && !rerollTargetIds
  if (lateBoard) {
    if (def.cost >= 4 && copies1 >= 1) score += 9      // chase 2★ 4/5-costs hard
    if (def.cost <= 2 && copies1 >= 2 && !has2Star) score -= 5   // a fresh cheap 2★ no longer wins
  }

  // CONCENTRATION: with the board already full late game, buying a brand-new cheap
  // 1★ species just dilutes — every gold should go into copies of what we already
  // own (or a genuine high-cost splash). This is what converts a wide 1★ board into
  // a mostly-2★ one, since 3 copies auto-combine.
  if (concentrate && copies1 === 0 && !has2Star && def.cost < 4) score -= 9

  // CATCH-UP: when behind on board power, weight the two things that actually close a
  // power gap fast — completing star-ups and adding high-cost units.
  if (catchUp > 0) {
    if (copies1 >= 2) score += catchUp * 6            // finish that 2★ now
    if (def.cost >= 4) score += catchUp * (def.cost - 3) * 3
  }

  // CARRY/TANK FOCUS: prefer units that share the traits of the board's carry,
  // main tank, and (at a smaller weight) secondary carry, so those traits climb
  // to their higher breakpoints and the comp is genuinely built around the units
  // doing the work. A preference, not a rule — see the variance rolls and
  // per-source weights in botPlanRound.
  if (priorityTraits && priorityTraits.size > 0) {
    for (const t of def.types) {
      const w = priorityTraits.get(t)
      if (w) score += 2.5 * w
    }
  }

  // Soft persona bias — a nudge, never a rule
  for (let i = 0; i < persona.lines.length; i++) {
    if (def.types.includes(persona.lines[i])) score += genome.personaLineBiasBase * (1 - i * 0.3)
  }
  return score
}

// ─── Fielding: choose and place the best boardCap units ──────────────────────

interface Fieldable { definitionId: string; tier: 1 | 2 | 3; fromBench: number | null }

// Choose exactly min(level, owned) units to field. Distinct species are
// strongly preferred (duplicates add no trait counts).
//
// Stage-aware quality shift — this is what makes boards EVOLVE instead of
// freezing on the cheap trait-holders they opened the game with. A candidate's
// value is its raw combat power (unitPowerScore — exponential in cost×tier) plus
// the marginal trait power it unlocks. Early game the flat trait bonuses drive
// the picks (a cheap unit that opens breakpoints is great); but as the stages
// climb, raw power is scaled UP and the flat trait bonuses are scaled DOWN, so a
// stronger high-cost unit outbids a low-cost unit that only holds a trait the bot
// has carried all game. Net effect: bots keep their genuinely-strong pieces
// (starred cheap 3★ carries stay — their unitPowerScore is high) but swap weak
// trait-filler bodies for costlier units and their trait trees over time.
function chooseFielded(econ: PlayerEcon, persona: BotPersona, stage: number, priorityTraits?: Map<string, number>, explorationMode = false, rng: Rng = Math.random): Fieldable[] {
  const candidates: Fieldable[] = []
  econ.bench.forEach((b, i) => { if (b) candidates.push({ definitionId: b.definitionId, tier: b.tier, fromBench: i }) })
  for (const u of econ.board) candidates.push({ definitionId: u.definitionId, tier: u.tier, fromBench: null })

  const cap = boardCap(econ)
  const picked: Fieldable[] = []
  const pickedIds = new Set<Fieldable>()
  const pickedSpecies = new Set<string>()

  // Raw power matters more each stage; a lone trait breakpoint matters less.
  const powerWeight = 1 + Math.max(0, stage - 2) * 0.35   // s1-2:1.0 · s3:1.35 · s4:1.7 · s5:2.05 · s6:2.4
  const traitWeight = Math.max(0.5, 1 - Math.max(0, stage - 3) * 0.15) // s≤3:1.0 → floor 0.5 by s6+

  while (picked.length < Math.min(cap, candidates.length)) {
    let best: Fieldable | null = null
    let bestScore = -Infinity
    const currentTraits = new Map<string, Set<string>>()
    for (const p of picked) {
      const def = UNIT_MAP.get(p.definitionId)!
      for (const t of def.types) {
        if (!currentTraits.has(t)) currentTraits.set(t, new Set())
        currentTraits.get(t)!.add(p.definitionId)
      }
    }
    for (const c of candidates) {
      if (pickedIds.has(c)) continue
      const def = UNIT_MAP.get(c.definitionId)
      if (!def) continue
      let s = unitPowerScore(def.cost, c.tier) * powerWeight
      s += learnedCompBonus(econ, c.definitionId, def.types, stage, explorationMode, rng)

      // Duplicate species: no trait value and blocks a slot another trait
      // could use — heavy penalty so they're only fielded to fill the level
      if (pickedSpecies.has(c.definitionId)) s -= unitPowerScore(def.cost, c.tier) * powerWeight * 0.7 + 2
      else {
        for (const t of def.types) {
          const have = currentTraits.get(t)?.size ?? 0
          const thresholds = getThresholds(t)
          const crosses = thresholds.includes(have + 1)
          if (crosses) s += 2.5 * traitWeight    // fielding this hits a breakpoint
          else if (have > 0) s += 0.9 * traitWeight  // progresses an open tree
          else s += 0.3 * traitWeight            // opens a new tree
        }
      }
      // Individually-strong high-cost units earn a field slot even without a combo,
      // and a bigger one once starred — puts splashed 4/5-costs on the board, more so late.
      if (def.cost >= 4) s += ((def.cost - 3) * 1.6 + (c.tier - 1) * 2) * powerWeight
      for (let i = 0; i < persona.lines.length; i++) {
        if (def.types.includes(persona.lines[i])) s += 0.6 - i * 0.15
      }
      // Carry/tank focus: favour units sharing the carry's, main tank's, or
      // (at a smaller weight) secondary carry's traits so the board is built
      // around them (swapping filler out to push their breakpoints higher).
      if (priorityTraits && priorityTraits.size > 0) {
        for (const t of def.types) {
          const w = priorityTraits.get(t)
          if (w) s += 2 * traitWeight * w
        }
      }
      if (s > bestScore) { bestScore = s; best = c }
    }
    if (!best) break
    picked.push(best)
    pickedIds.add(best)
    pickedSpecies.add(best.definitionId)
  }
  return picked
}

// Position on player-half rows 4-7 (row 4 = front). Tanks wall the front,
// melee carries second row, ranged in the back — mirrors the enemy
// generator's layout logic.
function positionFielded(picked: Fieldable[]): Array<{ definitionId: string; tier: 1 | 2 | 3; hexPos: { col: number; row: number } }> {
  const tanks:  Fieldable[] = []
  const melee:  Fieldable[] = []
  const ranged: Fieldable[] = []
  const rogues: Fieldable[] = []   // 'rogue' trait — placed isolated first, see below
  for (const p of picked) {
    const def = UNIT_MAP.get(p.definitionId)!
    if (def.types.includes('rogue')) rogues.push(p)
    else if (def.role === 'tank') tanks.push(p)
    else if ((def.baseStats?.range ?? 1) <= 1) melee.push(p)
    else ranged.push(p)
  }

  const used = new Set<string>()
  const out: Array<{ definitionId: string; tier: 1 | 2 | 3; hexPos: { col: number; row: number } }> = []
  const centerOut = [3, 2, 4, 1, 5, 0, 6]

  // Rogue: a unit with no adjacent ally at combat start gets a 500 HP shield
  // (traitEffects.ts's applyRogue). Place it first, in the front 2 rows (still
  // engages immediately) in whichever open hex has the fewest OTHER open
  // neighbor hexes — i.e. a corner/edge hex with only 2-3 neighbors instead of
  // 6 — then reserve all its neighbors so later placements can't break the
  // isolation. Falls through to normal melee placement if no isolatable hex is
  // left (board too full).
  for (const p of rogues) {
    let bestHex: { col: number; row: number } | null = null
    let bestOpenNeighbors = Infinity
    for (const row of [4, 5]) {
      for (const col of centerOut) {
        const k = `${col},${row}`
        if (used.has(k)) continue
        const openNeighbors = getNeighbors({ col, row }).filter(h => h.row >= 4 && !used.has(hexId(h))).length
        if (openNeighbors < bestOpenNeighbors) { bestOpenNeighbors = openNeighbors; bestHex = { col, row } }
      }
    }
    if (bestHex) {
      used.add(hexId(bestHex))
      for (const h of getNeighbors(bestHex)) used.add(hexId(h))
      out.push({ definitionId: p.definitionId, tier: p.tier, hexPos: bestHex })
    } else {
      melee.push(p)
    }
  }

  function place(list: Fieldable[], rows: number[]): void {
    for (const p of list) {
      let placed = false
      for (const row of rows) {
        for (const col of centerOut) {
          const k = `${col},${row}`
          if (used.has(k)) continue
          used.add(k)
          out.push({ definitionId: p.definitionId, tier: p.tier, hexPos: { col, row } })
          placed = true
          break
        }
        if (placed) break
      }
    }
  }

  place(tanks,  [4, 5, 6, 7])
  place(melee,  [5, 4, 6, 7])
  place(ranged, [7, 6, 5, 4])
  return out
}

export interface RerollTarget { defIds: string[]; level: number; have: number }

// Most frequent value in a small array; ties break toward the smaller (cheaper,
// safer to anchor on) value. Used to pick a reroll package's anchor cost tier.
function mode(values: number[]): number {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = values[0]
  let bestCount = 0
  for (const [v, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (c > bestCount) { bestCount = c; best = v }
  }
  return best
}

// ─── Reroll-comp decision (tempo/availability driven) ─────────────────────────
// Should this bot commit to slow-rolling toward a cheap 3★, OR toward a small
// PACKAGE of same-ish-cost units that share a trait (e.g. Typhlosion + Graveler,
// both cost 1, both Volcanic — reroll both, land a Volcanic line off two 2★s
// rather than one 3★)? Purely emergent: driven by what's actually been hit in
// the shop (owned copies) and what's still available (state.pool) — never a
// fixed persona-trait list, so the exact same persona can end up rerolling
// completely different comps game to game depending on what it finds.
//
// Reads the shared pool (copies still gettable — drops as rivals buy them) plus
// what it already owns. Stateless: re-decided every round, so it commits while
// viable and abandons the moment the pool dries up or it gets too late.
function pickRerollTarget(econ: PlayerEcon, state: RunState, persona: BotPersona, genome: BotGenome, rivalTraitCounts?: Map<string, number>): RerollTarget | null {
  if (genome.rerollBias <= 0) return null
  // Only reroll while reasonably healthy. If HP is dropping (the weak-board tax of
  // slow-rolling), abandon and pivot to leveling a standard board — avoids the classic
  // reroll death spiral (weak board → lose → broke → still weak).
  if (econ.hp / STARTING_HP < 0.55) return null
  const stage = stageOf(state.round)

  // Copies owned per cheap species (cost ≤ 3), across bench + board.
  const owned = new Map<string, number>()
  const add = (defId: string, tier: 1 | 2 | 3) => {
    const def = UNIT_MAP.get(defId)
    if (!def || def.cost > 3) return
    owned.set(defId, (owned.get(defId) ?? 0) + copiesHeld(tier))
  }
  for (const b of econ.bench) if (b) add(b.definitionId, b.tier)
  for (const u of econ.board) add(u.definitionId, u.tier)

  // Group every owned cheap species by trait — a trait qualifies as a PACKAGE
  // candidate when 2+ owned species share it and each is individually still
  // reachable toward a real 2★ (have+avail ≥ 6). Two grouping granularities,
  // both offered as candidates so the scoring picks whichever actually fits
  // what's been found:
  //   - SAME-COST packages (e.g. Torkoal + Gible, both cost 2) anchor cleanly
  //     at that cost's shop-odds peak level, so every member digs at good odds
  //     the whole time.
  //   - MIXED-COST packages (e.g. Typhlosion + Graveler + Torkoal, 1c/1c/2c,
  //     or Snorunt + Froslass + Weavile, 1c/2c/2c) are still real and often
  //     worth it — the trait payoff can be worth one member digging at
  //     slightly-off odds — so they stay available too, just as one option
  //     among several rather than the only shape a package can take.
  const byTraitCost = new Map<string, string[]>()
  const byTraitAnyCost = new Map<string, string[]>()
  for (const defId of owned.keys()) {
    const def = UNIT_MAP.get(defId)!
    for (const t of def.types) {
      const costKey = `${t}|${def.cost}`
      if (!byTraitCost.has(costKey)) byTraitCost.set(costKey, [])
      byTraitCost.get(costKey)!.push(defId)
      if (!byTraitAnyCost.has(t)) byTraitAnyCost.set(t, [])
      byTraitAnyCost.get(t)!.push(defId)
    }
  }

  interface Candidate { defIds: string[]; targetTier: 2 | 3 }
  const candidates: Candidate[] = []
  const seenPackages = new Set<string>()
  const addPackageCandidates = (groups: Map<string, string[]>) => {
    for (const members of groups.values()) {
      const reachable = members.filter(id => (owned.get(id) ?? 0) + (state.pool[id] ?? 0) >= 6)
      if (reachable.length < 2) continue
      const key = [...reachable].sort().join(',')
      if (seenPackages.has(key)) continue   // same-cost group can be identical to the any-cost group when a trait only has one cost tier represented — don't double-count it
      seenPackages.add(key)
      candidates.push({ defIds: reachable, targetTier: 2 })
    }
  }
  addPackageCandidates(byTraitCost)
  addPackageCandidates(byTraitAnyCost)
  // Every species is also viable solo, chasing the classic cheap 3★.
  for (const defId of owned.keys()) candidates.push({ defIds: [defId], targetTier: 3 })

  let best: RerollTarget | null = null
  let bestScore = -Infinity
  for (const c of candidates) {
    const cap = c.targetTier === 2 ? 6 : 9
    const have = c.defIds.reduce((s, id) => s + Math.min(owned.get(id) ?? 0, cap), 0)
    const avail = c.defIds.reduce((s, id) => s + (state.pool[id] ?? 0), 0)
    if (c.defIds.some(id => (owned.get(id) ?? 0) >= cap) && c.defIds.length === 1) continue // already finished — build around it
    if (have < 4) continue                          // only commit once naturally built up
    if (have + avail < (c.defIds.length > 1 ? 8 : 9)) continue   // unreachable — pool too drained
    if (stage >= 4 && have < 6) continue             // too little, too late → don't tunnel

    // Value each member's progress toward its target tier, scaled by this bot's
    // eagerness. A package's members are valued independently and summed, so a
    // 2-member Volcanic package competes fairly against a single cheap 3★ chase.
    let s = 0
    for (const id of c.defIds) {
      const def = UNIT_MAP.get(id)!
      const have_m = owned.get(id) ?? 0
      const avail_m = state.pool[id] ?? 0
      const progress = Math.min(have_m, cap) / cap
      const safety = Math.min(1, (have_m + avail_m) / (cap + 3))
      s += unitPowerScore(def.cost, c.targetTier) * (0.5 + progress) * safety
    }
    s *= genome.rerollBias
    // Opponent trait awareness: a trait 2+ still-living rivals already have
    // active is genuinely pool-contested — every copy they hold is a copy this
    // bot can't dig. Discounts, doesn't forbid: rivals can still die or pivot.
    if (rivalTraitCounts) {
      const traits = new Set(c.defIds.flatMap(id => UNIT_MAP.get(id)!.types))
      let maxContest = 0
      for (const t of traits) maxContest = Math.max(maxContest, rivalTraitCounts.get(t) ?? 0)
      s *= 1 - Math.min(0.4, maxContest * 0.12)
    }
    for (const id of c.defIds) {
      const def = UNIT_MAP.get(id)!
      for (let i = 0; i < persona.lines.length; i++) if (def.types.includes(persona.lines[i])) s += 1
    }
    s += have * 0.01   // tiebreak toward what we already own most of (stable commitment)

    if (s > bestScore) {
      bestScore = s
      // Slow-roll anchor level per cost tier — the level where that cost's shop
      // odds peak: 1-costs roll at 5 (drifting to 6), 2-costs at 6, 3-costs at 7.
      // A package anchors on its majority cost.
      const anchorCost = mode(c.defIds.map(id => UNIT_MAP.get(id)!.cost))
      const level = anchorCost === 1 ? 5 : anchorCost === 2 ? 6 : 7
      best = { defIds: c.defIds, level, have }
    }
  }
  return best
}

// "Carry investment" score: like unitPowerScore, but weighted an extra ×tier so
// a unit the bot has already starred up outranks a same-power-or-slightly-ahead
// UNSTARRED unit of higher cost. Without this, a 2★ cheap carry sits below any
// random 1★ 3/4-cost body on the board (e.g. a 1-cost 2★ scores 3 under plain
// unitPowerScore, a 3-cost 1★ scores 4) and never gets recognized as "the carry"
// worth building trait support around until it's already 3★ — by which point the
// shop window to complete its trait may be gone. This is ONLY used to pick which
// unit's traits to prioritize; actual combat-power math still uses unitPowerScore.
function carryInvestmentScore(cost: number, tier: 1 | 2 | 3): number {
  return unitPowerScore(cost, tier) * tier
}

// Ranks the board's non-tank damage dealers by carry-investment score, highest
// first, deduplicated by species (a species could transiently appear as two
// separate un-combined board entries). Backs both carryTraitsOf (rank 0) and
// secondaryCarryTraitsOf (rank 1).
function rankCarries(econ: PlayerEcon): string[] {
  const scores = new Map<string, number>()
  for (const u of econ.board) {
    const def = UNIT_MAP.get(u.definitionId)
    if (!def || def.role === 'tank') continue
    const score = carryInvestmentScore(def.cost, u.tier)
    scores.set(u.definitionId, Math.max(scores.get(u.definitionId) ?? 0, score))
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

// The board's carry: its strongest DAMAGE dealer, by carry-investment score
// (tanks excluded — they hold the board, they don't carry it; see tankTraitsOf).
// Bots prefer to build around this unit, buying and fielding units that share
// its traits so the carry's traits reach their higher breakpoints. Returns the
// traits to favour, or an empty set for "no bias".
function carryTraitsOf(econ: PlayerEcon): Set<string> {
  const id = rankCarries(econ)[0]
  return id ? new Set(UNIT_MAP.get(id)!.types) : new Set()
}

// The board's SECOND-strongest damage dealer. Gets the same trait-support
// treatment as the primary carry, but at a smaller weight (see botPlanRound) —
// a bot with two developing carries shouldn't ignore one entirely, but the
// main carry should still dominate when they'd otherwise compete for buys.
function secondaryCarryTraitsOf(econ: PlayerEcon): Set<string> {
  const id = rankCarries(econ)[1]
  return id ? new Set(UNIT_MAP.get(id)!.types) : new Set()
}

// The board's main tank, by the same carry-investment score restricted to
// role === 'tank'. Mirrors carryTraitsOf so bots also prioritize completing the
// trait trees that make their own tank durable, not just their damage dealer.
function tankTraitsOf(econ: PlayerEcon): Set<string> {
  let bestId: string | null = null
  let bestScore = 0
  for (const u of econ.board) {
    const def = UNIT_MAP.get(u.definitionId)
    if (!def || def.role !== 'tank') continue
    const score = carryInvestmentScore(def.cost, u.tier)
    if (score > bestScore) { bestScore = score; bestId = u.definitionId }
  }
  return bestId ? new Set(UNIT_MAP.get(bestId)!.types) : new Set()
}

// Is a genuinely stronger unit stuck on the bench because the board is at its cap?
// If so, buying a level is an immediate power spike (it fields that unit), which is
// worth breaking the interest bank for.
function benchUpgradeWaiting(econ: PlayerEcon): boolean {
  if (econ.board.length < boardCap(econ)) return false          // room already — no level needed
  const power = (defId: string, tier: 1 | 2 | 3): number => {
    const def = UNIT_MAP.get(defId)
    return def ? unitPowerScore(def.cost, tier) : 0
  }
  let weakestFielded = Infinity
  for (const u of econ.board) weakestFielded = Math.min(weakestFielded, power(u.definitionId, u.tier))
  for (const b of econ.bench) {
    if (!b) continue
    if (power(b.definitionId, b.tier) > weakestFielded) return true
  }
  return false
}

// ─── The per-round brain ──────────────────────────────────────────────────────

const MAX_ROLLS_PER_ROUND = 8

export interface BotTurnLog {
  bought: string[]
  rolls: number
  xpBought: number
  mode: 'normal' | 'greed' | 'push'
}

export function botPlanRound(state: RunState, econ: PlayerEcon, playerPower: number, rng: Rng = Math.random, explorationMode = false, rivalTraitCounts?: Map<string, number>, catalogBiasIds?: Set<string>): BotTurnLog {
  const persona = personaById(econ.personaId) ?? PERSONAS[0]
  const genome = resolveGenome(persona.id)
  const log: BotTurnLog = { bought: [], rolls: 0, xpBought: 0, mode: 'normal' }
  if (econ.eliminated) return log

  // Live gap-analysis + opponent awareness, computed once for the whole round.
  const traitViability = computeTraitViability(econ, state.pool, rivalTraitCounts)

  // Pacing governor. Bots bank while clearly ahead, but the moment they fall behind
  // the player's board they start pushing — and `catchUp` (0 = level/ahead, 1 = less
  // than half the player's power) scales HOW hard: it drives spend-down, roll volume,
  // and the star-up / high-cost priority in scoreUnit. This is what makes a trailing
  // bot actively try to close the gap instead of drifting further behind.
  const myPower = econBoardPower(econ)
  let catchUp = 0
  if (playerPower > 0) {
    if (myPower < playerPower) catchUp = Math.min(1, (playerPower - myPower) / playerPower)
    if (myPower > playerPower * 1.25) log.mode = 'greed'
    else if (myPower < playerPower * 0.95) log.mode = 'push'   // any real deficit → push
  }
  let reserve   = log.mode === 'greed' ? genome.reserve + 20 : log.mode === 'push' ? 0 : genome.reserve
  let xpReserve = log.mode === 'push' ? 0 : genome.xpReserve

  // HP-aware spending rhythm, on top of the power-relative governor above:
  //  - Desperation: about to be eliminated → banked gold is worthless, spend it all.
  //  - Bank-then-spike: healthy AND ahead (greed) still hoards up to a point, but
  //    once it's banked spikeBankMultiplier× its reserve, dump it this round
  //    (level + reroll hard) instead of hoarding indefinitely.
  let forceSpend = false
  const hpRatio = econ.hp / STARTING_HP
  if (hpRatio < genome.hpDesperationRatio) {
    reserve = 0; xpReserve = 0; forceSpend = true
  } else if (
    log.mode === 'greed' &&
    hpRatio >= genome.hpSpikeSafeRatio &&
    econ.gold >= genome.reserve * genome.spikeBankMultiplier
  ) {
    reserve = 0; xpReserve = 0; forceSpend = true
  }

  const stage = stageOf(state.round)

  // Reroll-comp commitment (tempo/availability). When a viable cheap 3★ is open, the bot
  // SLOW-ROLLS: holds at the reroll level and digs for copies instead of leveling up.
  // Re-decided every round, so it commits while viable and auto-pivots to a normal board
  // the moment the pool dries up or it gets too late — no tunnel vision.
  const rerollTarget = pickRerollTarget(econ, state, persona, genome, rivalTraitCounts)

  // Level target. Committed reroll → cap at the reroll level, but from stage 5 on
  // allow +1 (and +2 by stage 6) so a healthy reroll bot adds high-cost support
  // slots around its 3★ core instead of freezing at its slow-roll level all game.
  // Otherwise ramp by stage so bots reach the levels where 4/5-costs appear
  // (8+ by stage 3, max by stage 4+).
  // Leveling boards aim for 8 → 9 (where 4/5-costs actually show up) rather than
  // sprinting to max: the last levels cost enormous XP that's better spent holding
  // interest and rolling for upgrades. Stage 6 allows max for a final push.
  const effectiveTarget = rerollTarget
    ? Math.min(MAX_LEVEL, rerollTarget.level + Math.max(0, stage - 4))
    : stage >= 6 ? MAX_LEVEL
    : stage >= 5 ? Math.min(MAX_LEVEL, 9)
    : stage >= 3 ? Math.min(MAX_LEVEL, Math.max(genome.targetLevel, 8))
    : Math.min(MAX_LEVEL, genome.targetLevel + Math.floor(state.round / 10))

  // ─── Economy: bank for interest, spend only on a real trigger ────────────────
  // Interest is min(MAX_INTEREST, floor(gold/10)) — holding 50g is +5g/round, by far
  // the biggest income lever, so spending to zero every round quietly starves a bot.
  // Bots therefore hold an interest bank by default and roll/level off the EXCESS,
  // breaking the bank only when buying now is genuinely better than compounding:
  // they're on a losing streak, behind the player's board, nearly dead, or one buy
  // from closing out a 3★.
  const lateGame = stage >= 3
  const INTEREST_BANK = MAX_INTEREST * 10                    // 50g = capped interest
  const losingStreak = econ.streak <= -2
  // Under pressure the bank is worth less than board strength right now.
  const pressure = losingStreak || catchUp > 0.2

  // Build around the board's best damage dealer AND main tank — but only most of
  // the time, so comps still vary and a bot isn't locked onto its first carry
  // forever. A committed reroll target's own traits are always included: slow-
  // rolling toward a 3★ is already a full commitment, so no extra variance is
  // needed there, and it lets support show up before the unit is strong enough
  // to win carryTraitsOf's investment-score comparison on its own. Each source
  // gets its own weight (1.0 = full bias, like the primary carry/tank/reroll
  // target; 0.4 = a smaller supporting nudge for a secondary carry so it isn't
  // ignored but doesn't compete evenly with the main carry for buys); when two
  // sources share a trait, the higher weight wins rather than stacking.
  const priorityTraits = new Map<string, number>()
  const addPriorityTraits = (traits: Iterable<string>, weight: number) => {
    for (const t of traits) priorityTraits.set(t, Math.max(priorityTraits.get(t) ?? 0, weight))
  }
  if (rng() < 0.75) addPriorityTraits(carryTraitsOf(econ), 1.0)
  if (rng() < 0.75) addPriorityTraits(tankTraitsOf(econ), 1.0)
  if (rng() < 0.75) addPriorityTraits(secondaryCarryTraitsOf(econ), 0.4)
  if (rerollTarget) {
    for (const id of rerollTarget.defIds) {
      const rtDef = UNIT_MAP.get(id)
      if (rtDef) addPriorityTraits(rtDef.types, 1.0)
    }
  }
  // Level-9 variance: occasionally a bot commits to a starred-up legendary board
  // (3+ five-costs) instead of the usual 1-2 splash — this also raises its plan level.
  const legendaryMode = econ.level >= 9 && rng() < 0.4

  // Some personas are tempo players: they rush level 8 and win off 4/5-cost quality
  // rather than cheap 3★s. Identity comes from the (trainable) rerollBias knob, so
  // Kass/Vex play fast-8 while Rilla/Brick stay reroll-leaning.
  const fastEight = !rerollTarget && genome.rerollBias < 0.7
  const FAST8_ARRIVAL_GOLD = 25          // gold the push aims to still hold when it hits 8

  // Ramp the bank up early (develop first), then hold the full interest cap.
  let bank = stage <= 1 ? 10 : stage === 2 ? 30 : INTEREST_BANK

  if (rerollTarget) {
    // Slow-roll comps live off interest: sit at the anchor level and roll only the
    // gold above the bank, so income keeps funding the dig round after round.
    if (rerollTarget.have >= 6 && (pressure || forceSpend)) {
      bank = 0; forceSpend = true          // ~a 2★ away and hurting → dump it and hit
    } else if (pressure) {
      bank = Math.round(INTEREST_BANK * 0.6)   // dig harder, keep some interest alive
    }
  } else if (fastEight) {
    // ─── Fast-8 tempo plan (the non-reroll personas) ───────────────────────────
    // A four-beat cycle rather than one static rule:
    //   1. PUSH   — rush levels toward 8, but keep a ~25g floor so the bot ARRIVES
    //               with money instead of hitting 8 broke and boardless.
    //   2. ARRIVE — at 8, that 20-30g goes straight into the 4/5-costs on offer.
    //   3. REBUILD— stop rolling and bank back up to the interest cap.
    //   4. ROLL   — once rebuilt (or if it's losing), spend down to ~20 hunting the
    //               2★ carry and tank the board is built around. Then rebuild again.
    if (econ.level < 8) {
      bank = FAST8_ARRIVAL_GOLD          // push levels, but never below the arrival float
      if (forceSpend) bank = 0
    } else if (econ.gold >= INTEREST_BANK || pressure) {
      bank = pressure ? 20 : 30          // rebuilt (or hurting) → commit the roll-down
      if (losingStreak && catchUp > 0.3) bank = 10
    } else {
      bank = econ.gold                   // rebuilding: hold everything, let interest compound
    }
  } else {
    // Leveling boards: alternate between banking and pushing levels. They level off
    // the excess above the bank (so a level-up still leaves gold to roll), and only
    // break the bank when they need board strength now.
    if (pressure) bank = Math.min(bank, 20)
    // A strong unit stuck on the bench (board at cap) means a level is an immediate
    // power spike — worth spending the bank for.
    if (benchUpgradeWaiting(econ)) bank = Math.min(bank, 20)

    // ROLL-DOWN: once the bot has reached its target level (8/9), banking has done its
    // job — the gold now buys the 2★ 4- and 5-costs the board is built on. Step the
    // bank down 30 → 20 → 10 as it gets more urgent, and go all-in when desperate.
    if (lateGame && econ.level >= 8) {
      bank = Math.min(bank, 30)
      if (pressure) bank = 20
      if (losingStreak && catchUp > 0.3) bank = 10
    }
  }
  if (forceSpend) bank = 0                  // desperation / greed-spike overrides

  reserve   = bank
  xpReserve = bank

  // ─── Roll only AT your plan's level ──────────────────────────────────────────
  // Every comp has a level where its shop odds peak, and rolling before you get
  // there is the classic way to end up both broke AND under-levelled:
  //   1-cost reroll → 5 · 2-cost → 6 · 3-cost → 7      (rerollTarget.level)
  //   4-cost 2★ board + 1-2 legendaries → 8
  //   4-cost 2★ board + 3 or more legendaries → 9      (legendaryMode)
  // Below that level XP outbids rerolling; the bot still buys anything good out of
  // the free shop. The one exception is real distress — bleeding HP AND losing
  // repeatedly — where it needs board strength now or there is no later.
  const planLevel = rerollTarget ? rerollTarget.level : legendaryMode ? 9 : 8
  const distressed = losingStreak && hpRatio < 0.5
  const mayReroll = econ.level >= planLevel || distressed || forceSpend
  if (!mayReroll) reserve = Math.max(reserve, 999)   // bank/level instead of rolling

  // Free shop for the round
  rollShop(econ, state.pool, rng)

  const ownedUnits = () =>
    econ.bench.filter(b => b !== null).length + econ.board.length

  const buyFromShop = () => {
    // Buy any slot scoring above threshold, best first. When the bot can't
    // even fill its level in bodies, it takes almost anything affordable —
    // playing max units always beats holding gold.
    let boughtAny = true
    while (boughtAny) {
      boughtAny = false
      const needBodies = ownedUnits() < econ.level
      // Board already full late game → concentrate gold into star-ups instead of
      // adding more distinct 1★ bodies (see scoreUnit's concentration penalty).
      const concentrate = lateGame && !needBodies
      // Buy bar rises with the stage: early on almost any body is worth taking, but
      // late a 1★ filler that doesn't star something up, fit the carry's traits or hit
      // a breakpoint is just gold that should have stayed banked for the roll-down.
      const threshold = needBodies
        ? (lateGame ? 1.5 : 0.3)
        : stage >= 5 ? 6 : stage >= 4 ? 4 : 2.4
      let bestSlot = -1
      let bestScore = threshold
      let runnerUpSlot = -1
      let runnerUpScore = threshold
      for (let s = 0; s < econ.shop.length; s++) {
        const id = econ.shop[s]
        if (!id) continue
        const def = UNIT_MAP.get(id)
        if (!def || econ.gold - def.cost < 0) continue
        const benchFree = econ.bench.some(b => b === null)
        if (!benchFree && !wouldCombine(econ, id)) continue
        const sc = scoreUnit(econ, persona, genome, id, rerollTarget?.defIds, catchUp, concentrate, priorityTraits, legendaryMode, stage, explorationMode, rng, traitViability, catalogBiasIds)
        if (sc > bestScore) { runnerUpSlot = bestSlot; runnerUpScore = bestScore; bestScore = sc; bestSlot = s }
        else if (sc > runnerUpScore) { runnerUpScore = sc; runnerUpSlot = s }
      }
      // TRAINING-ONLY ε-swap: occasionally take the second-best affordable
      // unit instead of the best. Scaling the learned weight (above) lets the
      // bandit outvote a heuristic it has evidence against, but it can still
      // never try something it has NO evidence about — the flat prior
      // contributes exactly 0, so an untested option is permanently stuck
      // behind whatever the hand-coded rules already like. This forces a
      // genuinely different line into some games so those keys get their
      // first real observations. Off entirely for live bots.
      if (explorationMode && runnerUpSlot >= 0 && rng() < EXPLORATION_SWAP_CHANCE) {
        bestSlot = runnerUpSlot
      }
      if (bestSlot >= 0) {
        const id = econ.shop[bestSlot]!
        const res = buyUnit(state, econ, bestSlot)
        if (res.ok) { log.bought.push(id); boughtAny = true }
      }
    }
  }

  // XP purchases toward the persona's target level
  while (
    econ.level < effectiveTarget &&
    econ.gold - XP_BUY_COST >= xpReserve &&
    buyXp(econ)
  ) { log.xpBought++ }

  // Shop loop: buy from the free shop, then reroll while above the reserve.
  // Needing bodies to fill the level overrides greed — an under-filled board
  // is always worth rolling for.
  // Roll harder when spending down or in the late game (to actually hit star-up
  // copies and splash 5-costs), and let even a "greed" bot roll then.
  // A trailing bot digs harder: up to +14 extra rolls at a full deficit.
  const catchUpRolls = lateGame ? Math.round(catchUp * 14) : 0
  const maxRolls = (rerollTarget ? 28 : (forceSpend || lateGame) ? 18 : MAX_ROLLS_PER_ROUND) + catchUpRolls
  buyFromShop()
  while (
    log.rolls < maxRolls &&
    econ.gold - REROLL_COST >= (ownedUnits() < econ.level ? 0 : reserve) &&
    (log.mode !== 'greed' || forceSpend || lateGame || rerollTarget || ownedUnits() < econ.level)
  ) {
    if (!reroll(econ, state.pool, rng)) break
    log.rolls++
    buyFromShop()
  }

  // Bench hygiene: if fewer than 2 free slots, sell the least wanted stray
  let freeSlots = econ.bench.filter(b => b === null).length
  while (freeSlots < 2) {
    let worst = -1
    let worstScore = Infinity
    for (let i = 0; i < econ.bench.length; i++) {
      const b = econ.bench[i]
      if (!b) continue
      const bCost = UNIT_MAP.get(b.definitionId)?.cost ?? 0
      if (bCost >= 4) continue                       // never sell a high-cost splash
      // Normally keep every 2★+. But late game a BENCHED cheap 2★ is dead gold that
      // could be funding a 2★ 4-cost, so cash it in (reroll comps keep their copies).
      const staleCheapStar = stage >= 5 && !rerollTarget && b.tier === 2 && bCost <= 2
      if (b.tier > 1 && !staleCheapStar) continue
      const sc = scoreUnit(econ, persona, genome, b.definitionId, rerollTarget?.defIds, catchUp, false, priorityTraits, legendaryMode, stage, explorationMode, rng, traitViability, catalogBiasIds)
      if (sc < worstScore) { worstScore = sc; worst = i }
    }
    if (worst === -1) break
    sellFromBench(state, econ, worst)
    freeSlots++
  }

  // Field the strongest lineup and position it (stage-aware: boards shift toward
  // higher-cost units and shed marginal traits as the game goes on)
  const picked = chooseFielded(econ, persona, stage, priorityTraits, explorationMode, rng)
  const fieldedIds = new Set(picked.filter(p => p.fromBench !== null).map(p => p.fromBench))
  const keptFromBoard = picked.filter(p => p.fromBench === null)

  // Preserve owned items across the rebuild below: positionFielded creates fresh
  // board entries with no item, and fielded bench slots get cleared — so without
  // this, every equipped item is destroyed each planning round. Park them on the
  // item bench; equipBotItems re-assigns them to the new board at the end.
  for (const u of econ.board) { if (u.item) { econ.itemBench.push(u.item); u.item = undefined } }
  for (const b of econ.bench) { if (b?.item) { econ.itemBench.push(b.item); b.item = undefined } }

  // Rebuild bench: anything on the old board that wasn't re-picked goes to bench
  const oldBoard = [...econ.board]
  econ.board = positionFielded(picked)
  for (const idx of fieldedIds) econ.bench[idx as number] = null
  for (const u of oldBoard) {
    const still = keptFromBoard.find(p => p.definitionId === u.definitionId && p.tier === u.tier)
    if (still) { keptFromBoard.splice(keptFromBoard.indexOf(still), 1); continue }
    const free = econ.bench.findIndex(b => b === null)
    if (free !== -1) econ.bench[free] = { definitionId: u.definitionId, tier: u.tier }
    // no bench room → unit is lost (rare; acceptable for bots)
  }

  // Re-equip owned items onto the freshly-fielded board (moves items as the board changes)
  equipBotItems(econ, rng)

  return log
}
