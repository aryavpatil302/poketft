import type { Unit, CombatState } from '../types'

// Beachy trait: each Beachy unit gains stacks whenever any Beachy ally casts.
// The stack count amplifies ability power for spellBuff-scaled abilities.

export function getSpellBuff(unit: Unit, state: CombatState): number {
  return state.spellBuffCounters.get(unit.id) ?? 0
}

export function incrementSpellBuff(unit: Unit, state: CombatState): void {
  // Increment for all allies sharing the Beachy trait
  for (const other of state.units.values()) {
    if (other.state === 'dead') continue
    if (other.team !== unit.team) continue
    if (!other.traits.includes('beachy')) continue
    const cur = state.spellBuffCounters.get(other.id) ?? 0
    state.spellBuffCounters.set(other.id, cur + 1)
  }
}
