import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addShield } from '../shield'

// Shiny Tangela: every living ally gets a 75 HP shield at combat start.
// Loop shape copied from the Promoter aura (traitEffects.ts ~1158-1192):
// team-wide, excluding training dummies.

const SHIELD_VALUE = 75

registerShinyEffect('tangela', {
  id: 'shiny_tangela',
  description: 'Grants all allies a 75-Health shield at the start of combat.',

  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue

      // traitSource: this shield only exists because the caster is shiny — credit
      // the amount (and any damage it later absorbs) to the shiny effect so it
      // shows in the report's "Shiny effect impact" rollup.
      addShield(ally, {
        id: crypto.randomUUID(),
        sourceAbility: 'shiny_tangela',
        sourceUnitId: self.id,
        value: SHIELD_VALUE,
        maxValue: SHIELD_VALUE,
        durationTicks: -1,
      }, state, 'shiny:' + self.definitionId)
    }
  },
})
