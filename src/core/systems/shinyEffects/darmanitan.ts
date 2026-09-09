import { registerShinyEffect } from '../shinyEffects'
import type { Unit, CombatState } from '../../types'

// Shiny Darmanitan: Flare Blitz splits 50% of each hit's damage into true
// damage (bypasses mitigation) instead of dealing it all as physical.
//
// This is a Category B effect — the real behavior lives entirely inside the
// existing `blitzNext` hit callback in `../../abilities/darmanitan.ts`
// (gated on `unit.isShiny`), because it modifies a specific cast's damage
// split, not combat-start state. There is nothing to DO at combat start.
//
// This registry entry is a no-op `onCombatStart` that exists solely so
// Darmanitan gets a `description` in SHINY_EFFECT_REGISTRY — matching the
// "one file per species, one registerShinyEffect call" convention used by
// every other shiny species, and future-proofing a shop-tooltip surface
// that reads this registry (see shinyEffects.ts's ShinyEffect.description
// comment) without needing a special case for ability-hook-only effects.
registerShinyEffect('darmanitan', {
  id: 'shiny_darmanitan',
  description: 'Flare Blitz: 50% of each hit\'s damage is dealt as true damage instead of physical.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // Intentional no-op — see file comment above.
  },
})
