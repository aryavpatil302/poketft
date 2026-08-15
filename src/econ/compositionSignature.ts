// Shared board-composition signature helpers, used by BOTH the runtime lookup
// (src/econ/bots.ts's scoreUnit/chooseFielded) and the composition-affinity
// training pipeline (src/sim/botLeague.ts's aggregation,
// src/econ/trainCompositionAffinities.ts) — kept in one module so the key
// formats used to WRITE src/econ/learnedCompositionAffinities.ts can never
// drift out of sync with the key formats used to READ them.
//
// Every key is STAGE-scoped (see stageOf in constants.ts): a trait/comp shape
// that's strong early can easily be weak late and vice versa, so win rates
// are tracked and looked up per stage, never pooled across the whole game.
//
// Four independent signals, covering different axes of "how is this board
// built":
//   trait pair      — do these two traits pay off when BOTH are active together
//   unit context     — does this specific unit do well splashed onto a board
//                       already running a given trait direction
//   trait depth      — is investing HEAVILY into one trait (pushing it to its
//                       higher breakpoints) paying off, independent of what
//                       else is on the board
//   breadth          — is running MANY different active traits at once (wide,
//                       shallow) paying off, vs. running few (narrow, deep)

import { UNIT_MAP } from '../data/units'
import { getThresholds } from '../enemy/boardPower'
import { CATALOG_INDEX } from './catalogIndex'

interface BoardUnit { definitionId: string }

// Splash traits: carried by ≤2 possible species AND active at count 1 — i.e.
// a trait that's really just "did you buy this one legendary" (shock_spirit/
// wave_spirit/earth_spirit/mind_spirit/rogue/zen/soul_bonded, each locked to
// a single 5-cost, or two for soul_bonded's Latios/Latias). A lone strong
// 5-cost skews a board's win rate on its own, so treating these as ordinary
// comp-shape signals let that skew get misattributed to whatever OTHER trait
// happened to be on the board — e.g. the trained table showed
// "mystic paired with soul_bonded" at a confident 66% win rate on 291 units
// of evidence, when the real explanation is just "boards with a tanky 5-cost
// win more." Excluded from trait-pair/breadth/depth/unit-context evidence;
// the legendary's own value is still correctly captured elsewhere (per-unit
// contribution credit, catalog matching, the hand-coded legendary bonus).
// Computed from UNIT_MAP (not hardcoded) so a future single-unit trait is
// caught automatically — the next-smallest REAL traits (River, Ascender) have
// 4 carriers each, well clear of this threshold.
const SPLASH_TRAITS: Set<string> = (() => {
  const carriers = new Map<string, Set<string>>()
  for (const def of UNIT_MAP.values()) {
    for (const t of def.types) {
      if (!carriers.has(t)) carriers.set(t, new Set())
      carriers.get(t)!.add(def.id)
    }
  }
  const out = new Set<string>()
  for (const [t, species] of carriers) {
    if (species.size <= 2 && getThresholds(t)[0] === 1) out.add(t)
  }
  return out
})()

// Trait → distinct species count on this board (mirrors bots.ts's traitCounts
// convention: duplicate copies of the same species don't advance a trait).
// Splash traits (see SPLASH_TRAITS) are excluded entirely — they're not a
// buildable comp shape, so they should never occupy a trait-pair/breadth/
// depth/signature slot.
function traitSpeciesCounts(board: BoardUnit[]): Map<string, number> {
  const perTrait = new Map<string, Set<string>>()
  for (const u of board) {
    const def = UNIT_MAP.get(u.definitionId)
    if (!def) continue
    for (const t of def.types) {
      if (SPLASH_TRAITS.has(t)) continue
      if (!perTrait.has(t)) perTrait.set(t, new Set())
      perTrait.get(t)!.add(u.definitionId)
    }
  }
  return new Map([...perTrait.entries()].map(([t, species]) => [t, species.size]))
}

// How many of a trait's own breakpoints a given species-count has crossed
// (0 = not active at all, 1 = first breakpoint, 2 = second, ...). Traits
// activate at different counts (some at 1, most at 2+), so this reads each
// trait's own thresholds rather than assuming a flat bar.
export function traitDepthLevel(trait: string, count: number): number {
  return getThresholds(trait).filter(t => count >= t).length
}

function isActive(trait: string, count: number): boolean {
  return traitDepthLevel(trait, count) > 0
}

// Coarse fingerprint of a board's established trait direction: the top-2
// ACTIVE traits (crossed their own first breakpoint) by species count,
// alphabetized so the key is stable regardless of discovery order. '' if the
// board has no active trait yet.
export function boardTraitSignature(board: BoardUnit[]): string {
  const counts = traitSpeciesCounts(board)
  const ranked = [...counts.entries()]
    .filter(([t, n]) => isActive(t, n))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([t]) => t)
    .sort()
  return ranked.join('+')
}

// Every ACTIVE trait on the board (crossed its own first breakpoint) — used
// for the trait-pair co-occurrence bandit and as the breadth count.
export function establishedTraits(board: BoardUnit[]): string[] {
  const counts = traitSpeciesCounts(board)
  return [...counts.entries()].filter(([t, n]) => isActive(t, n)).map(([t]) => t)
}

// Every active trait on the board with how deep it's been pushed — used for
// the trait-depth bandit ("is going heavy into this one trait paying off").
export function traitDepths(board: BoardUnit[]): Array<{ trait: string; depth: number }> {
  const counts = traitSpeciesCounts(board)
  const out: Array<{ trait: string; depth: number }> = []
  for (const [t, n] of counts) {
    const depth = traitDepthLevel(t, n)
    if (depth > 0) out.push({ trait: t, depth })
  }
  return out
}

export function traitPairKey(stage: number, a: string, b: string): string {
  return `${stage}|${[a, b].sort().join('|')}`
}

export function unitContextKey(stage: number, unitDefId: string, signature: string): string {
  return `${stage}|${unitDefId}|${signature}`
}

export function traitDepthKey(stage: number, trait: string, depth: number): string {
  return `${stage}|${trait}|${depth}`
}

export function breadthKey(stage: number, activeTraitCount: number): string {
  return `${stage}|${activeTraitCount}`
}

// ─── Catalog linking (docs/compositions.json via catalogIndex.ts) ────────────
// "Core units present, any star level" is the agreed match rule — a catalog
// entry counts as matched the moment every one of its core unit ids is owned
// (bench or board), regardless of tier. Only the lightweight generated index
// (id + core unit ids, no prose) is imported here so this stays browser-safe.

export function catalogKey(stage: number, catalogEntryId: string): string {
  return `${stage}|${catalogEntryId}`
}

// Every catalog entry whose full core-unit set is owned right now.
export function matchedCatalogEntries(ownedDefIds: Set<string>): string[] {
  return CATALOG_INDEX.filter(e => e.coreUnitIds.every(id => ownedDefIds.has(id))).map(e => e.id)
}

// Reverse index (unit → the catalog entries that list it as a core unit),
// built once at module load — lets bots.ts's scoreUnit look up "which catalog
// entries does buying this unit touch" in O(entries mentioning this unit)
// instead of scanning all ~800 entries on every call.
const catalogByUnit = new Map<string, typeof CATALOG_INDEX>()
for (const e of CATALOG_INDEX) {
  for (const id of e.coreUnitIds) {
    if (!catalogByUnit.has(id)) catalogByUnit.set(id, [])
    catalogByUnit.get(id)!.push(e)
  }
}
export function catalogEntriesForUnit(defId: string): typeof CATALOG_INDEX {
  return catalogByUnit.get(defId) ?? []
}

// ─── Live breakpoint-reachability (gap analysis) ──────────────────────────────
// Mirrors the static "whole-roster pool" math already baked into
// docs/compositions.json's breakpointPlan entries, computed live against the
// actual shared pool instead of the game's full unit count — this is what lets
// a bot tell "the next breakpoint is still gettable this game" apart from
// "the pool is drained, chasing this further is dead weight."

// How many more copies of TRAIT carriers (any cost, not already owned) are
// still available in the shared pool right now.
export function traitPoolAvailable(trait: string, ownedDefIds: Set<string>, pool: Record<string, number>): number {
  let n = 0
  for (const def of UNIT_MAP.values()) {
    if (ownedDefIds.has(def.id) || !def.types.includes(trait)) continue
    n += pool[def.id] ?? 0
  }
  return n
}

// Is the next breakpoint above the current species count for this trait still
// reachable given what's left in the pool? True (trivially) once every
// breakpoint is already crossed — nothing left to reach.
export function nextBreakpointReachable(trait: string, haveSpecies: number, poolAvailable: number): boolean {
  const next = getThresholds(trait).find(t => t > haveSpecies)
  if (next === undefined) return true
  return haveSpecies + poolAvailable >= next
}

// ─── Opponent trait awareness ──────────────────────────────────────────────────
// How many still-living rivals have each trait ACTIVE right now — a trait 2+
// rivals are already running is genuine pool-contested pressure (every copy
// they hold is a copy you can't get), not just a scoring nicety.
export function rivalTraitContestCounts(rivalBoards: BoardUnit[][]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const board of rivalBoards) {
    for (const t of establishedTraits(board)) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return counts
}
