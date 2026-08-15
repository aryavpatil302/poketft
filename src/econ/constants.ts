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
