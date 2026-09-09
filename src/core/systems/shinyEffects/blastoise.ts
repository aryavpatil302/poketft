import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Blastoise: self only, +30% attack speed at combat start.
registerShinyEffect('blastoise', {
  id: 'shiny_blastoise',
  description: 'Self: +30% attack speed at combat start.',
  onCombatStart(self: Unit, _state: CombatState): void {
    addStatusEffect(self, {
      id: 'atkSpd_buff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 0.30,
      stackId: 'shiny_blastoise_atkspd',
    })
  },
})
