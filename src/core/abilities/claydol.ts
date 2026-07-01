import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'

const CHANNEL_TICKS = Math.round(1.5 * TICK_RATE)  // 90 ticks = 1.5 seconds

export const ClaydolAbility: AbilityHandler = {
  abilityId: 'claydol_gravity',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const flatDmgValues = [400, 600, 1000] as const
    const pctDmgValues  = [0.05, 0.08, 0.10] as const
    const flatDmg = flatDmgValues[tier - 1]
    const pctDmg  = pctDmgValues[tier - 1]
    const casterRef = unit

    const targets = findNearestEnemies(unit, state, 2)

    for (const target of targets) {
      target.state = 'ascended'

      addStatusEffect(target, {
        id:           'claydol_gravity_target',
        sourceUnitId: unit.id,
        durationTicks: CHANNEL_TICKS,
        magnitude:    CHANNEL_TICKS,  // stored so unitLayer can compute elapsed
        stackId:      'claydol_gravity_target',
        tickEffect:   (u) => { if (u.state !== 'dead') u.state = 'ascended' },
        onExpire:     (u, st) => {
          if (u.state === 'ascended') u.state = 'idle'
          if (u.state === 'dead') return
          const totalDmg = flatDmg + Math.round(u.maxHp * pctDmg)
          applyDamage(casterRef, u, { baseAmount: totalDmg, damageType: 'magic', canCrit: false, abilityId: 'claydol_gravity' }, st)
          st.events.push({ type: 'vfx', effectId: 'claydol_gravity_slam', unitId: u.id })
        },
      })
    }

    state.events.push({ type: 'vfx', effectId: 'claydol_gravity_cast', unitId: unit.id })
  },
}
