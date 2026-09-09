import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Zubat is a pure Category-B shiny effect: Poison Sting's poisonPerTick is
// doubled at its single computation site in abilities/zubat.ts (one-line
// multiply, no branch inside the projectile's onHit/tickEffect closures).
// There is no combat-start behavior — this registration exists solely so the
// effect is discoverable via the shop tooltip `description`, matching every
// other registered shiny species.
registerShinyEffect('zubat', {
  id: 'zubat_shiny_toxic_fangs',
  description: 'Poison damage is doubled.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the doubling lives in abilities/zubat.ts's onCast.
  },
})
