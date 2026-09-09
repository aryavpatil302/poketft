import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Ferrothorn is a pure Category-B shiny effect: Iron Barbs retaliation
// self-heal is applied at its single retaliation-resolution site in the
// shared combat engine file systems/damage.ts — not an ability file, unlike
// most other Category-B shiny effects. There is no combat-start behavior —
// this registration exists solely so the effect is discoverable via the
// shop/hover tooltip `description`, matching every other registered shiny
// species.
registerShinyEffect('ferrothorn', {
  id: 'ferrothorn_shiny_iron_barbs_heal',
  description: "Heals for 100% of the damage an enemy takes from Iron Barbs.",
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the heal lives in systems/damage.ts's retaliation handling.
  },
})
