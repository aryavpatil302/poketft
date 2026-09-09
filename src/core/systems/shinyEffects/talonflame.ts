import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Talonflame is a pure Category-B shiny effect: Brave Bird's kill-heal is
// applied at its single kill-check site in abilities/talonflame.ts. There
// is no combat-start behavior — this registration exists solely so the
// effect is discoverable via the shop/hover tooltip `description`, matching
// every other registered shiny species.
registerShinyEffect('talonflame', {
  id: 'talonflame_shiny_brave_bird_heal',
  description: "Heals for 75% of the damage dealt if Brave Bird kills its target.",
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the kill-heal lives in abilities/talonflame.ts's onHit.
  },
})
