import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Barraskewda is a pure Category-B shiny effect: Fishous Rend's
// armorPiercePct is set at its single applyDamage call in
// abilities/barraskewda.ts. There is no combat-start behavior — this
// registration exists solely so the effect is discoverable via the
// shop/hover tooltip `description`, matching every other registered shiny
// species.
registerShinyEffect('barraskewda', {
  id: 'barraskewda_shiny_fishous_rend_pierce',
  description: "Fishous Rend ignores 30% of the target's Defense.",
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the armor pierce lives in abilities/barraskewda.ts's onHit.
  },
})
