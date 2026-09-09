import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Alolan Marowak: team-wide +20 attack at combat start.
registerShinyEffect('a_marowak', {
  id: 'shiny_a_marowak_bone_rally',
  description: 'Grants all allies +20 Attack.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'dmg_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 20,
        stackId: `shiny_a_marowak_atk_${ally.id}`,
      })
    }
  },
})
