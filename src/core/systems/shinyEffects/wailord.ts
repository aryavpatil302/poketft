import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Wailord is a pure Category-B shiny effect: bounce damage is tripled at
// its single damage-computation site in abilities/wailord.ts. There is no
// combat-start behavior — this registration exists solely so the effect is
// discoverable via the shop/hover tooltip `description`, matching every
// other registered shiny species.
registerShinyEffect('wailord', {
  id: 'wailord_shiny_triple_bounce',
  description: 'Bounce damage is tripled.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the tripling lives in abilities/wailord.ts's damage calc.
  },
})
