import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Morelull: at combat start, every living ally (including Morelull
// itself) gains +5 flat special — the `sp_buff` computeStats case, the
// special-stat sibling of the existing flat-attack `dmg_buff` case.
registerShinyEffect('morelull', {
  id: 'shiny_morelull',
  description: 'Grants all allies +5 Special Attack.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'sp_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 5,
        stackId: `shiny_morelull_sp_${ally.id}`,
      })
    }
  },
})
