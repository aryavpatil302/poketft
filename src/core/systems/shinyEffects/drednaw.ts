import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import type { Unit, CombatState } from '../../types'

// Shiny Drednaw: all MELEE allies (range <= 1 — no dedicated isMelee field
// exists, range is the correct proxy) gain +10 attack (dmg_buff), once, at
// combat start. Ranged allies are excluded entirely.
registerShinyEffect('drednaw', {
  id: 'shiny_drednaw_melee_buff',
  description: 'All melee allies gain +10 attack.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue
      if (ally.range > 1) continue

      addStatusEffect(ally, {
        id: 'dmg_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 10,
        stackId: `shiny_drednaw_melee_buff_${ally.id}`,
      })
    }
  },
})
