// TFT-style economy constants. Every tunable for the meta game lives here.
// Numbers follow live TFT where a direct equivalent exists.

export const SHOP_SLOTS  = 5
export const BENCH_SLOTS = 9
export const REROLL_COST = 2
export const XP_BUY_COST   = 4
export const XP_BUY_AMOUNT = 4
export const XP_PER_ROUND  = 2

export const STARTING_HP    = 100
export const STARTING_GOLD  = 0
export const STARTING_LEVEL = 1   // everyone starts with a 3-unit board cap
export const MAX_LEVEL      = 10
export const MAX_INTEREST   = 5
export const WIN_BONUS      = 1

export const PLAYER_COUNT = 6   // human + 5 bots

// XP needed to advance FROM level (index+1): L1→2 ... L9→10. Scaled to ~75%
// of live TFT's curve — that curve is paced around an 8-player lobby needing
// 7 eliminations to end; this game runs PLAYER_COUNT = 6, needing only 5, so
// the full TFT curve routinely outlasts the game (6/8 = 0.75, matching the
// closer eliminations-needed ratio of 5/7 ≈ 0.71). Kept as multiples of
// XP_BUY_AMOUNT (4) so buying XP never leaves an awkward partial-level
// remainder.
export const XP_TO_NEXT = [2, 2, 4, 8, 16, 28, 36, 56, 64] as const

// Shop odds per level: percentages for [1c, 2c, 3c, 4c, 5c]
export const SHOP_ODDS: Record<number, readonly [number, number, number, number, number]> = {
  1:  [100, 0, 0, 0, 0],
  2:  [100, 0, 0, 0, 0],
  3:  [75, 25, 0, 0, 0],
  4:  [55, 30, 15, 0, 0],
  5:  [45, 33, 20, 2, 0],
  6:  [30, 40, 25, 5, 0],
  7:  [19, 30, 40, 10, 1],
  8:  [17, 24, 32, 24, 3],
  9:  [15, 18, 25, 30, 12],
  10: [5, 10, 20, 40, 25],
}

// For each cost tier, the lowest level at which that cost's shop odds reach
// ≥5% — i.e. "the level this cost tier actually becomes gettable," derived
// from SHOP_ODDS rather than hand-guessed. Used to estimate what level a
// catalog composition's most expensive core unit realistically needs.
export const LEVEL_FOR_COST: Record<number, number> = (() => {
  const COST_IDX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 }
  const out: Record<number, number> = {}
  for (const cost of [1, 2, 3, 4, 5]) {
    const idx = COST_IDX[cost]
    let level = MAX_LEVEL
    for (let l = 1; l <= MAX_LEVEL; l++) {
      if (SHOP_ODDS[l][idx] >= 5) { level = l; break }
    }
    out[cost] = level
  }
  return out
})()

// Copies of each unit in the shared pool, by unit cost
export const POOL_COPIES: Record<number, number> = { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 }

// Base income by round: rounds 1-3 ramp, then BASE_INCOME_CAP forever
export const BASE_INCOME_BY_ROUND = [2, 3, 4] as const
export const BASE_INCOME_CAP = 5

// Streak gold (win OR loss streak of this length)
export function streakBonus(len: number): number {
  const n = Math.abs(len)
  return n >= 6 ? 3 : n === 5 ? 2 : n >= 3 ? 1 : 0
}

// Sell value: 1★ = cost; upgraded units carry a 1g penalty (TFT rule)
export function sellValue(cost: number, tier: 1 | 2 | 3): number {
  if (tier === 1) return cost
  if (tier === 2) return cost * 3 - 1
  return cost * 9 - 1
}

// Pool copies physically held by a unit of the given star tier
export function copiesHeld(tier: 1 | 2 | 3): number {
  return Math.pow(3, tier - 1)
}

// ─── Shiny Pokémon ─────────────────────────────────────────────────────────
// Grouped for the shiny-Pokémon feature: an instant-2★ shop offer modeled on
// TFT Set 4's "Chosen" mechanic. SHINY_PRICE_MULT is deliberately pinned to
// copiesHeld(2) = 3 for economy safety — a shiny buy must cost and consume
// exactly what a real three-copy 2★ combine does, because sellValue and
// copiesHeld are both tier-derived; pricing or pooling a shiny as a single
// copy would let buy-then-sell mint gold and duplicate pool copies through
// those existing formulas, so this value is not independently tunable.
// SHINY_COST_ODDS is shaped identically to SHOP_ODDS above
// (Record<level, [pct1c..pct5c]>) specifically so the shop roll can reuse
// whatever weighted-bucket picker SHOP_ODDS already feeds, rather than
// growing a second one. Both SHINY_ROLL_CHANCE and SHINY_COST_ODDS come from
// TFT Set 4's real Chosen mechanic (confirmed reference data), not from
// guesswork — but remain tunable for this game's own pool sizes and pacing.
export const SHINY_ROLL_CHANCE = 0.50   // probability an eligible shop roll produces a shiny

// This table stops at level 9 because TFT Set 4 capped players at level 9,
// whereas MAX_LEVEL here is 10 — a bare SHINY_COST_ODDS[10] lookup resolves
// to undefined. Ships verbatim as approved; the shop-roll step (step 2) must
// handle the level-10 case deliberately instead of discovering it as a crash.
export const SHINY_COST_ODDS: Record<number, readonly [number, number, number, number, number]> = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [100, 0, 0, 0, 0],
  4: [80, 20, 0, 0, 0],
  5: [40, 55, 5, 0, 0],
  6: [0, 60, 40, 0, 0],
  7: [0, 40, 58, 2, 0],
  8: [0, 0, 60, 40, 0],
  9: [0, 0, 0, 60, 40],
}
export const SHINY_PRICE_MULT = 3       // buy price multiplier; MUST equal copiesHeld(SHINY_TIER) — see comment above
export function shinyPrice(cost: number): number { return cost * SHINY_PRICE_MULT }
export const SHINY_TIER = 2 as const

// Real TFT rule: "while you have a Chosen, one appears every 4 shops"
// (guaranteed pity) — see PlayerEcon.shinyPityCounter and rollShop.
export const SHINY_PITY_ROLLS = 4

// Bad-luck protection: a species offered as the Chosen and passed on (shop
// refreshes with the offer still unbought) is excluded from being picked as
// the shiny candidate for this many subsequent shop refreshes (round-end
// roll or paid/free reroll — every real rollShop call counts, not just ones
// where a shiny pass fires). Independent of SHINY_PITY_ROLLS/ownership —
// this only steers WHICH species gets picked once a shiny pass fires, never
// WHETHER one fires. See PlayerEcon.shinyExclusion and rollShop.
export const SHINY_EXCLUSION_SHOPS = 5

// Traits excluded from the Chosen-trait roll: each has only a `count: 1`
// threshold (or, for soul_bonded, a presence-check-based 1/2), never a real
// "N members" species-count threshold — doubling membership toward one of
// these is meaningless, so a shiny unit whose types include one of these
// never has it picked as its chosenTrait. Confirmed against src/data/traits.ts.
export const CHOSEN_TRAIT_INELIGIBLE: ReadonlySet<string> = new Set([
  'rogue', 'shock_spirit', 'soul_bonded', 'wave_spirit', 'earth_spirit', 'mind_spirit', 'zen',
])

// HP lost by the loser of a round, TFT-style:
//   base damage by stage  +  each surviving enemy unit deals its STAR level.
export const STAGE_BASE_DAMAGE = [0, 0, 1, 2, 8, 15, 30] as const

// Which stage a round belongs to. Stage 1 is the 3-round opener (creep, creep,
// Delibird = rounds 1-3). Every later stage is 6 rounds (5 combats + a Delibird),
// so stage 2 = rounds 4-9, stage 3 = 10-15, stage 4 = 16-21, …
export function stageOf(round: number): number {
  if (round <= 3) return 1
  return 2 + Math.floor((round - 4) / 6)
}

export function hpLoss(round: number, survivorStars: number): number {
  const stage = stageOf(round)
  const base = STAGE_BASE_DAMAGE[Math.min(stage, STAGE_BASE_DAMAGE.length) - 1]
  return base + survivorStars
}

// ─── Cave Crawler earthquake rewards ──────────────────────────────────────────
// Reworked (5) mana-cost effect: earthquakes reward the crawler's owner.
//   (3) bench spawn — each quake may drop a random crawler (cost-weighted) on the bench
//   (5) gold        — each quake may also grant 1-5 gold
export const CRAWLER_SPAWN_MIN_SPECIES  = 3     // bench spawn active from 3 unique crawlers
export const CRAWLER_SPAWN_BASE         = 0.12  // per-quake spawn chance floor
export const CRAWLER_SPAWN_PER_STARPOINT = 0.015 // + this per crawler star point (3^(tier-1) each)
export const CRAWLER_SPAWN_MAX          = 0.40  // spawn-chance cap
export const CRAWLER_GOLD_MIN_SPECIES   = 5     // gold drop active from 5 unique crawlers
export const CRAWLER_GOLD_CHANCE        = 0.20  // per-quake gold chance
export const CRAWLER_GOLD_MIN           = 1
export const CRAWLER_GOLD_MAX           = 5
// Weighted crawler pick by cost — cheap crawlers dominate (zubat/druddigon → excadrill rare).
export const CRAWLER_COST_WEIGHT: Record<number, number> = { 1: 6, 2: 3, 3: 2, 4: 1, 5: 1 }

// Stage label for display, e.g. round 3 → "1-3", round 9 → "2-6", round 10 → "3-1".
export function stageLabel(round: number): string {
  const stage = stageOf(round)
  const sub = stage === 1 ? round : ((round - 4) % 6) + 1
  return `${stage}-${sub}`
}
