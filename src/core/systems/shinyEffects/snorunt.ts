import { registerShinyEffect } from '../shinyEffects'

// Shiny Snorunt: Ice Body's shield is 1.5x as large. Fully expressed at the
// shield's single computation site inside SnorunAbility.onCast
// (../../abilities/snorunt.ts) — there is no separate combat-start grant to
// make here. This registration exists purely so the effect has an id and
// description in the shared registry.
registerShinyEffect('snorunt', {
  id: 'shiny_snorunt_bigger_shield',
  description: 'Its shield is 1.5x as effective.',
  onCombatStart(): void {
    // Intentional no-op — see ../../abilities/snorunt.ts for the effect.
  },
})
