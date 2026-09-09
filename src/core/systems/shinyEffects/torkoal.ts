import type { Unit } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Torkoal: self +20 armor (defense) at combat start.
registerShinyEffect('torkoal', {
  id: 'shiny_torkoal_iron_shell',
  description: 'Starts combat with +20 Defense.',
  onCombatStart(self: Unit): void {
    addStatusEffect(self, {
      id: 'armorBuff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 20,
      stackId: `shiny_torkoal_armor_${self.id}`,
    })
  },
})
