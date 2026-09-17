import type { Unit, CombatState, Team } from '../../types'
import { registerShinyEffect } from '../shinyEffects'

// Shiny Venusaur: allies standing in the caster's own front 2 rows gain +50
// max HP at combat start. Board rows: 0-3 = enemy half, 4-7 = player half
// (hexGrid.ts). "Front" means closest to the row 3/row 4 boundary between
// the two team halves — the authoritative convention from
// src/enemy/generator.ts:155 ("row 3 = front, row 0 = back" for the enemy
// half), mirrored for the player half: player front = rows 4-5, enemy
// front = rows 2-3.
const BONUS_HP = 50

function isInFrontTwoRows(row: number, team: Team): boolean {
  return team === 'player' ? row <= 5 : row >= 2
}

registerShinyEffect('venusaur', {
  id: 'shiny_venusaur',
  description: 'Grants allies in the front 2 rows +50 max Health.',

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
