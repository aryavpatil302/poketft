import type { Unit } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Shiny Charizard: 30 less max mana, baked into the unit directly (not a
// status effect — there's no "reduce maxMana" computeStats case, and this is
// a permanent-for-the-fight structural change, not a buff/debuff that should
// ever expire or refresh).
//
// Clamp choice: floor the new maxMana at 0. `UnitBaseStats.startMana` only
// exists on the static definition (it seeds `currentMana` once at unit
// creation in unitFactory.ts) — the live `Unit` object has no `startMana`
// field to clamp against, so 0 is the only floor available at this hook.
// currentMana is separately clamped down to the new maxMana below, which is
// the invariant that actually matters (a unit should never read as having
// more current mana than its cap allows). For Charizard's own numbers today
// (80 max, 50 start) this reduction lands at exactly 50, well above 0, so
// the floor is a no-op in practice; it exists for safety against future
// rebalancing that might drop maxMana below 30.
const MANA_REDUCTION = 30

registerShinyEffect('charizard', {
  id: 'shiny_charizard_smaller_flame',
  description: 'Shiny: Charizard has 30 less max mana.',
  onCombatStart(self: Unit): void {
    self.maxMana = Math.max(0, self.maxMana - MANA_REDUCTION)
    if (self.currentMana > self.maxMana) self.currentMana = self.maxMana
  },
})
