import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Tapu Fini is a pure Category-B shiny effect: Whirlpool execute is checked
// at its single hit-resolution site in abilities/tapufini.ts. There is no
// combat-start behavior — this registration exists solely so the effect is
// discoverable via the shop/hover tooltip `description`, matching every
// other registered shiny species.
registerShinyEffect('tapu_fini', {
  id: 'tapu_fini_shiny_whirlpool_execute',
  description: 'Whirlpools execute enemies below 10% Health.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the execute check lives in abilities/tapufini.ts's onHit.
  },
})
