import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyHeal } from '../systems/heal'
import { hexDistance } from '../hexGrid'

function findNearestAlly(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.id === unit.id || other.team !== unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

export const StonjournerAbility: AbilityHandler = {
  abilityId: 'stonjourner_power_spot',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const healValues     = [150, 225, 350] as const
    const stealPctValues = [0.10, 0.15, 0.25] as const

    const healAmt   = healValues[tier - 1]
    const stealPct  = stealPctValues[tier - 1]

    // Heal self
    applyHeal(unit, healAmt, unit.id, state)

    // Find nearest ally and steal a % of their defense and spDefense
    const ally = findNearestAlly(unit, state)
    if (!ally) return

    const stolenDef   = Math.floor(ally.defense   * stealPct)
    const stolenSpDef = Math.floor(ally.spDefense  * stealPct)

    // Remove from ally, add to self as permanent buff
    ally.defense   = Math.max(0, ally.defense   - stolenDef)
    ally.spDefense = Math.max(0, ally.spDefense - stolenSpDef)
    ally._computedStats = null

    unit.defense   += stolenDef
    unit.spDefense += stolenSpDef
    unit._computedStats = null

    console.log(
      `[stonjourner] ${unit.id} stole ${stolenDef} armor and ${stolenSpDef} spDef from ${ally.id} ` +
      `(${Math.round(stealPct * 100)}% steal)`
    )
  },
}
