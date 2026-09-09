import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Graveler: team-wide +5 armor (defense) at combat start.
registerShinyEffect('graveler', {
  id: 'shiny_graveler_iron_hide',
  description: 'Grants the whole team +5 Defense.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'armorBuff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 5,
        stackId: `shiny_graveler_armor_${ally.id}`,
      })
    }
  },
})
