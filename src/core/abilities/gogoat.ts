import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { computeStats } from '../unitFactory'

export const GogoatAbility: AbilityHandler = {
  abilityId: 'gogoat_grass_pelt',
  castTimeTicks: 20,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const healValues   = [105, 145, 200] as const
    const bonusDmgVals = [50,   80, 120] as const

    const spMult      = (unit._computedStats ?? computeStats(unit)).special / 100
    const healAmount  = Math.round(healValues[tier - 1] * spMult)
    const bonusDamage = bonusDmgVals[tier - 1]
    const sourceId    = unit.id

    unit.attackTimer = 0

    for (let i = 0; i < 3; i++) {
      unit.attackModifiers.push({
        id: 'gogoat_horn',
        remainingCharges: 1,
        bonusDamage,
        bonusDamageType: 'physical',
        onHit: (src: Unit, _tgt: Unit, st: CombatState) => {
          applyHeal(src, healAmount, sourceId, st)
          // Keep the 70px lunge branch active through the retract phase.
          // The modifier is consumed at the hit frame, so this status effect
          // covers the remaining ~13 retract ticks for the last auto.
          addStatusEffect(src, {
            id: 'gogoat_lunge_active',
            sourceUnitId: src.id,
            durationTicks: 25,
            stackId: 'gogoat_lunge',
          })
        },
      })
    }
  },
}
