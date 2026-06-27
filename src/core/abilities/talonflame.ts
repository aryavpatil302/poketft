import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { findNearestEnemies } from '../systems/targeting'
import { startLeap } from '../systems/movement'
import { hexId, getNeighbors, isValidHex, hexDistance } from '../hexGrid'

const LEAP_HASTE = 5.0

export const TalonflameAbility: AbilityHandler = {
  abilityId: 'talonflame_brave_bird',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages = [300, 450, 700] as const
    diveAt(unit, state, tier, damages[tier - 1], 1.0)
  },
}

function diveAt(unit: Unit, state: CombatState, tier: number, damage: number, multiplier: number): void {
  const [target] = findNearestEnemies(unit, state, 1)
  if (!target) return

  // Find a free adjacent hex next to the target to land on
  const candidates = getNeighbors(target.hexPos).filter(h => {
    if (!isValidHex(h)) return false
    const occupant = state.hexOccupancy.get(hexId(h))
    return !occupant || occupant === unit.id
  })
  candidates.sort((a, b) => hexDistance(a, unit.hexPos) - hexDistance(b, unit.hexPos))

  const dest = candidates[0]
  if (dest) {
    startLeap(unit, dest, state, LEAP_HASTE)
    unit.targetId = target.id
    unit.state = 'leaping'
  }

  const result = applyDamage(unit, target, {
    baseAmount: Math.round(damage * multiplier),
    damageType: 'physical',
    canCrit: true,
    abilityId: 'talonflame_brave_bird',
  }, state)

  // Recast at 75% damage if target died
  if (target.state === 'dead' && multiplier > 0.3) {
    diveAt(unit, state, tier, damage, multiplier * 0.75)
  }
}
