// 3-copy combining: three units of the same species and star tier (across
// bench + board) merge into one at the next tier, chaining automatically
// (nine 1★ copies → 3★). Combining never increases occupancy (3 slots → 1),
// so it is always bench-safe.

import type { PlayerEcon, RunState } from './runState'

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
//
// `allowBoardConsumption` (default true): when false, a triple is only
// eligible if bench copies ALONE already satisfy it — a unit currently
// fielded (part of an already-recorded, still-playing-back fight) is never
// consumed. Used to defer a combine that would need a board copy until the
// next planning phase (see resolvePendingCombines below), while a
// bench-only triple still combines immediately regardless of mode.
function mergeOnce(econ: PlayerEcon, preferId?: string, allowBoardConsumption = true): Upgrade | null {
  const benchCounts = new Map<string, number>()
  const totalCounts = new Map<string, number>()
  for (const b of econ.bench) {
    if (!b || b.tier >= 3) continue
    const k = key(b.definitionId, b.tier)
    benchCounts.set(k, (benchCounts.get(k) ?? 0) + 1)
    totalCounts.set(k, (totalCounts.get(k) ?? 0) + 1)
  }
  for (const u of econ.board) {
    if (u.tier >= 3) continue
    const k = key(u.definitionId, u.tier)
    totalCounts.set(k, (totalCounts.get(k) ?? 0) + 1)
  }
  const counts = allowBoardConsumption ? totalCounts : benchCounts

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
  // True when ANY of the three consumed copies carried the shiny flag.
  // NOTE: the cap is one shiny FIELDED, not one shiny OWNED — rollShop keeps
  // offering Chosen units on a pity cadence while one is already owned (see
  // hasShinyOwned in src/econ/shop.ts), so a roster can legitimately hold
  // several, and in the rare case two are the same species at the same tier
  // they can both land in one merge. "Any" is therefore the load-bearing rule
  // here, not merely the safer phrasing of a guaranteed-single case.
  let carriedShiny = false
  // The Chosen trait riding along with carriedShiny above — same "any of the
  // three copies" rule. If two consumed copies were both shiny, the last one
  // scanned wins; the merged unit stays a single shiny either way.
  let carriedChosenTrait: string | undefined

  // Bench copies first
  for (let i = 0; i < econ.bench.length && toRemove > 0; i++) {
    const b = econ.bench[i]
    if (b && b.definitionId === definitionId && b.tier === tier) {
      if (b.item) benchItems.push(b.item)
      if (b.isShiny) carriedShiny = true
      if (b.chosenTrait) carriedChosenTrait = b.chosenTrait
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
    for (const bi of boardIdxs) {
      const it = econ.board[bi].item
      if (it) boardItems.push(it)
      if (econ.board[bi].isShiny) carriedShiny = true
      if (econ.board[bi].chosenTrait) carriedChosenTrait = econ.board[bi].chosenTrait
    }
    for (let i = boardIdxs.length - 1; i >= 0; i--) econ.board.splice(boardIdxs[i], 1)
    toRemove -= boardIdxs.length
  }

  const carriedItems = [...boardItems, ...benchItems]
  const keptItem = carriedItems[0]
  for (let i = 1; i < carriedItems.length; i++) econ.itemBench.push(carriedItems[i])

  const newTier = (tier + 1) as 2 | 3
  if (boardPos) {
    econ.board.push({
      definitionId, tier: newTier, hexPos: boardPos, item: keptItem,
      ...(carriedShiny && { isShiny: true }),
      ...(carriedChosenTrait && { chosenTrait: carriedChosenTrait }),
    })
  } else {
    econ.bench[freedBenchSlots[0]] = {
      definitionId, tier: newTier, item: keptItem,
      ...(carriedShiny && { isShiny: true }),
      ...(carriedChosenTrait && { chosenTrait: carriedChosenTrait }),
    }
  }

  return { definitionId, from: tier, to: newTier, placedOnBoard: boardPos !== null }
}

// Merge until stable. `hint` biases the first pass toward a just-bought unit
// so its upgrade resolves before unrelated pending triples. See mergeOnce
// for `allowBoardConsumption`.
export function tryCombine(econ: PlayerEcon, hint?: string, allowBoardConsumption = true): CombineResult | null {
  const upgrades: Upgrade[] = []
  let up = mergeOnce(econ, hint, allowBoardConsumption)
  while (up) {
    upgrades.push(up)
    up = mergeOnce(econ, up.definitionId, allowBoardConsumption)   // chase chains for the same species first
  }
  return upgrades.length > 0 ? { upgrades } : null
}

// Would buying one more copy of defId complete a merge right now?
// (Used to allow buys with a full bench, TFT-style.) See mergeOnce for
// `allowBoardConsumption` — when false, a fielded copy doesn't count toward
// the triple.
export function wouldCombine(econ: PlayerEcon, definitionId: string, allowBoardConsumption = true): boolean {
  let bench = 1   // the copy about to be bought
  let total = 1
  for (const b of econ.bench) if (b && b.definitionId === definitionId && b.tier === 1) { bench++; total++ }
  for (const u of econ.board) if (u.definitionId === definitionId && u.tier === 1) total++
  return allowBoardConsumption ? total >= 3 : bench >= 3
}

// Sweeps every seat for any triple that was left pending because it could
// only be completed by consuming a fielded (board) copy while
// allowBoardConsumption was false — see buyUnit's call site in shop.ts.
// Called exactly once per round transition, at the same synchronized
// moment the next planning phase opens (party/lobby.ts's
// openPlanningWindow, or restorePlayerBoard's solo path), so a deferred
// star-up lands the instant the board it was waiting on is no longer part
// of an active replay. Idempotent — a seat with nothing pending is a no-op.
export function resolvePendingCombines(state: RunState): void {
  for (const econ of state.players) tryCombine(econ, undefined, true)
}
