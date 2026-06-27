import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addMark } from '../systems/marks'
import { findNearestEnemies } from '../systems/targeting'

export const CelebiAbility: AbilityHandler = {
  abilityId: 'celebi_future_sight',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const markCounts    = [2, 3, 4] as const
    const damageMults   = [0.30, 0.50, 0.80] as const
    const detonDamages  = [400, 600, 900] as const

    const count   = markCounts[tier - 1]
    const mult    = damageMults[tier - 1]
    const detDmg  = detonDamages[tier - 1]

    const targets = findNearestEnemies(unit, state, count)

    for (const target of targets) {
      const baseDamageTaken = target.damageTakenThisCombat

      // Amplify incoming damage
      target.incomingDamageMult = 1 + mult

      addMark(target, {
        id: `celebi_mark_${target.id}`,
        sourceUnitId: unit.id,
        durationTicks: 2 * TICK_RATE,
        onDetonate: (marked, source, st) => {
          marked.incomingDamageMult = 1.0
          if (!source || source.state === 'dead') return
          applyDamage(source, marked, { baseAmount: detDmg, damageType: 'magic', canCrit: false, abilityId: 'celebi_future_sight' }, st)
        },
      })
    }
  },
}
