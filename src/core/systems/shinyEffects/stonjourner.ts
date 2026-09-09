import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import { getNeighbors, hexId } from '../../hexGrid'

// Shiny Stonjourner: allies adjacent to self (getNeighbors(self.hexPos))
// gain +5 armor and +5 special defense at combat start. Edge case: a
// Stonjourner with 0 adjacent allies (board edge / alone) must no-op
// cleanly — the loop below simply does nothing when no neighbor hex holds
// a living ally.
registerShinyEffect('stonjourner', {
  id: 'shiny_stonjourner_bulwark',
  description: 'Grants adjacent allies +5 Defense and +5 Sp. Defense.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const hex of getNeighbors(self.hexPos)) {
      const uid = state.hexOccupancy.get(hexId(hex))
      if (!uid) continue
      const ally = state.units.get(uid)
      if (!ally || ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue

      addStatusEffect(ally, {
        id: 'armorBuff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 5,
        stackId: `shiny_stonjourner_armor_${ally.id}`,
      })
      addStatusEffect(ally, {
        id: 'spDefBuff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 5,
        stackId: `shiny_stonjourner_spdef_${ally.id}`,
      })
    }
  },
})
