import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Weavile: whole team gets +5 attack and +5% attack speed once, at
// combat start. Fixed (non-source-keyed) stackIds so a second shiny Weavile
// on the same team refreshes rather than stacks — same dedup shape the
// Promoter aura uses for its own team-wide atkSpd_buff
// (traitEffects.ts:1184-1193).
registerShinyEffect('weavile', {
  id: 'shiny_weavile_team_buff',
  description: 'Team-wide +5 attack and +5% attack speed at combat start.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue
      addStatusEffect(ally, {
        id: 'dmg_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 5,
        stackId: 'weavile_shiny_dmg_buff',
      })
      addStatusEffect(ally, {
        id: 'atkSpd_buff',
        sourceUnitId: self.id,
        durationTicks: -1,
        magnitude: 0.05,
        stackId: 'weavile_shiny_atkspd_buff',
      })
    }
  },
})
