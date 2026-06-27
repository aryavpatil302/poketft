import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { getNeighbors, isValidHex, hexId, hexDistance } from '../hexGrid'
import { startLeap } from '../systems/movement'

export const BarraskewdaAbility: AbilityHandler = {
  abilityId: 'barraskewda_fishous_rend',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages = [300, 450, 700] as const
    const damage  = damages[tier - 1]

    // Find lowest-HP enemy within 2 hexes (or nearest enemy)
    let target: Unit | null = null
    let bestHp = Infinity
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (hexDistance(unit.hexPos, other.hexPos) > 2) continue
      if (other.currentHp < bestHp) { bestHp = other.currentHp; target = other }
    }
    // Fallback to current target
    if (!target && unit.targetId) {
      target = state.units.get(unit.targetId) ?? null
    }
    if (!target || target.state === 'dead') return

    // Find free adjacent hex to leap to
    const candidates = getNeighbors(target.hexPos).filter(h => {
      if (!isValidHex(h)) return false
      const occ = state.hexOccupancy.get(hexId(h))
      return !occ || occ === unit.id
    })
    if (candidates.length > 0) {
      startLeap(unit, candidates[0], state, 4.0)
      unit.state = 'leaping'
    }

    applyDamage(unit, target, { baseAmount: damage, damageType: 'physical', canCrit: true, abilityId: 'barraskewda_fishous_rend' }, state)

    // Reduce target's max mana (min 30)
    target.maxMana = Math.max(30, target.maxMana - 10)
    target.currentMana = Math.min(target.currentMana, target.maxMana)
  },
}
