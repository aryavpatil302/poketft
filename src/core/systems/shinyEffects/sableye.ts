import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Sableye's shiny effect is a pure Category-B hook: each cast has a 30%
// chance to grant the caster's team 1 gold, rolled and granted directly in
// abilities/sableye.ts's onCast via grantShinyGold (the wave-1 plumbing).
// There is no combat-start behavior — this registration exists solely so the
// effect is discoverable via the shop tooltip `description`, matching every
// other registered shiny species.
registerShinyEffect('sableye', {
  id: 'sableye_shiny_prospector',
  description: 'Each cast has a 30% chance to grant 1 Gold.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the gold roll lives in abilities/sableye.ts's onCast.
  },
})
