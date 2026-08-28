// Pure tier-diff classification shared by the local dispatch path
// (dispatchAction) and the networked path (applyServerSnapshot) in main.ts, so
// a buy and a combine read as different events identically in both modes.

import type { PlayerEcon } from './runState'

export type TierChangeKind = 'spawn' | 'star-up'

export interface TierChange {
  definitionId: string
  tier: number
  kind: TierChangeKind
}

// The highest tier this seat holds of each definitionId, across bench AND
// board. A combine is exactly "some definitionId's highest held tier went
// up", which is derivable from state — unlike buyUnit's CombineResult, which
// applyAction's ActionResult does not carry and a server `snapshot` never
// could.
export function tierComposition(econ: PlayerEcon | undefined): Map<string, number> {
  const composition = new Map<string, number>()
  if (!econ) return composition
  for (const b of econ.bench) {
    if (!b) continue
    composition.set(b.definitionId, Math.max(composition.get(b.definitionId) ?? 0, b.tier))
  }
  for (const e of econ.board) {
    composition.set(e.definitionId, Math.max(composition.get(e.definitionId) ?? 0, e.tier))
  }
  return composition
}

// Pure diff. A change is a spawn only when the previous highest tier was
// absent-or-zero AND the new tier is 1 — a first-ever purchase. Every other
// increase (including an unheld definitionId arriving at tier 2+ via a server
// snapshot) is a star-up, because it can only be the result of a combine.
export function detectTierChanges(
  before: Map<string, number>,
  after: Map<string, number>,
): TierChange[] {
  const changes: TierChange[] = []
  for (const [definitionId, tier] of after) {
    const prevTier = before.get(definitionId) ?? 0
    if (tier <= prevTier) continue
    const kind: TierChangeKind = prevTier === 0 && tier === 1 ? 'spawn' : 'star-up'
    changes.push({ definitionId, tier, kind })
  }
  return changes
}
