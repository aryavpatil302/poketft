import { registerShinyEffect } from '../shinyEffects'

// Shiny Abomasnow: Blizzard's initial burst deals 1.3x damage, and every
// target hit by the burst is also burned for the blizzard's duration.
// Fully expressed inside AbomasnowAbility.onCast
// (../../abilities/abomasnow.ts) — there is no separate combat-start grant
// to make here.
registerShinyEffect('abomasnow', {
  id: 'shiny_abomasnow_burst_and_burn',
  description: "Blizzard's initial damage is 1.3x as effective and applies burn to affected enemies for the duration.",
  onCombatStart(): void {
    // Intentional no-op — see ../../abilities/abomasnow.ts for the effect.
  },
})
