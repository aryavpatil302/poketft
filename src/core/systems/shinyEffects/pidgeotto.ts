import type { Unit, CombatState } from '../../types'
import { registerShinyEffect, type ShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Pidgeotto: +15 Attack (flat), granted once at combat start. Stacks on
// top of the universal +5% shiny bonus (which already ran before this fires).
export const ShinyPidgeottoEffect: ShinyEffect = {
  id: 'shiny_pidgeotto',
  description: 'Starts combat with +15 Attack.',
  onCombatStart(self: Unit, _state: CombatState): void {
    addStatusEffect(self, {
      id: 'dmg_buff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 15,
      stackId: 'shiny_pidgeotto_atk',
    })
  },
}

registerShinyEffect('pidgeotto', ShinyPidgeottoEffect)
