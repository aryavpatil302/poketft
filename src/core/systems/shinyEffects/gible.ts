import { registerShinyEffect } from '../shinyEffects'

// Shiny Gible: the actual durability-reduction stack is hooked into Bite's
// landing callback in ../../abilities/gible.ts (an `unit.isShiny` branch
// added right after the existing applyDamage call, not here). This
// combat-start hook is a pure registration no-op: Gible is Category B (a
// per-cast effect, not a combat-start grant), but every species in the
// registry needs an entry so `initShinyEffects`'s dispatch loop and the shop
// tooltip description have something to read.
registerShinyEffect('gible', {
  id: 'shiny_gible_crushing_jaws',
  description: "Bite reduces the target's durability (Defense and Sp. Defense) by 5%.",
  onCombatStart(): void {
    // No combat-start action — see gible.ts's onCast for the real effect.
  },
})
