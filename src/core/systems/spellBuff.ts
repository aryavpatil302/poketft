import type { Unit, CombatState } from '../types'

// Beachy trait: each Beachy unit gains stacks whenever any Beachy ally casts.
// The per-cast increment depends on the active threshold: 2/4/6 species → +1/+2/+3.
// Dead units do not count toward the species threshold.
//
// This needs a LIVE recount every cast (unlike every other trait's one-time
// combat-start check via traitEffects.ts's traitMemberCount), since a species
// dying mid-fight must stop counting — so it can't just call that helper and
// re-implements the same species-counting here instead. It must still honor
// the same shiny Chosen bonus traitMemberCount does, though (a living shiny
// unit's chosenTrait counts as +1 EXTRA toward that one trait, on top of its
// own normal species membership — see traitMemberCount's own comment) or a
// team relying on a shiny Chosen-Beachy unit to cross a threshold shows
// "Beachy: active" in the sidebar and gets the HP bonus while spell-buff
// stacks silently never accrue, since this count alone stays below it.
function activeBeachyIncrement(unit: Unit, state: CombatState): number {
  const teamUnits = [...state.units.values()]
    .filter(u => u.team === unit.team && !u.isDummy && u.state !== 'dead')
  const species = new Set(teamUnits.filter(u => u.types.includes('beachy')).map(u => u.definitionId))
  let n = species.size
  for (const u of teamUnits) {
    if (u.isShiny && u.chosenTrait === 'beachy') n += 1
  }
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
