// Shop: rolling slots by level odds against the shared pool, buying (into
// bench or straight into a combine), selling, rerolling. All functions work
// on any PlayerEcon — the human and the bots use exactly the same rules.

import { UNIT_MAP } from '../data/units'
import type { PlayerEcon, RunState } from './runState'
import { shopEligibleUnits } from './runState'
import {
  SHOP_SLOTS, SHOP_ODDS, REROLL_COST, sellValue, copiesHeld,
  SHINY_ROLL_CHANCE, SHINY_COST_ODDS, SHINY_TIER, shinyPrice,
  SHINY_PITY_ROLLS, CHOSEN_TRAIT_INELIGIBLE,
} from './constants'
import { tryCombine, wouldCombine, type CombineResult } from './combine'

export type Rng = () => number

// Weighted pick over a fixed set of buckets (1-indexed in the return value).
// Returns 0 when every weight is non-positive — WITHOUT drawing from rng in
// that case, so an all-zero call costs nothing in the rng sequence. Shared by
// rollCost's odds pass/fallback pass and the shiny cost-tier pick.
function pickWeightedIndex(weights: readonly number[], rng: Rng): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i + 1
  }
  return weights.length
}

// Weighted pick of one id from candidates carrying remaining pool copies.
// Defaults to the last candidate (mirrors the original inline walk) in the
// unreachable case where floating-point drift leaves r >= 0 after the loop.
function pickWeightedId(candidates: Array<{ id: string; copies: number }>, rng: Rng): string {
  const total = candidates.reduce((a, u) => a + u.copies, 0)
  let r = rng() * total
  let picked = candidates[candidates.length - 1].id
  for (const u of candidates) {
    r -= u.copies
    if (r < 0) { picked = u.id; break }
  }
  return picked
}

// Roll one cost bucket by the level's odds, renormalizing over buckets that
// still have pool copies. Returns 0 when the entire pool is empty.
function rollCost(level: number, bucketWeights: number[], rng: Rng): number {
  const odds = SHOP_ODDS[Math.max(1, Math.min(10, level))]
  const weights = odds.map((p, i) => (bucketWeights[i] > 0 ? p : 0))
  const picked = pickWeightedIndex(weights, rng)
  if (picked !== 0) return picked
  // odds-eligible buckets are all empty — fall back to ANY non-empty bucket
  const any: number[] = bucketWeights.map(w => (w > 0 ? 1 : 0))
  return pickWeightedIndex(any, rng)
}

// Total pool copies remaining per cost bucket [1c..5c]
function bucketTotals(pool: Record<string, number>): number[] {
  const totals = [0, 0, 0, 0, 0]
  for (const def of shopEligibleUnits()) {
    totals[def.cost - 1] += pool[def.id] ?? 0
  }
  return totals
}

// True when a shiny is already owned anywhere — bench or board. Ownership no
// longer blocks further Chosen offers outright (see rollShop's shiny pass
// below) — it instead switches the offer mechanism from probabilistic to a
// guaranteed periodic pity timer, matching TFT's real Chosen mechanic.
export function hasShinyOwned(econ: PlayerEcon): boolean {
  if (econ.bench.some(b => b?.isShiny)) return true
  if (econ.board.some(u => u.isShiny)) return true
  return false
}

// Rolls the ONE Chosen trait a newly-shiny candidate gets, from its own
// UNIT_MAP types, EXCLUDING the single-unit-presence traits in
// CHOSEN_TRAIT_INELIGIBLE (doubling those is meaningless — they have no real
// "N members" threshold). Falls back to the unfiltered type list in the
// (should-be-rare/never) case where every one of a unit's types is
// ineligible. Draws exactly one rng() call — via the same injected `rng` the
// rest of the shiny pass uses, for test determinism — except in the
// (unreachable in practice) case where a unit has zero types at all.
function pickChosenTrait(defId: string, rng: Rng): string | null {
  const def = UNIT_MAP.get(defId)
  if (!def || def.types.length === 0) return null
  const eligible = def.types.filter(t => !CHOSEN_TRAIT_INELIGIBLE.has(t))
  const pool = eligible.length > 0 ? eligible : def.types
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length))
  return pool[idx]
}

// Fill every shop slot. Slots roll independently (TFT-style); a unit's draw
// chance within its cost is weighted by its remaining pool copies. The pool
// is NOT decremented on roll — copies leave the pool on BUY.
export function rollShop(econ: PlayerEcon, pool: Record<string, number>, rng: Rng = Math.random): void {
  const totals = bucketTotals(pool)
  const byCost: Record<number, Array<{ id: string; copies: number }>> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  for (const def of shopEligibleUnits()) {
    const copies = pool[def.id] ?? 0
    if (copies > 0) byCost[def.cost].push({ id: def.id, copies })
  }

  for (let slot = 0; slot < SHOP_SLOTS; slot++) {
    const cost = rollCost(econ.level, totals, rng)
    if (cost === 0) { econ.shop[slot] = null; continue }
    econ.shop[slot] = pickWeightedId(byCost[cost], rng)
  }

  // ─── Shiny pass ────────────────────────────────────────────────────────
  // Independently-rolled instant-2★ offer (TFT Set 4 "Chosen"-style), run
  // AFTER the normal per-slot loop above and BEFORE any early return so
  // shopShiny/shopShinyTrait always reset in sync with a fresh shop. A
  // Chosen offer, when it appears, ALWAYS lands in the rightmost slot
  // (SHOP_SLOTS - 1) — real TFT behavior, not a random slot among the 5.
  //
  // Cadence depends on ownership (see hasShinyOwned):
  //   - NOT owning: unchanged — a probabilistic roll every shop
  //     (rng() < SHINY_ROLL_CHANCE).
  //   - Owning: the probabilistic roll is REPLACED (not stacked) by a
  //     guaranteed periodic pity timer — every 4th roll while owned is a
  //     guaranteed Chosen offer, rolls 1-3 offer nothing. shinyPityCounter
  //     resets to 0 whenever ownership is false, so it always starts fresh
  //     the next time a shiny is picked up, and also resets to 0 the moment
  //     it fires (on the guaranteed 4th roll).
  //
  // Order below is load-bearing for test determinism: reset -> ownership
  // branch -> cost tier -> candidate id -> chosen-trait pick. No cross-tier
  // fallback: a depleted or empty tier is a normal outcome, not retried
  // against another tier.
  for (let i = 0; i < SHOP_SLOTS; i++) { econ.shopShiny[i] = false; econ.shopShinyTrait[i] = null }

  if (hasShinyOwned(econ)) {
    econ.shinyPityCounter++
    if (econ.shinyPityCounter < SHINY_PITY_ROLLS) return   // rolls 1-3 while owned: no offer
    econ.shinyPityCounter = 0   // the guaranteed 4th roll: fall through to the offer, then reset
  } else {
    econ.shinyPityCounter = 0
    if (rng() >= SHINY_ROLL_CHANCE) return
  }

  const shinyOdds = SHINY_COST_ODDS[Math.max(1, Math.min(9, econ.level))]
  const shinyCost = pickWeightedIndex(shinyOdds, rng)
  if (shinyCost === 0) return
  const shinyCandidates = byCost[shinyCost].filter(u => u.copies >= copiesHeld(SHINY_TIER))
  if (shinyCandidates.length === 0) return
  const shinyId = pickWeightedId(shinyCandidates, rng)
  const chosenTrait = pickChosenTrait(shinyId, rng)
  const shinySlot = SHOP_SLOTS - 1
  econ.shop[shinySlot] = shinyId
  econ.shopShiny[shinySlot] = true
  econ.shopShinyTrait[shinySlot] = chosenTrait
}

// Paid (or free) reroll. Clears the lock (TFT behavior).
export function reroll(econ: PlayerEcon, pool: Record<string, number>, rng: Rng = Math.random, free = false): boolean {
  if (!free) {
    if (econ.gold < REROLL_COST) return false
    econ.gold -= REROLL_COST
  }
  econ.shopLocked = false
  rollShop(econ, pool, rng)
  return true
}

export type BuyResult =
  | { ok: true; combined: CombineResult | null }
  | { ok: false; reason: 'empty-slot' | 'no-gold' | 'bench-full' | 'pool-empty' }

export function buyUnit(state: RunState, econ: PlayerEcon, slot: number): BuyResult {
  const defId = econ.shop[slot]
  if (!defId) return { ok: false, reason: 'empty-slot' }
  const def = UNIT_MAP.get(defId)
  if (!def) return { ok: false, reason: 'empty-slot' }

  // A shiny buy is priced and pooled as exactly a three-copy 2★: charging
  // shinyPrice(cost) and removing copiesHeld(SHINY_TIER) pool copies keeps
  // the tier-derived sellValue/copiesHeld formulas honest on the eventual
  // sell-back. strict === true because a legacy save's backfilled shopShiny
  // array is the only thing guaranteeing the index exists.
  const shiny = econ.shopShiny[slot] === true
  const chosenTrait = shiny ? econ.shopShinyTrait[slot] : null
  const price = shiny ? shinyPrice(def.cost) : def.cost
  const copies = shiny ? copiesHeld(SHINY_TIER) : 1
  const tier = shiny ? SHINY_TIER : 1

  if (econ.gold < price) return { ok: false, reason: 'no-gold' }
  // Re-checked here (not just at roll time) because the pool is shared —
  // another seat can drain the id between roll and buy.
  if ((state.pool[defId] ?? 0) < copies) return { ok: false, reason: 'pool-empty' }

  const benchSlot = econ.bench.findIndex(b => b === null)
  if (benchSlot === -1) {
    // A shiny is always tier 2+, so the tier-1-only phantom-copy path below
    // must never be consulted for a shiny buy — reaching it would charge 3x
    // and hand back an ordinary 2★ from an unrelated tier-1 merge, silently
    // destroying the shiny. This guard MUST run before wouldCombine.
    if (shiny) return { ok: false, reason: 'bench-full' }
    if (!wouldCombine(econ, defId)) return { ok: false, reason: 'bench-full' }
  }

  econ.gold -= price
  state.pool[defId] -= copies
  econ.shop[slot] = null
  econ.shopShiny[slot] = false
  econ.shopShinyTrait[slot] = null

  if (benchSlot !== -1) {
    econ.bench[benchSlot] = {
      definitionId: defId, tier,
      ...(shiny && { isShiny: true }),
      ...(chosenTrait && { chosenTrait }),
    }
    return { ok: true, combined: tryCombine(econ, defId) }
  }

  // Bench full but the buy completes a triple: merge the two existing copies
  // first (frees a slot), then bench the new copy and merge again.
  const twoExisting = tryCombineWithVirtualCopy(econ, defId)
  return { ok: true, combined: twoExisting }
}

// Bench-full purchase path: stash the bought copy on the board at a phantom
// position, run the combine (guaranteed by the wouldCombine gate), then move
// the result to the bench if it landed on the phantom spot. mergeOnce keeps
// the EARLIEST board position, so real board placements always win over the
// phantom.
function tryCombineWithVirtualCopy(econ: PlayerEcon, defId: string): CombineResult | null {
  econ.board.push({ definitionId: defId, tier: 1, hexPos: { col: -1, row: -1 } })
  const res = tryCombine(econ, defId)

  // Defensive: if no merge happened, drop the phantom 1★ copy
  const phantom1 = econ.board.findIndex(u => u.hexPos.col === -1 && u.tier === 1)
  if (phantom1 !== -1) econ.board.splice(phantom1, 1)

  // If the upgrade landed on the phantom position (no real board copy was
  // consumed), relocate it to the bench — the merge freed at least two slots.
  const upIdx = econ.board.findIndex(u => u.hexPos.col === -1)
  if (upIdx !== -1) {
    const up = econ.board.splice(upIdx, 1)[0]
    const free = econ.bench.findIndex(b => b === null)
    if (free !== -1) econ.bench[free] = { definitionId: up.definitionId, tier: up.tier }
  }
  return res
}

export function sellFromBench(state: RunState, econ: PlayerEcon, slot: number): boolean {
  const b = econ.bench[slot]
  if (!b) return false
  const def = UNIT_MAP.get(b.definitionId)
  if (!def) return false
  econ.gold += sellValue(def.cost, b.tier)
  state.pool[b.definitionId] = (state.pool[b.definitionId] ?? 0) + copiesHeld(b.tier)
  if (b.item) econ.itemBench.push(b.item)   // a sold unit's item returns to the item bench
  econ.bench[slot] = null
  return true
}

export function sellFromBoard(state: RunState, econ: PlayerEcon, boardIndex: number): boolean {
  const u = econ.board[boardIndex]
  if (!u) return false
  const def = UNIT_MAP.get(u.definitionId)
  if (!def) return false
  econ.gold += sellValue(def.cost, u.tier)
  state.pool[u.definitionId] = (state.pool[u.definitionId] ?? 0) + copiesHeld(u.tier)
  if (u.item) econ.itemBench.push(u.item)   // a sold unit's item returns to the item bench
  econ.board.splice(boardIndex, 1)
  return true
}

// Return every unit a player holds to the pool (elimination / new run cleanup)
export function returnAllToPool(state: RunState, econ: PlayerEcon): void {
  for (const b of econ.bench) {
    if (b) state.pool[b.definitionId] = (state.pool[b.definitionId] ?? 0) + copiesHeld(b.tier)
  }
  for (const u of econ.board) {
    state.pool[u.definitionId] = (state.pool[u.definitionId] ?? 0) + copiesHeld(u.tier)
  }
  econ.bench = econ.bench.map(() => null)
  econ.board = []
  econ.shop = econ.shop.map(() => null)
}
