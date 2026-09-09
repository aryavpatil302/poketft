import type { Unit, CombatState } from '../../types'
import { registerShinyEffect, type ShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Rayquaza: self full mana + a permanent (for-this-fight) +10% damage
// amp, granted once at combat start. The damage amp reuses the existing
// 'damage_amp' status id already read by applyDamage (see damage.ts, and
// Crashout's team amp in traitEffects.ts for the same status shape) — no new
// mechanism needed.
export const ShinyRayquazaEffect: ShinyEffect = {
  id: 'shiny_rayquaza',
  description: 'Full mana and +10% damage amp at combat start.',
  onCombatStart(self: Unit, _state: CombatState): void {
    self.currentMana = self.maxMana
    addStatusEffect(self, {
      id: 'damage_amp',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 0.10,
      stackId: 'shiny_rayquaza_amp',
    })
  },
}

registerShinyEffect('rayquaza', ShinyRayquazaEffect)
