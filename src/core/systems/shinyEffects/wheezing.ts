import type { Unit, CombatState } from '../../types'
import { TICK_RATE } from '../../constants'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'

// Shiny Wheezing: at combat start, apply 30% Sunder and 30% Shred to every
// living enemy for 15 seconds. Magnitude matches Wheezing's own Poison Gas
// pulse (wheezing.ts: 0.30 sunder_pct/shred_pct per hit) for consistency;
// duration is a one-shot combat-start application, not a re-triggering pulse,
// so it uses a flat 15s window instead of the ability's per-pulse 3s (180-tick)
// refresh.
const DEBUFF_MAGNITUDE = 0.30
const DEBUFF_DURATION_TICKS = 15 * TICK_RATE

registerShinyEffect('wheezing', {
  id: 'shiny_wheezing_toxic_cloud',
  description: 'At the start of combat, sunders and shreds the entire enemy team for 15 seconds.',
  onCombatStart(self: Unit, state: CombatState): void {
    for (const enemy of state.units.values()) {
      // No isDummy exclusion here (unlike the ally-targeting shiny effects in
      // this batch) — a training dummy on the enemy side is a legitimate
      // debuff target, exactly like Wheezing's real Poison Gas ability
      // (wheezing.ts) applies its own sunder/shred to dummy enemies with no
      // such filter. isDummy exclusion only matters for OWN-team grants,
      // where you don't want a test dummy soaking up a buff meant for allies.
      if (enemy.team === self.team) continue
      addStatusEffect(enemy, {
        id: 'sunder_pct',
        sourceUnitId: self.id,
        durationTicks: DEBUFF_DURATION_TICKS,
        magnitude: DEBUFF_MAGNITUDE,
        stackId: `shiny_wheezing_sunder_${enemy.id}`,
      })
      addStatusEffect(enemy, {
        id: 'shred_pct',
        sourceUnitId: self.id,
        durationTicks: DEBUFF_DURATION_TICKS,
        magnitude: DEBUFF_MAGNITUDE,
        stackId: `shiny_wheezing_shred_${enemy.id}`,
      })
    }
  },
})
