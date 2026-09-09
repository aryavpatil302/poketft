import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import type { Unit, CombatState } from '../../types'

// Shiny Tapu-koko: team-wide +30% attack speed at combat start. Stacks on top
// of the universal +5% shiny stat bonus (which already ran before this fires,
// see shinyEffects.ts's initShinyEffects dispatch order).
const ATK_SPD_MAGNITUDE = 0.30

registerShinyEffect('tapu_koko', {
  id: 'shiny_tapu_koko',
  description: 'Grants all allies +30% Attack Speed.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'atkSpd_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: ATK_SPD_MAGNITUDE,
        stackId: 'shiny_tapu_koko_atkspd',
      })
    }
  },
})
