import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Kingler: every living ally gains +5 flat attack (dmg_buff) at combat
// start. Team-wide filter mirrors the Promoter aura shape (traitEffects.ts
// ~1160): u.team === self.team && !u.isDummy — nothing is dead yet at
// combat start, so isDummy is the only exclusion that matters here.
registerShinyEffect('kingler', {
  id: 'shiny_kingler',
  description: 'All allies gain +5 attack.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'dmg_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 5,
        // Per-ally stackId: multiple shiny Kinglers on the same team would
        // otherwise collide on a shared stackId and only the last write wins.
        stackId: `shiny_kingler_${ally.id}`,
      })
    }
  },
})
