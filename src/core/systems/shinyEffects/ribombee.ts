import { registerShinyEffect } from '../shinyEffects'

// Shiny Ribombee: Category B — Pollen Puff's heal AND damage both scale ×1.5
// for a shiny caster. That multiply happens at the single point both values
// are computed in src/core/abilities/ribombee.ts's onCast; there is no
// combat-start state to grant here. This registration exists purely so the
// species carries a description for shop tooltip surfacing, matching the
// "one file per species" convention used by every shiny effect.
registerShinyEffect('ribombee', {
  id: 'shiny_ribombee',
  description: "Pollen Puff's heal and damage are both increased by 50%.",

  onCombatStart(): void {
    // No-op — see src/core/abilities/ribombee.ts's onCast for the real hook.
  },
})
