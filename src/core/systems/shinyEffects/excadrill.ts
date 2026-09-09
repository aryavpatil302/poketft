import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Team-wide (including Excadrill itself) crit chance bonus, granted once at
// combat start.
const TEAM_CRIT_CHANCE_BUFF = 0.15

registerShinyEffect('excadrill', {
  id: 'excadrill_shiny_drill_focus',
  description: 'Grants the whole team +15% crit chance at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue

      addStatusEffect(ally, {
        id: 'crit_chance_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: TEAM_CRIT_CHANCE_BUFF,
        stackId: `excadrill_shiny_crit_${self.id}_${ally.id}`,
      })
    }
  },
})
