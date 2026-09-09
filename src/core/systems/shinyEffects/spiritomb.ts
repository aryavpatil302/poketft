import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Spiritomb is a pure Category-B shiny effect: Destiny Bond's aura damage
// and healing are amplified at their single computation site in
// abilities/spiritomb.ts. There is no combat-start behavior — this
// registration exists solely so the effect is discoverable via the
// shop/hover tooltip `description`, matching every other registered shiny
// species.
registerShinyEffect('spiritomb', {
  id: 'spiritomb_shiny_destiny_bond_amp',
  description: "Amplifies Destiny Bond's aura damage and healing by 1.5x.",
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the amplification lives in abilities/spiritomb.ts's aura tick.
  },
})
