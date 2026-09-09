import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import type { Unit, CombatState } from '../../types'

// Shiny Quagsire: all allies (team-wide, including self) gain +20 Sp. Def
// (spDefBuff), once, at combat start.
registerShinyEffect('quagsire', {
  id: 'shiny_quagsire_spdef_buff',
  description: 'Grants all allies +20 Sp. Defense.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue

      addStatusEffect(ally, {
        id: 'spDefBuff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 20,
        stackId: `shiny_quagsire_spdef_buff_${ally.id}`,
      })
    }
  },
})
