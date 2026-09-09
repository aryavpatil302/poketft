import { registerShinyEffect } from '../shinyEffects'
import type { Unit, CombatState } from '../../types'

// Shiny Latios: self special *= 1.5, mutating the stored base field directly —
// same style as the universal +5% shiny bonus in shinyEffects.ts. Per-species
// onCombatStart fires AFTER that universal pass, so this naturally multiplies
// whatever `special` already holds post-+5%; we deliberately don't re-derive
// the field from scratch to avoid double-counting the universal bonus.
const SPECIAL_MULT = 1.5

registerShinyEffect('latios', {
  id: 'shiny_latios',
  description: 'Self special ×1.5 at combat start.',
  onCombatStart(self: Unit, _state: CombatState): void {
    self.special = Math.round(self.special * SPECIAL_MULT)
    self._computedStats = null
  },
})
