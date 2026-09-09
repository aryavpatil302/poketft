import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Celebi: at combat start, allies standing in the caster's own back 2
// rows gain a +5% damage-amp status (the existing `damage_amp` case, read by
// damage.ts off the ATTACKER's statusEffects). Board rows: 0-3 enemy half,
// 4-7 player half (hexGrid.ts). "Back" means farthest from the row 3/row 4
// boundary between the two team halves — the authoritative convention from
// src/enemy/generator.ts:155 ("row 3 = front, row 0 = back" for the enemy
// half), mirrored for the player half: player back = rows 6-7, enemy
// back = rows 0-1.
function isInBackTwoRows(team: Unit['team'], row: number): boolean {
  return team === 'player' ? row >= 6 : row <= 1
}

registerShinyEffect('celebi', {
  id: 'shiny_celebi',
  description: 'Allies in the back 2 rows gain +5% damage amp at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      if (!isInBackTwoRows(self.team, ally.hexPos.row)) continue
      addStatusEffect(ally, {
        id: 'damage_amp',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 0.05,
        stackId: `shiny_celebi_dmgamp_${ally.id}`,
      })
    }
  },
})
