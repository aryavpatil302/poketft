import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { addShield } from '../systems/shield'
import { applyHeal } from '../systems/heal'
import { computeStats } from '../unitFactory'

export const TangelaAbility: AbilityHandler = {
  abilityId: 'tangela_leaf_guard',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues = [400, 525, 685] as const
    const spMult       = (unit._computedStats ?? computeStats(unit)).special / 100
    const shieldAmount = Math.round(shieldValues[tier - 1] * spMult)
    const durationTicks = 4 * TICK_RATE  // 4 seconds

    const shield: Shield = {
      id: `tangela_leaf_guard_${unit.id}_${state.tick}`,
      sourceAbility: 'tangela_leaf_guard',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks,
      effectiveMaxHp: unit.currentHp + shieldAmount,
      onExpire: (u: Unit, s: Shield) => {
        if (s.value > 0) {
          applyHeal(u, Math.floor(s.value * 0.5), u.id, state)
        }
      },
    }

    addShield(unit, shield, state)
  },
}
