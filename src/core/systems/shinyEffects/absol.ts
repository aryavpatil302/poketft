import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Absol is a pure Category-B shiny effect: each real dash grants a
// permanent Attack stack at its single dash-resolution branch in
// abilities/absol.ts. There is no combat-start behavior — this
// registration exists solely so the effect is discoverable via the
// shop/hover tooltip `description`, matching every other registered shiny
// species.
registerShinyEffect('absol', {
  id: 'absol_shiny_dash_stacking',
  description: 'Gains +10 Attack for the rest of combat each time it dashes.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the stacking lives in abilities/absol.ts's dash branch.
  },
})
