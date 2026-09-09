import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Runerigus is a pure Category-B shiny effect: Wandering Spirit's mana
// drain is set to a full drain instead of a half drain at its single
// resolution site in the shared combat engine file systems/ability.ts —
// not an ability file, unlike most other Category-B shiny effects. There
// is no combat-start behavior — this registration exists solely so the
// effect is discoverable via the shop/hover tooltip `description`,
// matching every other registered shiny species.
registerShinyEffect('runerigus', {
  id: 'runerigus_shiny_full_mana_drain',
  description: 'Enemies affected by Wandering Spirit lose all their Mana when they cast, instead of half.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the full drain lives in systems/ability.ts's cast handling.
  },
})
