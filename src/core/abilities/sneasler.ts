import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'

export const SneaslerAbility: AbilityHandler = {
  abilityId: 'sneasler_dire_claw',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues  = [200, 300, 500] as const
    const poisonTicks   = [30,  45,  75 ] as const

    const damageAmount = damageValues[tier - 1]
    const poisonMag    = poisonTicks[tier - 1]

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!target) return

    // Check if target already has 'poison' — if so, allow crit on the initial hit
    const alreadyPoisoned = target.statusEffects.some(fx => fx.id === 'poison')

    applyDamage(unit, target, {
      baseAmount: damageAmount,
      damageType: 'physical',
      canCrit: alreadyPoisoned,
      abilityId: 'sneasler_dire_claw',
    }, state)

    // Apply stackable poison (unique stackId per cast tick)
    const stackId = `sneasler_poison_${state.tick}`

    addStatusEffect(target, {
      id: 'poison',
      sourceUnitId: unit.id,
      durationTicks: 3 * TICK_RATE,
      magnitude: poisonMag,
      tickInterval: TICK_RATE,
      stackId,
      tickEffect: (u: Unit, st: CombatState) => {
        if (u.state === 'dead') return
        applyDamage(unit, u, {
          baseAmount: poisonMag,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'sneasler_dire_claw',
        }, st)
      },
    })
  },
}
