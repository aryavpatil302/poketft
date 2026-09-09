import type { Unit, CombatState, Team } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Shiny Venusaur: allies standing in the caster's own front 2 rows gain +100
// max HP at combat start. Board rows: 0-3 = enemy half, 4-7 = player half
// (hexGrid.ts). "Front 2 rows" is defined relative to team per this batch's
// shared convention (see the architecture notes this plan was built from):
// player front = rows 6-7, enemy front = rows 0-1.
const BONUS_HP = 100

function isInFrontTwoRows(row: number, team: Team): boolean {
  return team === 'player' ? row >= 6 : row <= 1
}

registerShinyEffect('venusaur', {
  id: 'shiny_venusaur',
  description: "Grants allies in this Venusaur's own front 2 rows +100 max HP at combat start.",

  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      if (!isInFrontTwoRows(ally.hexPos.row, self.team)) continue

      // Mutate stored base fields directly, same shape as the universal
      // +5% shiny bonus in ../shinyEffects.ts.
      ally.maxHp += BONUS_HP
      ally.currentHp = ally.maxHp
      ally._computedStats = null
    }
  },
})
