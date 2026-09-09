import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Shiny Tropius: every living ally gets +100 max HP at combat start.
// Same mutation shape as Venusaur, without the row filter (team-wide).
const BONUS_HP = 100

registerShinyEffect('tropius', {
  id: 'shiny_tropius',
  description: 'Grants +100 max HP to every ally at combat start.',

  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue

      ally.maxHp += BONUS_HP
      ally.currentHp = ally.maxHp
      ally._computedStats = null
    }
  },
})
