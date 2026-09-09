import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Celebi: at combat start, allies standing in the caster's own back 2
// rows gain a +5% damage-amp status (the existing `damage_amp` case, read by
// damage.ts off the ATTACKER's statusEffects). Board rows: 0-3 enemy half,
// 4-7 player half (hexGrid.ts). "Front" is derived per-team the same way
// Venusaur's shiny effect (Jungle batch) derives it — self.team === 'player'
// ? row >= 6 : row <= 1 — so "back 2 rows" here is the opposite end of that
// same half: player back = rows 4-5, enemy back = rows 2-3.
function isInBackTwoRows(team: Unit['team'], row: number): boolean {
  return team === 'player' ? row <= 5 : row >= 2
}

registerShinyEffect('celebi', {
  id: 'shiny_celebi',
  description: 'Grants allies in the back 2 rows +5% damage amp.',
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
