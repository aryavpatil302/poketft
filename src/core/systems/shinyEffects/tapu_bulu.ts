import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import { applyHeal } from '../heal'
import { TICK_RATE } from '../../constants'

// Shiny Tapu Bulu: self-only 1% max-HP/sec regen for the whole combat.
// Same tickEffect shape as Life Orb's mana regen (src/data/items/life_orb.ts
// ~23-37), but heals via applyHeal instead of costing mana.
const REGEN_PCT_PER_SEC = 0.01

registerShinyEffect('tapu_bulu', {
  id: 'shiny_tapu_bulu',
  description: 'Regenerates 1% of max Health per second.',

  onCombatStart(self: Unit, _state: CombatState): void {
    addStatusEffect(self, {
      id: 'shiny_tapu_bulu_regen',
      sourceUnitId: self.id,
      durationTicks: -1,
      tickInterval: TICK_RATE,
      stackId: 'shiny_tapu_bulu_regen',
      tickEffect: (u, st) => {
        if (u.state === 'dead') return
        const amount = Math.max(1, Math.round(u.maxHp * REGEN_PCT_PER_SEC))
        // traitSource: this regen only exists because the unit is shiny — credit
        // every tick's healing to the shiny rollup.
        applyHeal(u, amount, u.id, st, 'shiny:' + self.definitionId)
      },
    })
  },
})
