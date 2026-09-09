import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import { addShield } from '../shield'

// Shiny Palossand: self only, at combat start — 200 HP shield + 10 armor +
// 10 magic resist.
registerShinyEffect('palossand', {
  id: 'shiny_palossand',
  description: 'Self: +200 shield, +10 armor, +10 magic resist at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    addShield(self, {
      id: crypto.randomUUID(),
      sourceAbility: 'shiny_palossand',
      value: 200,
      maxValue: 200,
      durationTicks: -1,
    }, state)
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
