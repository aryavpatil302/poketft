import { registerShinyEffect } from '../shinyEffects'

// Shiny Vikavolt: Category B — Discharge deals +33% bonus damage to the
// unit with the highest current HP in the targeted row, for a shiny caster.
// That branch lives in the existing per-target damage loop in
// src/core/abilities/vikavolt.ts's onCast; there is no combat-start state to
// grant here. This registration exists purely so the species carries a
// description for shop tooltip surfacing, matching the "one file per
// species" convention used by every shiny effect.
registerShinyEffect('vikavolt', {
  id: 'shiny_vikavolt',
  description: "Discharge deals 33% bonus damage to the highest-HP unit in the targeted row.",

  onCombatStart(): void {
    // No-op — see src/core/abilities/vikavolt.ts's onCast for the real hook.
  },
})
