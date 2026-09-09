import type { Unit } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Armarouge: self +15 attack and +15% attack speed at combat start.
//
// UPDATED SPEC (user-approved simplification of the original design doc):
// the original "+1 attack permanently until the end of the game on an Armor
// Cannon kill" is replaced — this codebase has no mechanism for a stat bonus
// surviving past one fight. This is now a plain in-combat-only combat-start
// grant, like every other effect in this batch. armarouge.ts (the ability
// file) is intentionally untouched — this effect needs no cast-time hook.
registerShinyEffect('armarouge', {
  id: 'shiny_armarouge_ember_focus',
  description: 'Gains +15 Attack and +15% Attack Speed.',
  onCombatStart(self: Unit): void {
    addStatusEffect(self, {
      id: 'dmg_buff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 15,
      stackId: `shiny_armarouge_atk_${self.id}`,
    })
    addStatusEffect(self, {
      id: 'atkSpd_buff',
      sourceUnitId: self.id,
      durationTicks: -1,
      magnitude: 0.15,
      stackId: `shiny_armarouge_atkspd_${self.id}`,
    })
  },
})
