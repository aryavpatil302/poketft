import type { CombatState, Unit } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

const HP_BONUS = 50

// All allies (including Gogoat himself) gain a flat +50 max HP at combat
// start. Direct maxHp/currentHp mutation — same shape the universal +5%
// shiny stat passive already uses in shinyEffects.ts's initShinyEffects.
// This runs AFTER that pass (onCombatStart is dispatched after the universal
// bonus loop), so it composes on top of it rather than replacing it.
registerShinyEffect('gogoat', {
  id: 'gogoat_shiny_grass_pelt',
  description: 'Grants all allies +50 max Health.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      ally.maxHp += HP_BONUS
      ally.currentHp += HP_BONUS
      ally._computedStats = null
    }
  },
})
