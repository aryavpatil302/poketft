import type { Unit, CombatState } from '../../types'
import { registerShinyEffect, type ShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Noivern: all allies (including Noivern itself) gain +20 Special,
// granted once at combat start — same team-wide filter shape as the
// Promoter aura loop (traitEffects.ts): iterate state.units, keep same-team,
// non-dummy. Nothing is dead at combat start, so no state !== 'dead' check.
export const ShinyNoivernEffect: ShinyEffect = {
  id: 'shiny_noivern',
  description: 'All allies gain +20 Special at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'sp_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 20,
        stackId: `shiny_noivern_sp_${ally.id}`,
      })
    }
  },
}

registerShinyEffect('noivern', ShinyNoivernEffect)
