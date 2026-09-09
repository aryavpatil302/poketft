import type { CombatState, Unit } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// The +2-instead-of-+1 range bonus is implemented directly inside
// src/core/abilities/aerodactyl.ts's onCast (`unit.range += unit.isShiny ? 2
// : 1`) — Ancient Power's range grant only exists as a once-per-cast branch
// gated behind an "already applied" stackId guard, so there is no
// standalone combat-start hook to attach a range bonus to here. Overriding
// the value at that one existing insertion point avoids stacking a separate
// +1 from this file on top of the ability's own +1 (which the batch plan
// explicitly calls out to avoid — override, don't stack).
//
// Full mana IS a pure combat-start grant, so it lives here.
registerShinyEffect('aerodactyl', {
  id: 'aerodactyl_shiny_ancient_power',
  description: 'Starts combat with full mana; Ancient Power grants +2 range instead of +1.',
  onCombatStart(self: Unit, _state: CombatState): void {
    self.currentMana = self.maxMana
  },
})
