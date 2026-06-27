import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyHeal } from '../systems/heal'
import { findNearestAlly } from '../systems/targeting'

export const GogoatAbility: AbilityHandler = {
  abilityId: 'gogoat_grass_pelt',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const bonusDamages = [50,  75,  125] as const
    const selfHeals    = [50,  75,  125] as const
    const allyHeals    = [25,  40,  60 ] as const

    const bonusDamage = bonusDamages[tier - 1]
    const selfHeal    = selfHeals[tier - 1]
    const allyHeal    = allyHeals[tier - 1]

    // Capture values in closure for the onHit callback
    const selfHealAmount = selfHeal
    const allyHealAmount = allyHeal
    const sourceId = unit.id

    for (let i = 0; i < 3; i++) {
      unit.attackModifiers.push({
        id: 'gogoat_horn',
        remainingCharges: 1,
        bonusDamage,
        bonusDamageType: 'physical',
        onHit: (src: Unit, _tgt: Unit, st: CombatState) => {
          // Heal self
          applyHeal(src, selfHealAmount, sourceId, st)
          // Heal nearest ally
          const ally = findNearestAlly(src, st)
          if (ally) applyHeal(ally, allyHealAmount, sourceId, st)
        },
      })
    }
  },
}
