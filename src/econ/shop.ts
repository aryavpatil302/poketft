// Shop: rolling slots by level odds against the shared pool, buying (into
// bench or straight into a combine), selling, rerolling. All functions work
// on any PlayerEcon — the human and the bots use exactly the same rules.

import { UNIT_MAP } from '../data/units'
import type { PlayerEcon, RunState } from './runState'
import { shopEligibleUnits } from './runState'
import {
  SHOP_SLOTS, SHOP_ODDS, REROLL_COST, sellValue, copiesHeld,
  SHINY_ROLL_CHANCE, SHINY_COST_ODDS, SHINY_TIER,
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

// True when a shiny is already owned anywhere — bench or board. TFT Set 4's
// rule: never offer a second shiny (Chosen) while holding one.
export function hasShinyOwned(econ: PlayerEcon): boolean {
  if (econ.bench.some(b => b?.isShiny)) return true
  if (econ.board.some(u => u.isShiny)) return true
  return false
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
  // shopShiny always resets in sync with a fresh shop. Order below is
  // load-bearing for test determinism: reset -> ownership gate -> chance
  // roll -> cost tier -> candidate id -> slot. No cross-tier fallback: a
  // depleted or empty tier is a normal outcome, not retried against
  // another tier.
  for (let i = 0; i < SHOP_SLOTS; i++) econ.shopShiny[i] = false
  if (hasShinyOwned(econ)) return
  if (rng() >= SHINY_ROLL_CHANCE) return
  const shinyOdds = SHINY_COST_ODDS[Math.max(1, Math.min(9, econ.level))]
  const shinyCost = pickWeightedIndex(shinyOdds, rng)
  if (shinyCost === 0) return
  const shinyCandidates = byCost[shinyCost].filter(u => u.copies >= copiesHeld(SHINY_TIER))
  if (shinyCandidates.length === 0) return
  const shinyId = pickWeightedId(shinyCandidates, rng)
  const shinySlot = Math.min(SHOP_SLOTS - 1, Math.floor(rng() * SHOP_SLOTS))
  econ.shop[shinySlot] = shinyId
  econ.shopShiny[shinySlot] = true
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
  if (econ.gold < def.cost) return { ok: false, reason: 'no-gold' }
  if ((state.pool[defId] ?? 0) <= 0) return { ok: false, reason: 'pool-empty' }

  const benchSlot = econ.bench.findIndex(b => b === null)
  if (benchSlot === -1 && !wouldCombine(econ, defId)) {
    return { ok: false, reason: 'bench-full' }
  }

  econ.gold -= def.cost
  state.pool[defId]--
  econ.shop[slot] = null

  if (benchSlot !== -1) {
    econ.bench[benchSlot] = { definitionId: defId, tier: 1 }
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
