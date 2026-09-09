import { registerShinyEffect } from '../shinyEffects'

// Klawf's shiny bonus (Anger Shell grants 100% crit chance instead of 50%)
// is entirely a per-cast effect, not a combat-start one — it only matters
// when Anger Shell actually fires, and the crit_chance_buff status effect it
// grants already lives on its own duration timer scoped to that cast. There
// is nothing to grant once, up front, at combat start, so onCombatStart here
// is a no-op; the real branch (`unit.isShiny ? 1.0 : 0.50`) lives inside
// src/core/abilities/klawf.ts's onCast. This registration exists purely so
// Klawf's shiny bonus is discoverable through the registry (e.g. a future
// shop tooltip), matching every other shiny species.
registerShinyEffect('klawf', {
  id: 'klawf_shiny_anger_shell',
  description: 'Anger Shell grants 100% critical strike chance.',
  onCombatStart(): void {
    // No-op — see comment above. Behavior lives in klawf.ts's onCast.
  },
})
