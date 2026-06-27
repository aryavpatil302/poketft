import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { findHighestDamageDealerEnemy } from '../systems/targeting'

export const TorkoalAbility: AbilityHandler = {
  abilityId: 'torkoal_white_smoke',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const healValues     = [200, 300, 450] as const
    const damageValues   = [100, 150, 250] as const
    const blindSeconds   = [2,   2,   3  ] as const

    const healAmount    = healValues[tier - 1]
    const damageAmount  = damageValues[tier - 1]
    const blindDuration = blindSeconds[tier - 1] * TICK_RATE

    // Heal self immediately
    applyHeal(unit, healAmount, unit.id, state)

    const target = findHighestDamageDealerEnemy(unit, state)
    if (!target) return

    const casterId = unit.id

    const proj = createProjectile({
      sourceId: casterId,
      targetId: target.id,
      startPos: { ...unit.visualPos },
      speed: 8,
      damagePayload: {
        baseAmount: damageAmount,
        damageType: 'magic',
        canCrit: false,
        scalingStat: 'special',
        scalingRatio: 0,
      },
      onHit: (_source, hitTarget, st) => {
        if (hitTarget.state === 'dead') return

        addStatusEffect(hitTarget, {
          id: 'blind',
          sourceUnitId: casterId,
          durationTicks: blindDuration,
          stackId: `torkoal_blind_${hitTarget.id}`,
        })

        st.events.push({
          type: 'vfx',
          effectId: 'torkoal_white_smoke',
          unitId: hitTarget.id,
          durationTicks: blindDuration,
        })
      },
      abilityId: 'torkoal_white_smoke',
    })
    state.projectiles.set(proj.id, proj)
  },
}
