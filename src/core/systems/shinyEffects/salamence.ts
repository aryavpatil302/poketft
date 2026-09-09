import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import type { Unit, CombatState } from '../../types'

// Shiny Salamence: full mana + 10% durability at combat start.
//
// "Durability" in this codebase = defense + spDefense (Mystic trait's own
// documentation, damage.ts ~line 452-492 / unitFactory.ts). A unified
// "durability %" case already exists in computeStats's status-effect switch:
// `iron_barbs_durability` (unitFactory.ts, fed by ferrothorn.ts) multiplies
// BOTH defense and spDefense by (1 + magnitude) — exactly the general-purpose
// case this effect needs, so it's reused here directly rather than adding a
// new status id or approximating with separate armorBuff/spDefBuff grants.
const DURABILITY_PCT = 0.10

registerShinyEffect('salamence', {
  id: 'shiny_salamence',
  description: 'Starts combat with full Mana and +10% durability.',
  onCombatStart(self: Unit, _state: CombatState): void {
    self.currentMana = self.maxMana
    addStatusEffect(self, {
      id: 'iron_barbs_durability',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: DURABILITY_PCT,
      stackId: 'shiny_salamence_durability',
    })
  },
})
