import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Oranguru: self-only. At combat start, fill to full mana (an instant
// cast is available the moment combat allows it) and gain +15% attack speed
// via the existing `atkSpd_buff` case (fractional bonus of current speed).
registerShinyEffect('oranguru', {
  id: 'shiny_oranguru',
  description: 'Starts combat with full Mana and +15% Attack Speed.',
  onCombatStart(self: Unit, _state: CombatState): void {
    self.currentMana = self.maxMana
    addStatusEffect(self, {
      id: 'atkSpd_buff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 0.15,
      stackId: `shiny_oranguru_atkspd_${self.id}`,
    })
  },
})
