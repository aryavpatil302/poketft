import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// A-Exeggutor is a pure Category-B shiny effect: the egg bounces one extra
// time (at 25% damage) at its bounce-chaining logic in
// abilities/a_exeggutor.ts. There is no combat-start behavior — this
// registration exists solely so the effect is discoverable via the
// shop/hover tooltip `description`, matching every other registered shiny
// species.
registerShinyEffect('a_exeggutor', {
  id: 'a_exeggutor_shiny_extra_bounce',
  description: 'The egg bounces one extra time, dealing 25% damage on the extra bounce.',
  onCombatStart(_self: Unit, _state: CombatState): void {
    // No-op — the extra bounce lives in abilities/a_exeggutor.ts's cast chain.
  },
})
