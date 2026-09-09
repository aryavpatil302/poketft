import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import { TICK_RATE } from '../../constants'

// Shiny Claydol: all allies gain a mana-regen tickEffect status, +1
// mana/sec, at combat start — the Life Orb shape
// (src/data/items/life_orb.ts:23-37), applied team-wide instead of self-only.
registerShinyEffect('claydol', {
  id: 'shiny_claydol_mana_font',
  description: 'All allies gain +1 mana regen per second.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue

      addStatusEffect(ally, {
        id: 'shiny_claydol_mana_font',
        sourceUnitId: self.id,
        durationTicks: -1,
        stackId: `shiny_claydol_mana_font_${ally.id}`,
        tickInterval: TICK_RATE,
        tickEffect: (u) => {
          if (u.state === 'dead' || u.maxMana === 0) return
          u.currentMana = Math.min(u.maxMana, u.currentMana + 1)
        },
      })
    }
  },
})
