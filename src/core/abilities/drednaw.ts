import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { gainManaOnDamageTaken } from '../systems/mana'
import { computeStats } from '../unitFactory'
import { hexKnockbackPath, isValidHex, hexId } from '../hexGrid'

const DURATION_TICKS = 5 * TICK_RATE
const ARMOR_PIERCE   = 0.30

export const DrednawAbility: AbilityHandler = {
  abilityId: 'drednaw_razor_shell',
  castTimeTicks: 20,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const atkBonusValues  = [20, 30, 50]  as const
    const bonusDmgPcts    = [170, 245, 360] as const
    const atkBonus    = atkBonusValues[tier - 1]
    const bonusDmgPct = bonusDmgPcts[tier - 1]

    const handlerId = `drednaw_slash_${unit.id}`

    const handler: PassiveAttackHandler = {
      id: handlerId,
      suppressBaseAttack: true,

      onAttack(src: Unit, tgt: Unit, st: CombatState): void {
        if (!src.statusEffects.some(fx => fx.stackId === 'drednaw_razor_shell_active')) {
          src.passiveAttackHandlers = src.passiveAttackHandlers.filter(h => h.id !== handlerId)
          return
        }

        // Quick flip before each empowered pierce
        addStatusEffect(src, {
          id: 'drednaw_flip',
          sourceUnitId: src.id,
          durationTicks: 15,
          magnitude: 15,
          stackId: 'drednaw_flip',
        })

        const srcStats = src._computedStats ?? computeStats(src)
        const bonusDmg = Math.round(srcStats.attack * (bonusDmgPct / 100))

        const doPierce = (target: Unit) => {
          const result = applyDamage(src, target, {
            baseAmount: srcStats.attack,
            damageType: 'physical',
            canCrit: true,
            isAutoAttack: true,   // Razor Shell replaces the base auto — this pierce IS the auto attack
            armorPiercePct: ARMOR_PIERCE,
            abilityId: 'drednaw_razor_shell',
          }, st)
          gainManaOnDamageTaken(target, result.preMitigDamage)

          if (target.currentHp > 0) {
            applyDamage(src, target, {
              baseAmount: bonusDmg,
              damageType: 'physical',
              canCrit: false,
              armorPiercePct: ARMOR_PIERCE,
              abilityId: 'drednaw_razor_shell',
            }, st)
          }
        }

        // Primary target
        doPierce(tgt)

        // Pierce: hit the unit on the hex directly behind the target
        const pierceHexes = hexKnockbackPath(src.hexPos, tgt.hexPos, 1)
        if (pierceHexes.length > 0 && isValidHex(pierceHexes[0])) {
          const pierceTgtId = st.hexOccupancy.get(hexId(pierceHexes[0]))
          if (pierceTgtId) {
            const pierceTgt = st.units.get(pierceTgtId)
            if (pierceTgt && pierceTgt.team !== src.team) doPierce(pierceTgt)
          }
        }
      },
    }

    unit.passiveAttackHandlers = unit.passiveAttackHandlers.filter(h => h.id !== handlerId)
    unit.passiveAttackHandlers.push(handler)

    // Attack bonus and fixed attack speed for the duration
    addStatusEffect(unit, {
      id: 'dmg_buff',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      magnitude: atkBonus,
      stackId: 'drednaw_atk_buff',
    })
    addStatusEffect(unit, {
      id: 'atkSpd_set',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      magnitude: 1,
      stackId: 'drednaw_atkspd_set',
    })

    // Active marker — suppressManaGain blocks Drednaw from gaining mana during the phase
    addStatusEffect(unit, {
      id: 'drednaw_razor_shell',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      stackId: 'drednaw_razor_shell_active',
      suppressManaGain: true,
      onExpire: (u: Unit, _st: CombatState) => {
        u.passiveAttackHandlers = u.passiveAttackHandlers.filter(h => h.id !== handlerId)
      },
    })

    // Quick flip on cast
    addStatusEffect(unit, {
      id: 'drednaw_flip',
      sourceUnitId: unit.id,
      durationTicks: 15,
      magnitude: 15,
      stackId: 'drednaw_flip',
    })

    // Fire first empowered auto immediately
    unit.attackTimer = 0
  },
}
