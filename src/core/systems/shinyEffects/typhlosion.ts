import { registerShinyEffect } from '../shinyEffects'

// Shiny Typhlosion: the actual burn-on-hit is hooked into Eruption's own
// projectile launch in ../../abilities/typhlosion.ts (an `onHit` callback
// added when `unit.isShiny`, checked at cast time — not here). This
// combat-start hook is a pure registration no-op: Typhlosion is Category B
// (a per-cast effect, not a combat-start grant), but every species in the
// registry needs an entry so `initShinyEffects`'s dispatch loop and the shop
// tooltip description have something to read.
registerShinyEffect('typhlosion', {
  id: 'shiny_typhlosion_scorch',
  description: 'Eruption applies a 5-second burn to each enemy hit.',
  onCombatStart(): void {
    // No combat-start action — see typhlosion.ts's onCast for the real effect.
  },
})
