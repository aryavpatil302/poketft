// Bot item logic: pick an item that suits a bot's current board, and (re)equip
// every item the bot owns onto its best-fit board units each planning round.
// Mirrors the human's single-item-per-unit model; re-running the assignment every
// round is what lets bots "move items around" as their board changes (an item will
// migrate to a stronger unit that also wants it).

import { UNIT_MAP } from '../data/units'
import { ITEM_MAP } from '../data/items'
import { unitPowerScore } from '../enemy/boardPower'
import { itemRoundPool } from './creeps'
import type { PlayerEcon } from './runState'
import type { Rng } from './shop'
import type { ItemCategory, ItemDefinition } from '../core/types'
import { PREFERRED_ITEMS } from './preferredItems'

// Every item a bot currently holds — equipped on the board, on bench units, or
// loose on the item bench. Passed as `owned` to chooseBotItem so it doesn't offer
// a duplicate (mirrors the human's humanOwnedItems).
export function botOwnedItems(econ: PlayerEcon): string[] {
  const out = [...econ.itemBench]
  for (const u of econ.board) if (u.item) out.push(u.item)
  for (const b of econ.bench) if (b?.item) out.push(b.item)
  return out
}

// ─── Item ↔ role fit ──────────────────────────────────────────────────────────
// How much a unit of a given role wants an item, scored from the item's actual
// stats (not just its category tag) so new items are rated automatically:
//   · tanks            → HP, Defense, Sp. Defense
//   · attack roles     → Attack, attack speed, crit, adaptive force
//   · special roles    → Sp. Attack, adaptive force
// Stat magnitudes are normalized to roughly comparable units (HP comes in ~150-450,
// resistances/offense in ~15-40) so one stat can't dominate by raw size alone.
export function itemFitScore(def: ItemDefinition, role: string | undefined): number {
  const b = def.statBonus ?? {}
  const atk = b.attack ?? 0
  const sp = b.special ?? 0
  const hp = b.hp ?? 0
  const dfn = b.defense ?? 0
  const sdf = b.spDefense ?? 0
  const as = (b.attackSpeed ?? 0) * 100 + (def.attackSpeedPct ?? 0) * 100
  const crit = (b.critChance ?? 0) * 100 + (b.critDamage ?? 0) * 50
  // Adaptive force follows whichever offensive stat is higher → good for both
  // attack and special carries.
  const adaptive = (def.adaptiveForce ?? 0) + (def.adaptiveForcePct ?? 0) * 100

  const isTank    = role === 'tank'
  const isSpecial = role === 'special caster' || role === 'special marksman' || role === 'special fighter'
  const isAttack  = role === 'attack caster'  || role === 'attack marksman'  || role === 'attack fighter'

  let s = 0
  if (isTank) {
    s += hp * 0.06 + dfn + sdf          // durability is everything
    s += (atk + sp + adaptive) * 0.05 + as * 0.05 + crit * 0.02   // offense is near-dead weight
  } else if (isSpecial) {
    s += sp + adaptive                  // Sp. Attack / adaptive force
    s += as * 0.25 + crit * 0.1 + atk * 0.05
    s += hp * 0.012 + (dfn + sdf) * 0.15   // survivability still has some value
  } else if (isAttack) {
    s += atk + adaptive                 // Attack / adaptive force
    s += as * 0.6 + crit * 0.5 + sp * 0.05
    s += hp * 0.012 + (dfn + sdf) * 0.15
  } else {
    s += (atk + sp + adaptive) * 0.5 + as * 0.3 + hp * 0.02 + (dfn + sdf) * 0.3
  }

  // The item's own category tag is the designer's hint — a solid bonus on match.
  if (role && (def.categories ?? []).includes(role as ItemCategory)) s += 25
  return Math.max(0, s)
}

// ─── Preferred items (hand-authored reference, no training) ───────────────────
// Item choice is driven by src/econ/preferredItems.ts, a reference YOU maintain
// directly — no learning/discovery involved. A unit's `best` item is taken on
// sight; otherwise one of its `preferred` items is picked (ties broken
// randomly via the rng jitter below). Any item NOT in either list — including
// every item for a unit with no entry at all — falls back to itemFitScore's
// stat-based formula, so an unconfigured unit still gets a sensible pick.
const PREFERENCE_BEST_SCORE = 1000
const PREFERENCE_LISTED_SCORE = 500

function preferenceScore(unitDefId: string, itemId: string): number | null {
  const pref = PREFERRED_ITEMS[unitDefId]
  if (!pref) return null
  if (pref.best === itemId) return PREFERENCE_BEST_SCORE
  if (pref.preferred.includes(itemId)) return PREFERENCE_LISTED_SCORE
  return null
}

// `rng` jitter is what makes "pick one of the preferred items at random" and
// "pick one of the equally-fit fallback items at random" actually random —
// without it every tie would deterministically resolve to the same item.
function combinedItemScore(def: ItemDefinition, unitDefId: string, role: string | undefined, rng: Rng): number {
  const pref = preferenceScore(unitDefId, def.id)
  if (pref !== null) return pref + rng() * 10
  return itemFitScore(def, role)
}

// A unit's "worth holding an item" weight: cost × star, exponential like the rest
// of the power model, so a 2★ 4-cost carry outbids a 1★ 1-cost body.
function holderStrength(defId: string, tier: 1 | 2 | 3): number {
  const def = UNIT_MAP.get(defId)
  if (!def) return 0
  return unitPowerScore(def.cost, tier)
}

// Choose the offerable item that best suits the bot's board — the item that most
// helps the single best-suited unit it owns (fit × that unit's strength). `owned`
// items are avoided (as for the human) unless the pool is exhausted. Returns null
// if the board is empty / no items exist.
export function chooseBotItem(econ: PlayerEcon, owned: string[] = [], rng: Rng = Math.random): string | null {
  let pool = itemRoundPool().filter(i => !owned.includes(i.id))
  if (pool.length === 0) pool = itemRoundPool()
  if (pool.length === 0) return null

  const holders = econ.board.map(u => ({
    defId: u.definitionId,
    role: UNIT_MAP.get(u.definitionId)?.role,
    strength: holderStrength(u.definitionId, u.tier),
  }))

  let best = pool[0]
  let bestScore = -1
  for (const it of pool) {
    let score = 0
    for (const h of holders) score = Math.max(score, combinedItemScore(it, h.defId, h.role, rng) * h.strength)
    score += rng() * 0.01   // tiny jitter so ties vary between bots/rounds
    if (score > bestScore) { bestScore = score; best = it }
  }
  return best.id
}

// (Re)assign every item the bot owns onto its board. Each unit holds at most one
// item (matching the human model). Globally greedy: score every (item, unit) pair
// by fit × holder strength, then take the best pairs first — so the strongest unit
// that actually wants an item gets it, and items migrate as the board improves.
// Anything left over stays on the itemBench.
export function equipBotItems(econ: PlayerEcon, rng: Rng = Math.random): void {
  // Pull every owned item back into one pool so we can re-optimise from scratch.
  const items: string[] = [...econ.itemBench]
  for (const u of econ.board) { if (u.item) { items.push(u.item); u.item = undefined } }
  for (const b of econ.bench) { if (b?.item) { items.push(b.item); b.item = undefined } }
  econ.itemBench = []
  if (items.length === 0) return

  const holders = econ.board.map((u, idx) => ({
    idx,
    defId: u.definitionId,
    role: UNIT_MAP.get(u.definitionId)?.role,
    strength: holderStrength(u.definitionId, u.tier),
  })).filter(h => h.strength > 0)

  // Rank every (item, holder) pairing; +1 floor on fit so a poorly-matched item
  // still lands on a body rather than idling on the bench.
  const pairs: Array<{ item: string; idx: number; score: number }> = []
  for (const itemId of items) {
    const def = ITEM_MAP.get(itemId)
    if (!def) continue
    for (const h of holders) {
      pairs.push({ item: itemId, idx: h.idx, score: (combinedItemScore(def, h.defId, h.role, rng) + 1) * h.strength })
    }
  }
  pairs.sort((a, b) => b.score - a.score)

  const usedUnits = new Set<number>()
  const remaining = new Map<string, number>()
  for (const id of items) remaining.set(id, (remaining.get(id) ?? 0) + 1)

  for (const p of pairs) {
    if (usedUnits.has(p.idx)) continue
    const left = remaining.get(p.item) ?? 0
    if (left <= 0) continue
    econ.board[p.idx].item = p.item
    usedUnits.add(p.idx)
    remaining.set(p.item, left - 1)
  }

  // More items than board units → the surplus waits on the bench.
  for (const [id, count] of remaining) for (let i = 0; i < count; i++) econ.itemBench.push(id)
}
