import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { addStatusEffect } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'

export const TapuBuluAbility: AbilityHandler = {
  abilityId: 'tapubulu_natures_madness',
  castTimeTicks: 30,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const armorValues = [30,  50,  500] as const
    const mrValues    = [30,  50,  500] as const
    // Per-attack true damage as % of current HP (5/8/50%)
    const trueDmgPct  = [0.05, 0.08, 0.50] as const

    const armorBonus  = armorValues[tier - 1]
    const mrBonus     = mrValues[tier - 1]

    // Double current HP and max HP base stat
    unit.maxHp     = unit.maxHp * 2
    unit.currentHp = Math.min(unit.currentHp * 2, unit.maxHp)

    // Gain armor permanently
    addStatusEffect(unit, {
      id:           'armorBuff',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude:    armorBonus,
      stackId:      'tapubulu_armor',
    })

    // Gain magic resist permanently
    addStatusEffect(unit, {
      id:           'spDefBuff',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude:    mrBonus,
      stackId:      'tapubulu_spdef',
    })

    // Cap attack speed to 0.5 for the rest of combat
    addStatusEffect(unit, {
      id:           'atkSpd_cap',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude:    0.5,
      stackId:      'tapubulu_atkspd_cap',
    })

    const healValues   = [300, 500, 2000] as const
    const healAmount   = healValues[tier - 1]
    const truePct      = trueDmgPct[tier - 1]

    addStatusEffect(unit, {
      id:           'tapubulu_madness',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude:    truePct,
      stackId:      'tapubulu_madness',
    })

    // Register passive attack handler for per-attack effects (idempotent)
    if (!unit.passiveAttackHandlers.find(h => h.id === 'tapubulu_madness')) {
      const handler: PassiveAttackHandler = {
        id: 'tapubulu_madness',
        onAttack: (src, tgt, st) => {
          // Every attack: bonus true damage = truePct × current HP
          const bonusDmg = Math.round(src.currentHp * truePct)
          if (bonusDmg > 0) {
            applyDamage(src, tgt, {
              baseAmount: bonusDmg,
              damageType: 'true',
              canCrit: false,
              abilityId: 'tapubulu_natures_madness',
            }, st)
          }

          // Every 3rd attack: heal Tapu Bulu + allies if grassy terrain
          if (src.attackCount % 3 === 0) {
            const actual = Math.min(healAmount, src.maxHp - src.currentHp)
            if (actual > 0) {
              src.currentHp += actual
              st.events.push({ type: 'heal', targetId: src.id, amount: actual, sourceId: src.id, abilityId: 'tapubulu_natures_madness' })
            }

            if (st.terrain.grassy) {
              for (const ally of st.units.values()) {
                if (ally.id === src.id || ally.team !== src.team || ally.state === 'dead') continue
                const allyHeal = Math.min(Math.round(healAmount * 0.5), ally.maxHp - ally.currentHp)
                if (allyHeal > 0) {
                  ally.currentHp += allyHeal
                  st.events.push({ type: 'heal', targetId: ally.id, amount: allyHeal, sourceId: src.id, abilityId: 'tapubulu_natures_madness' })
                }
              }
            }
          }
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }

    state.events.push({
      type:   'shield',   // reuse shield event to log the HP gain visually
      unitId: unit.id,
      amount: unit.maxHp / 2,  // original maxHp before doubling
    })

    // Reset attack count so every-3rd heal counts from the first post-transform auto
    unit.attackCount = 0

    // Lock out future casts — Tapu Bulu only transforms once per combat
    unit.maxMana     = 0
    unit.currentMana = 0
  },
}
