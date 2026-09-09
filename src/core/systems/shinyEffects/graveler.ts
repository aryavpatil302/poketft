import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Graveler: team-wide +5 armor (defense) at combat start.
registerShinyEffect('graveler', {
  id: 'shiny_graveler_iron_hide',
  description: 'Shiny: your whole team gains +5 armor at the start of combat.',
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
