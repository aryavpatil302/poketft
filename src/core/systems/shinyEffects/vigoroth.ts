import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Vigoroth: every living ally gets +10% attack speed at combat start.
const ATK_SPD_BONUS = 0.10

registerShinyEffect('vigoroth', {
  id: 'shiny_vigoroth',
  description: 'Grants all allies +10% Attack Speed at the start of combat.',

  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue

      addStatusEffect(ally, {
        id: 'atkSpd_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: ATK_SPD_BONUS,
        stackId: `shiny_vigoroth_atkspd_${ally.id}`,
      })
    }
  },
})
