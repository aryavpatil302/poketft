import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny A-Raichu: every living ally gains +10 flat special at combat start.
//
// Case reuse: unitFactory.ts's computeStats switch already has a flat
// special-buff case — 'oranguru_sp_buff' (`special += mag`, no trait credit
// attached). It was introduced for Oranguru's own ability but the id's
// underlying arithmetic is generic (a plain flat add), so this effect reuses
// it directly rather than adding a near-duplicate case to unitFactory.ts.
// Reusing the id is safe: dedup/collision is keyed by `stackId`, not `id`,
// so an Oranguru aura and this shiny buff on the same unit stack additively
// as two separate status-effect entries, each read independently by the
// switch on `id`.
registerShinyEffect('a_raichu', {
  id: 'shiny_a_raichu',
  description: 'Grants all allies +10 Special Attack.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'oranguru_sp_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 10,
        stackId: `shiny_a_raichu_${ally.id}`,
      })
    }
  },
})
