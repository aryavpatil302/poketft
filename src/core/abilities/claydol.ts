import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId, hexDistance } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'

export const ClaydolAbility: AbilityHandler = {
  abilityId: 'claydol_gravity',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const centerDamages   = [350, 525, 850] as const
    const ascentDurations = [2.5, 2.5, 2.5] as const

    const centerDmg  = centerDamages[tier - 1]
    const ascentTicks = Math.round(ascentDurations[tier - 1] * TICK_RATE)

    const targets = findNearestEnemies(unit, state, 2)
    const capturedTargets = [...targets]

    for (const target of targets) {
      target.state = 'ascended'
    }

    // Schedule slam via countdown on caster
    addStatusEffect(unit, {
      id: 'claydol_slam',
      sourceUnitId: unit.id,
      durationTicks: ascentTicks,
      stackId: 'claydol_slam',
      onExpire: (u, st) => {
        for (const lifted of capturedTargets) {
          if (lifted.state === 'ascended') lifted.state = 'idle'
          if (lifted.state === 'dead') continue

          const slamCenter = lifted.hexPos
          for (const hex of hexesInRange(slamCenter, 1)) {
            const uid = st.hexOccupancy.get(hexId(hex))
            if (!uid) continue
            const victim = st.units.get(uid)
            if (!victim || victim.team === u.team || victim.state === 'dead') continue
            const dist = hexDistance(hex, slamCenter)
            const dmg  = dist === 0 ? centerDmg : Math.round(centerDmg * 0.6)
            applyDamage(u, victim, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityId: 'claydol_gravity' }, st)
          }
        }
      },
    })
  },
}
