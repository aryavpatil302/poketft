import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Flat attack bonus granted to every OTHER living ally sharing Druddigon's row.
const ROW_DMG_BUFF = 10

registerShinyEffect('druddigon', {
  id: 'druddigon_shiny_dragon_ranks',
  description: 'Allies in the same row gain +10 attack.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue
      if (ally.id === self.id) continue
      if (ally.hexPos.row !== self.hexPos.row) continue

      addStatusEffect(ally, {
        id: 'dmg_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: ROW_DMG_BUFF,
        stackId: `druddigon_shiny_row_${self.id}_${ally.id}`,
      })
    }
    // Edge case: Druddigon alone in its row (no other allies share it) — the
    // loop above simply finds no matches and no-ops cleanly, no throw.
  },
})
