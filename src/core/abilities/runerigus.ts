import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { addMark, removeMark } from '../systems/marks'
import { findNearestEnemies } from '../systems/targeting'

const MARK_ID = 'wandering_spirit'

export const RunerigusAbility: AbilityHandler = {
  abilityId: 'runerigus_wandering_spirit',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const silenceDamages = [250, 375, 600] as const
    const dmg = silenceDamages[tier - 1]

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!target) return

    addMark(target, {
      id: MARK_ID,
      sourceUnitId: unit.id,
      durationTicks: 4 * TICK_RATE,
      magnitude: dmg,
      onDetonate: (marked, _source, _st) => {
        marked.silenced = false
      },
    })

    target.silenced = true

    addStatusEffect(target, {
      id: 'silence',
      sourceUnitId: unit.id,
      durationTicks: 4 * TICK_RATE,
      magnitude: dmg,
      stackId: `runerigus_silence_${target.id}`,
      onExpire: (u, _st) => {
        u.silenced = u.statusEffects.some(fx => fx.id === 'silence')
        removeMark(u, MARK_ID)
      },
    })
  },
}
