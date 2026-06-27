import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'

export const GrapploctAbility: AbilityHandler = {
  abilityId: 'grapploct_octolock',
  castTimeTicks: 25,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const targetCounts = [2, 3, 4] as const
    const damages      = [200, 300, 500] as const
    const stunSecs     = [1.5, 2, 3] as const

    const count   = targetCounts[tier - 1]
    const damage  = damages[tier - 1]
    const stun    = Math.round(stunSecs[tier - 1] * TICK_RATE)

    const spBuff = getSpellBuff(unit, state)
    const atkGain = Math.round(unit.attack * [0.05, 0.08, 0.15][tier - 1] * (1 + spBuff * 0.05))

    const targets = findNearestEnemies(unit, state, count)
    for (const target of targets) {
      applyDamage(unit, target, { baseAmount: damage, damageType: 'physical', canCrit: false, abilityId: 'grapploct_octolock' }, state)
      if (target.state !== 'dead') {
        addStatusEffect(target, {
          id: 'stun',
          sourceUnitId: unit.id,
          durationTicks: stun,
          stackId: `grapploct_stun_${target.id}`,
          onExpire: (u) => { if (u.state === 'stunned') u.state = 'idle' },
        })
      }
    }

    // Permanent attack gain from SpellBuff
    if (atkGain > 0) {
      addStatusEffect(unit, {
        id: 'dmg_buff',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: atkGain,
        stackId: `grapploct_atk_${state.tick}`,
      })
    }

    incrementSpellBuff(unit, state)
  },
}
