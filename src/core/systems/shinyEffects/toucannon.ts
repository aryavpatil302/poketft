import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { addStatusEffect } from '../statusEffect'
import { releaseHexes } from '../movement'
import { TICK_RATE } from '../../constants'

// Shiny Toucannon: applies a single 15-second burn to every living enemy at
// combat start. No reusable burn helper supports a 15s duration (statusEffect.ts's
// applyBurn is hardcoded to 4s), so this hand-rolls the tick shape used by
// traitEffects.ts's volcano_sun_burn (~line 284-296).
const BURN_DURATION_SEC = 15
const BURN_PCT_PER_SEC = 0.02   // 2% of the target's max HP each second

registerShinyEffect('toucannon', {
  id: 'shiny_toucannon',
  description: 'Applies burn to all enemies for the first 15 seconds of combat.',

  onCombatStart(self: Unit, state: CombatState): void {
    const durationTicks = BURN_DURATION_SEC * TICK_RATE

    for (const enemy of state.units.values()) {
      // No isDummy exclusion here — that convention is for ally-targeting
      // effects (don't grant free buffs to a training dummy standing in
      // for a teammate). An enemy dummy is a valid burn target, same as
      // traitEffects.ts's volcano_sun_burn, which this shape mirrors.
      if (enemy.team === self.team) continue

      const perSec = Math.max(1, Math.round(enemy.maxHp * BURN_PCT_PER_SEC))
      addStatusEffect(enemy, {
        id: 'shiny_toucannon_burn',
        sourceUnitId: self.id,
        durationTicks,
        magnitude: perSec,
        tickInterval: TICK_RATE,
        stackId: 'shiny_toucannon_burn',
        tickEffect: (target, st) => {
          target.currentHp = Math.max(0, target.currentHp - perSec)
          st.events.push({ type: 'damage', targetId: target.id, amount: perSec, damageType: 'true', isCrit: false, sourceId: self.id, abilityId: 'shiny_toucannon' })
          if (target.currentHp <= 0) {
            target.currentHp = 0
            target.state = 'dead'
            releaseHexes(target, st)
            st.events.push({ type: 'death', unitId: target.id, sourceId: self.id, abilityId: 'shiny_toucannon' })
          }
        },
      })
    }
  },
})
