import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addShield } from '../shield'
import { getNeighbors, hexId } from '../../hexGrid'

// Shiny Xatu: allies adjacent to self (getNeighbors(self.hexPos)) each gain
// a 100 HP shield at combat start. Same edge-case note as Stonjourner: 0
// adjacent allies must no-op cleanly, not throw.
registerShinyEffect('xatu', {
  id: 'shiny_xatu_future_sight',
  description: 'Grants adjacent allies a 100-Health shield at the start of combat.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const hex of getNeighbors(self.hexPos)) {
      const uid = state.hexOccupancy.get(hexId(hex))
      if (!uid) continue
      const ally = state.units.get(uid)
      if (!ally || ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue

      addShield(ally, {
        id: `shiny_xatu_shield_${ally.id}`,
        sourceAbility: 'shiny_xatu_future_sight',
        sourceUnitId: self.id,
        value: 100,
        maxValue: 100,
        durationTicks: -1,
      }, state)
    }
  },
})
