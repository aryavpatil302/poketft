import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { findNearestEnemies } from '../systems/targeting'

const POISON_DURATION_TICKS = 4 * TICK_RATE  // 4 seconds
const POISON_TICKS          = 4              // one proc per second × 4 = total

export const ZubatAbility: AbilityHandler = {
  abilityId: 'zubat_poison_sting',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages     = [200, 350, 600] as const
    const poisonTotal = [20,  50,  75 ] as const

    const damage        = damages[tier - 1]
    const poisonPerTick = Math.round(poisonTotal[tier - 1] / POISON_TICKS)

    const atkTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (atkTarget && atkTarget.state !== 'dead' && atkTarget.team !== unit.team)
      ? atkTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!target) return

    const casterId  = unit.id
    const applyTick = state.tick  // unique seed per cast for stackable stackId

    const proj = createProjectile({
      sourceId: unit.id,
      targetId: target.id,
      startPos: { ...unit.visualPos },
      speed: 12,
      damagePayload: {
        baseAmount: damage,
        damageType: 'magic',
        canCrit: false,
      },
      onHit: (_src, hitTarget, _hitState) => {
        if (hitTarget.state === 'dead') return
        addStatusEffect(hitTarget, {
          id: 'zubat_poison',
          sourceUnitId: casterId,
          durationTicks: POISON_DURATION_TICKS,
          tickInterval: TICK_RATE,
          tickEffect: (u: Unit, st: CombatState) => {
            if (u.state === 'dead') return
            // Poison deals fixed true damage — bypasses defense, emits floating number
            u.currentHp = Math.max(0, u.currentHp - poisonPerTick)
            st.events.push({
              type: 'damage',
              targetId: u.id,
              amount: poisonPerTick,
              damageType: 'magic',
              isCrit: false,
              sourceId: casterId,
              abilityId: 'zubat_poison_sting',
            })
            if (u.currentHp <= 0) {
              u.state = 'dead'
              st.events.push({ type: 'death', unitId: u.id, sourceId: casterId, abilityId: 'zubat_poison_sting' })
            }
          },
          stackId: `zubat_poison_${casterId}_${applyTick}`,
        })
      },
      abilityId: 'zubat_poison_sting',
    })
    state.projectiles.set(proj.id, proj)
  },
}
