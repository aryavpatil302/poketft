import type { Unit } from '../core/types'
import { UNIT_MAP } from '../data/units'
import { TRAIT_MAP } from '../data/traits'

export interface TraitActivity {
  trait: string
  count: number
  thresholdLevel: number
  contributingPower: number
}

export interface BoardProfile {
  power: number
  unitCount: number
  tankCount: number
  carryCount: number
  hasFiveCost: boolean
  fiveCostTiers: Array<{ id: string; tier: 1|2|3 }>
  activeTraits: TraitActivity[]
  // Raw (un-weighted) components for the calibration layer:
  basePower: number    // Σ unitPowerScore — same units as `power` but without trait bonus
  traitRaw: number     // Σ thresholdLevel × contributingPower (WITHOUT the 0.15 weight)
  tier3Power: number   // Σ unitPowerScore over tier-3 units only
  cost3Count: number   // number of cost-3 units on the board
}

// Learnable weights over the raw profile components. The priors reproduce the
// hand-tuned constants exactly: trait bonus 0.15/level, tier-3 surcharge 0.30,
// quadratic cost-3 stacking penalty.
export interface PowerWeights {
  trait: number
  tier3: number
  cost3: number
}

export const PRIOR_WEIGHTS: PowerWeights = { trait: 0.15, tier3: 0.30, cost3: 1.0 }

// Board power under a specific weight vector. With PRIOR_WEIGHTS this equals
// exactly what generator.ts's clampToTarget historically computed:
//   profile.power + tier3Surplus(0.30) + cost3Count²
export function calibratedPower(profile: BoardProfile, w: PowerWeights = PRIOR_WEIGHTS): number {
  return profile.basePower
    + w.trait * profile.traitRaw
    + w.tier3 * profile.tier3Power
    + w.cost3 * profile.cost3Count * profile.cost3Count
}

// Fallback thresholds for traits not yet in TRAIT_MAP
const FALLBACK_THRESHOLDS: Record<string, number[]> = {
  volcanic:       [3, 5, 7],
  sky_striker:    [2, 4],
  cave_crawler:   [3, 5],
  river:          [2, 3, 4],
  temporal_woods: [2, 4, 6],
  ruiner:         [3, 5, 7],
  ascender:       [2, 4],
  froststone:     [2, 4, 6],
  spellweaver:    [2, 4],
  quickclaw:      [2, 4],
  crashout:       [2, 4],
  corkscrew:      [2, 4],
  substitutor:    [2, 4],
  mystic:         [2, 4],
  'keen eye':     [2, 4],
}

export function getThresholds(trait: string): number[] {
  const def = TRAIT_MAP.get(trait)
  if (def) return def.thresholds.map(t => t.count)
  return FALLBACK_THRESHOLDS[trait] ?? [2, 4, 6]
}

function thresholdLevel(trait: string, count: number): number {
  return getThresholds(trait).filter(t => count >= t).length
}

// Power score: 2^(cost-1) * 3^(tier-1)
// Tier multipliers mirror the upgrade curve: 3× tier-1 = tier-2, 3× tier-2 = tier-3.
// cost1/t1=1, cost1/t2=3, cost1/t3=9
// cost3/t1=4, cost3/t2=12, cost3/t3=36
// cost5/t1=16, cost5/t2=48→72, cost5/t3=144
// 5-cost tier-2 gets a 1.5× bonus: they disproportionately swing fights when
// combined with supporting traits, so the budget should reflect that impact.
export function unitPowerScore(cost: number, tier: 1|2|3): number {
  const base = Math.pow(2, cost - 1) * Math.pow(3, tier - 1)
  return (cost === 5 && tier === 2) ? base * 1.5 : base
}

export function calcBoardProfile(playerUnits: Unit[]): BoardProfile {
  const realUnits = playerUnits.filter(u => !u.isDummy)

  const traitData = new Map<string, { species: Set<string>; power: number }>()
  let totalBasePower = 0
  let tankCount = 0
  let carryCount = 0
  let hasFiveCost = false
  let tier3Power = 0
  let cost3Count = 0
  const fiveCostTiers: Array<{ id: string; tier: 1|2|3 }> = []
  const seenDefs = new Set<string>()

  for (const unit of realUnits) {
    const def = UNIT_MAP.get(unit.definitionId)
    if (!def || def.isDummy) continue

    const tier = unit.tier as 1|2|3
    const up = unitPowerScore(def.cost, tier)
    totalBasePower += up
    if (tier === 3) tier3Power += up
    if (def.cost === 3) cost3Count++

    if (def.cost === 5) {
      hasFiveCost = true
      fiveCostTiers.push({ id: def.id, tier })
    }

    if (def.role === 'tank') tankCount++
    else carryCount++

    // Count unique species per trait (duplicate unit placements don't stack)
    if (!seenDefs.has(unit.definitionId)) {
      seenDefs.add(unit.definitionId)
      for (const trait of def.types) {
        let entry = traitData.get(trait)
        if (!entry) { entry = { species: new Set(), power: 0 }; traitData.set(trait, entry) }
        if (!entry.species.has(unit.definitionId)) {
          entry.species.add(unit.definitionId)
          entry.power += up
        }
      }
    }
  }

  const activeTraits: TraitActivity[] = []
  let traitRaw = 0

  for (const [trait, { species, power }] of traitData) {
    const level = thresholdLevel(trait, species.size)
    activeTraits.push({ trait, count: species.size, thresholdLevel: level, contributingPower: power })
    if (level > 0) traitRaw += level * power
  }

  return {
    power: totalBasePower + PRIOR_WEIGHTS.trait * traitRaw,
    unitCount: realUnits.length,
    tankCount,
    carryCount,
    hasFiveCost,
    fiveCostTiers,
    activeTraits,
    basePower: totalBasePower,
    traitRaw,
    tier3Power,
    cost3Count,
  }
}
