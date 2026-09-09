import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Avalugg — this codebase only has the Hisuian variant, definitionId
// 'h_avalugg' (no plain 'avalugg' id exists; confirmed against
// src/data/units.ts before writing this file). Allies sharing Avalugg's
// own row get +15 armor and +15 special defense at combat start. "Allies"
// excludes Avalugg itself — if it's alone in its row this is a clean
// no-op, not a self-buff.
registerShinyEffect('h_avalugg', {
  id: 'shiny_h_avalugg_row_durability',
  description: 'Allies in the same row gain +15 armor and +15 special defense at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.id === self.id) continue
      if (ally.team !== self.team || ally.isDummy) continue
      if (ally.hexPos.row !== self.hexPos.row) continue
      addStatusEffect(ally, {
        id: 'armorBuff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 15,
        stackId: 'h_avalugg_shiny_armor',
      })
      addStatusEffect(ally, {
        id: 'spDefBuff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 15,
        stackId: 'h_avalugg_shiny_spdef',
      })
    }
  },
})
