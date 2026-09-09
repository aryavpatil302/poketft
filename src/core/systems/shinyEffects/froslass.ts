import { registerShinyEffect } from '../shinyEffects'

// Shiny Froslass: Icy Wind splits 10% of the damage dealt to the
// first/nearest target in the line into true damage (the remaining 90%
// stays magic). Fully expressed inside spawnWind's onTick
// (../../abilities/froslass.ts) — there is no separate combat-start grant
// to make here.
registerShinyEffect('froslass', {
  id: 'shiny_froslass_true_damage_split',
  description: 'Icy Wind deals 10% of its damage to the first target hit as true damage.',
  onCombatStart(): void {
    // Intentional no-op — see ../../abilities/froslass.ts for the effect.
  },
})
