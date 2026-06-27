import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId, hexDistance } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'

export const RayquazaAbility: AbilityHandler = {
  abilityId: 'rayquaza_dragon_ascent',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages        = [500, 750, 1200] as const
    const ascentDuration = 2 * TICK_RATE  // 2 seconds ascent

    const centerDmg  = damages[tier - 1]
    const slamDelay  = ascentDuration

    const [target] = findNearestEnemies(unit, state, 1)

    // Ascend both units
    unit.state = 'ascended'
    if (target) target.state = 'ascended'

    const casterRef  = unit
    const targetRef  = target

    // Schedule the slam via a status effect countdown on caster
    addStatusEffect(unit, {
      id: 'rayquaza_ascent',
      sourceUnitId: unit.id,
      durationTicks: slamDelay,
      stackId: 'rayquaza_ascent',
      onExpire: (u, st) => {
        u.state = 'idle'
        if (targetRef && targetRef.state === 'ascended') targetRef.state = 'idle'

        const slamCenter = targetRef?.hexPos ?? u.hexPos

        for (const hex of hexesInRange(slamCenter, 2)) {
          const uid = st.hexOccupancy.get(hexId(hex))
          if (!uid) continue
          const victim = st.units.get(uid)
          if (!victim || victim.team === u.team || victim.state === 'dead') continue

          const dist   = hexDistance(hex, slamCenter)
          const dmgMult = dist === 0 ? 1.0 : dist === 1 ? 0.5 : 0.25
          applyDamage(u, victim, { baseAmount: Math.round(centerDmg * dmgMult), damageType: 'true', canCrit: false, abilityId: 'rayquaza_dragon_ascent' }, st)
        }
      },
    })
  },
}
