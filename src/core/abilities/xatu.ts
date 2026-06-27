import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addMark } from '../systems/marks'
import { findNearestEnemies } from '../systems/targeting'

export const XatuAbility: AbilityHandler = {
  abilityId: 'xatu_magic_bounce',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [300, 450, 700] as const
    const damage = damageValues[tier - 1]

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!target) return

    const casterId = unit.id

    addMark(target, {
      id: 'future_sight',
      sourceUnitId: casterId,
      durationTicks: 2 * TICK_RATE,  // 2 seconds delay
      magnitude: 0,
      onDetonate: (marked: Unit, source: Unit | undefined, st: CombatState) => {
        if (!source || source.state === 'dead') return
        applyDamage(source, marked, {
          baseAmount: damage,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'xatu_magic_bounce',
        }, st)
      },
    })

    // Amplify incoming damage on the target temporarily
    target.incomingDamageMult += 0.3
  },
}
