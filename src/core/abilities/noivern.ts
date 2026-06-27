import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexDistance } from '../hexGrid'

export const NoivernAbility: AbilityHandler = {
  abilityId: 'noivern_boomburst',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages          = [250, 375, 600] as const
    const silenceDurations = [2, 2.5, 3] as const

    const damage   = damages[tier - 1]
    const silTicks = Math.round(silenceDurations[tier - 1] * TICK_RATE)

    // Hit all enemies within 4 rows (rowspan = 4 hex rows above + below)
    for (const target of state.units.values()) {
      if (target.team === unit.team || target.state === 'dead') continue
      // Within 4 rows means row distance ≤ 4 and column distance ≤ 7 (board width)
      if (Math.abs(target.hexPos.row - unit.hexPos.row) > 4) continue

      applyDamage(unit, target, { baseAmount: damage, damageType: 'magic', canCrit: false, abilityId: 'noivern_boomburst' }, state)
      if (target.state === 'dead') continue

      addStatusEffect(target, {
        id: 'silence',
        sourceUnitId: unit.id,
        durationTicks: silTicks,
        stackId: `noivern_silence_${target.id}`,
        onExpire: (u) => { u.silenced = u.statusEffects.some(fx => fx.id === 'silence') },
      })
    }
  },
}
