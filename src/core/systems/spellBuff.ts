import type { Unit, CombatState } from '../types'

// Beachy trait: each Beachy unit gains stacks whenever any Beachy ally casts.
// The per-cast increment depends on the active threshold: 2/4/6 species → +1/+2/+3.
// Dead units do not count toward the species threshold.

function activeBeachyIncrement(unit: Unit, state: CombatState): number {
  const species = new Set(
    [...state.units.values()]
      .filter(u => u.team === unit.team && !u.isDummy && u.state !== 'dead' && u.types.includes('beachy'))
      .map(u => u.definitionId)
  )
  const n = species.size
  if (n >= 6) return 3
  if (n >= 4) return 2
  if (n >= 2) return 1
  return 0  // threshold not met — trait inactive
}

export function getSpellBuff(unit: Unit, state: CombatState): number {
  return state.spellBuffCounters.get(unit.id) ?? 0
}

export function incrementSpellBuff(unit: Unit, state: CombatState): void {
  const inc = activeBeachyIncrement(unit, state)
  if (inc === 0) return
  for (const other of state.units.values()) {
    if (other.state === 'dead') continue
    if (other.team !== unit.team) continue
    if (!other.types.includes('beachy')) continue
    const cur = state.spellBuffCounters.get(other.id) ?? 0
    state.spellBuffCounters.set(other.id, cur + inc)
  }
}
