import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Morgrem: at combat start, every living ally (including Morgrem
// itself) gains +5 special defense via the existing `spDefBuff` case.
registerShinyEffect('morgrem', {
  id: 'shiny_morgrem',
  description: 'All allies gain +5 special defense at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'spDefBuff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 5,
        stackId: `shiny_morgrem_spdef_${ally.id}`,
      })
    }
  },
})
