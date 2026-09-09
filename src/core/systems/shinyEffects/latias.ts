import { registerShinyEffect } from '../shinyEffects'
import type { Unit, CombatState } from '../../types'

// Shiny Latias: self spDefense *= 1.5, same direct-field-mutation shape as
// Latios's special multiplier (see latios.ts for the full rationale on why
// this is a direct multiply of whatever the field already holds, applied
// after the universal +5% shiny bonus, not a re-derivation).
const SPDEF_MULT = 1.5

registerShinyEffect('latias', {
  id: 'shiny_latias',
  description: 'Gains 1.5x base Sp. Defense.',
  onCombatStart(self: Unit, _state: CombatState): void {
    self.spDefense = Math.round(self.spDefense * SPDEF_MULT)
    self._computedStats = null
  },
})
