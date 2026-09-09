import { registerShinyEffect } from '../shinyEffects'
import type { Unit, CombatState } from '../../types'

// Shiny Bellibolt: self +300 max HP at combat start. Mutates maxHp/currentHp
// directly on the stored base fields — same style as the universal +5%
// shiny bonus in shinyEffects.ts, which has already run by the time this
// fires, so this composes on top of it rather than replacing it.
registerShinyEffect('bellibolt', {
  id: 'shiny_bellibolt_max_hp',
  description: 'Starts combat with +300 max Health.',
  onCombatStart(self: Unit, _state: CombatState): void {
    self.maxHp += 300
    // Assign (not add) from the new maxHp — mirrors the universal +5% bonus's
    // own assignment style and guarantees full health regardless of any
    // prior currentHp state, rather than assuming currentHp already equals
    // the old maxHp.
    self.currentHp = self.maxHp
    self._computedStats = null
  },
})
