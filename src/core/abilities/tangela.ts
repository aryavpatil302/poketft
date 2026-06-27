import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'

export const TangelaAbility: AbilityHandler = {
  abilityId: 'tangela_leaf_guard',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues = [400, 525, 685] as const
    const shieldAmount = shieldValues[tier - 1]
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
          const healAmount = Math.floor(s.value * 0.5)
          u.currentHp = Math.min(u.maxHp, u.currentHp + healAmount)
          state.events.push({
            type: 'heal',
            targetId: u.id,
            amount: healAmount,
            sourceId: u.id,
          })
        }
      },
    }

    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmount })
  },
}
