import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { gainManaOnHit, gainManaOnDamageTaken } from '../systems/mana'
import { computeStats } from '../unitFactory'

const DURATION_TICKS = 5 * TICK_RATE
const ARMOR_PIERCE   = 0.30

export const DrednawAbility: AbilityHandler = {
  abilityId: 'drednaw_razor_shell',
  castTimeTicks: 20,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const atkBonusValues  = [20, 30, 50]  as const
    const bonusDmgValues  = [110, 160, 235] as const
    const atkBonus  = atkBonusValues[tier - 1]
    const bonusDmg  = bonusDmgValues[tier - 1]

    const handlerId = `drednaw_slash_${unit.id}`

    const handler: PassiveAttackHandler = {
      id: handlerId,
      suppressBaseAttack: true,

      onAttack(src: Unit, tgt: Unit, st: CombatState): void {
        if (!src.statusEffects.some(fx => fx.stackId === 'drednaw_razor_shell_active')) {
          src.passiveAttackHandlers = src.passiveAttackHandlers.filter(h => h.id !== handlerId)
          return
        }

        const srcStats = src._computedStats ?? computeStats(src)

        // Slash: auto damage with 30% armor pierce
        const result = applyDamage(src, tgt, {
          baseAmount: srcStats.attack,
          damageType: 'physical',
          canCrit: true,
          armorPiercePct: ARMOR_PIERCE,
          abilityId: 'drednaw_razor_shell',
        }, st)

        gainManaOnHit(src)
        gainManaOnDamageTaken(tgt, result.preMitigDamage)

        // Bonus slash damage on the same target
        if (tgt.state !== 'dead') {
          applyDamage(src, tgt, {
            baseAmount: bonusDmg,
            damageType: 'physical',
            canCrit: false,
            armorPiercePct: ARMOR_PIERCE,
            abilityId: 'drednaw_razor_shell',
          }, st)
        }
      },
    }

    unit.passiveAttackHandlers = unit.passiveAttackHandlers.filter(h => h.id !== handlerId)
    unit.passiveAttackHandlers.push(handler)

    // Attack bonus for the duration
    addStatusEffect(unit, {
      id: 'dmg_buff',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      magnitude: atkBonus,
      stackId: 'drednaw_atk_buff',
    })

    // Buff marker — onExpire removes the slash handler
    addStatusEffect(unit, {
      id: 'drednaw_razor_shell',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      stackId: 'drednaw_razor_shell_active',
      onExpire: (u: Unit, _st: CombatState) => {
        u.passiveAttackHandlers = u.passiveAttackHandlers.filter(h => h.id !== handlerId)
      },
    })
  },
}
