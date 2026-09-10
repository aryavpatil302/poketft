import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import { addShield } from '../shield'

// Shiny Palossand: self only, at combat start — 200 HP shield + 10 armor +
// 10 magic resist.
registerShinyEffect('palossand', {
  id: 'shiny_palossand',
  description: 'Starts combat with a 200-Health shield and +10 Defense and Sp. Defense.',
  onCombatStart(self: Unit, state: CombatState): void {
    // traitSource: this shield is the shiny effect — credit its value (and any
    // damage it absorbs) to the shiny rollup. The armor/spDef buffs below have no
    // discrete contribution call and aren't instrumented.
    addShield(self, {
      id: crypto.randomUUID(),
      sourceAbility: 'shiny_palossand',
      value: 200,
      maxValue: 200,
      durationTicks: -1,
    }, state, 'shiny:' + self.definitionId)
    addStatusEffect(self, {
      id: 'armorBuff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 10,
      stackId: 'shiny_palossand_armor',
    })
    addStatusEffect(self, {
      id: 'spDefBuff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 10,
      stackId: 'shiny_palossand_spdef',
    })
  },
})
