// 3-copy combining: three units of the same species and star tier (across
// bench + board) merge into one at the next tier, chaining automatically
// (nine 1★ copies → 3★). Combining never increases occupancy (3 slots → 1),
// so it is always bench-safe.

import type { PlayerEcon } from './runState'

export interface Upgrade {
  definitionId: string
  from: 1 | 2
  to: 2 | 3
  placedOnBoard: boolean   // the upgraded unit landed on the board (kept a consumed board slot)
}

export interface CombineResult {
  upgrades: Upgrade[]
}

function key(definitionId: string, tier: number): string {
  return `${definitionId}@${tier}`
}

// One merge pass: find the first defId+tier (tier < 3) with 3+ copies and merge.
// Bench copies are consumed first; if any board copy is consumed, the upgraded
// unit takes over the first consumed board copy's hex (keeps player placement),
// otherwise it lands in the first freed bench slot.
function mergeOnce(econ: PlayerEcon, preferId?: string): Upgrade | null {
  const counts = new Map<string, number>()
  for (const b of econ.bench) if (b && b.tier < 3) counts.set(key(b.definitionId, b.tier), (counts.get(key(b.definitionId, b.tier)) ?? 0) + 1)
  for (const u of econ.board) if (u.tier < 3) counts.set(key(u.definitionId, u.tier), (counts.get(key(u.definitionId, u.tier)) ?? 0) + 1)

  let target: { definitionId: string; tier: 1 | 2 } | null = null
  for (const [k, n] of counts) {
    if (n < 3) continue
    const [definitionId, tierStr] = k.split('@')
    const tier = Number(tierStr) as 1 | 2
    if (preferId && definitionId === preferId) { target = { definitionId, tier }; break }
    if (!target) target = { definitionId, tier }
  }
  if (!target) return null

  const { definitionId, tier } = target
  let toRemove = 3
  const freedBenchSlots: number[] = []
  // Items on the consumed copies must not vanish. Board items are gathered in
  // placement order (so the position-keeping copy's item is preferred), ahead of
  // bench items; the upgraded unit keeps the first, extras return to the item bench.
  const boardItems: string[] = []
  const benchItems: string[] = []

  // Bench copies first
  for (let i = 0; i < econ.bench.length && toRemove > 0; i++) {
    const b = econ.bench[i]
    if (b && b.definitionId === definitionId && b.tier === tier) {
      if (b.item) benchItems.push(b.item)
      econ.bench[i] = null
      freedBenchSlots.push(i)
      toRemove--
    }
  }

  // Then board copies — consume in placement order so the upgraded unit keeps
  // the EARLIEST consumed board position (phantom copies appended by the
  // bench-full buy path sit at the end and never win the position)
  const boardIdxs: number[] = []
  for (let i = 0; i < econ.board.length && boardIdxs.length < toRemove; i++) {
    const u = econ.board[i]
    if (u.definitionId === definitionId && u.tier === tier) boardIdxs.push(i)
  }
  let boardPos: { col: number; row: number } | null = null
  if (boardIdxs.length > 0) {
    boardPos = { ...econ.board[boardIdxs[0]].hexPos }
    for (const bi of boardIdxs) { const it = econ.board[bi].item; if (it) boardItems.push(it) }
    for (let i = boardIdxs.length - 1; i >= 0; i--) econ.board.splice(boardIdxs[i], 1)
    toRemove -= boardIdxs.length
  }

  const carriedItems = [...boardItems, ...benchItems]
  const keptItem = carriedItems[0]
  for (let i = 1; i < carriedItems.length; i++) econ.itemBench.push(carriedItems[i])

  const newTier = (tier + 1) as 2 | 3
  if (boardPos) {
    econ.board.push({ definitionId, tier: newTier, hexPos: boardPos, item: keptItem })
  } else {
    econ.bench[freedBenchSlots[0]] = { definitionId, tier: newTier, item: keptItem }
  }

  return { definitionId, from: tier, to: newTier, placedOnBoard: boardPos !== null }
}

// Merge until stable. `hint` biases the first pass toward a just-bought unit
// so its upgrade resolves before unrelated pending triples.
export function tryCombine(econ: PlayerEcon, hint?: string): CombineResult | null {
  const upgrades: Upgrade[] = []
  let up = mergeOnce(econ, hint)
  while (up) {
    upgrades.push(up)
    up = mergeOnce(econ, up.definitionId)   // chase chains for the same species first
  }
  return upgrades.length > 0 ? { upgrades } : null
}

// Would buying one more copy of defId complete a merge right now?
// (Used to allow buys with a full bench, TFT-style.)
export function wouldCombine(econ: PlayerEcon, definitionId: string): boolean {
  let n = 1   // the copy about to be bought
  for (const b of econ.bench) if (b && b.definitionId === definitionId && b.tier === 1) n++
  for (const u of econ.board) if (u.definitionId === definitionId && u.tier === 1) n++
  return n >= 3
}
