import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

const MAMOSWINE_HP_BONUS = 150

// Shiny Mamoswine: whole team gains +150 max HP at combat start, mutating
// the stored maxHp/currentHp fields directly — same direct-field-mutation
// shape the universal +5% shiny stat bonus already uses
// (initShinyEffects, ../shinyEffects.ts), which runs immediately before
// this per-species hook.
registerShinyEffect('mamoswine', {
  id: 'shiny_mamoswine_team_hp',
  description: 'Team-wide +150 max HP at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      ally.maxHp += MAMOSWINE_HP_BONUS
      ally.currentHp += MAMOSWINE_HP_BONUS
      ally._computedStats = null
    }
  },
})
