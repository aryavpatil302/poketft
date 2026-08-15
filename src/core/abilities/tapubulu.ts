import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { addStatusEffect } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'

export const TapuBuluAbility: AbilityHandler = {
  abilityId: 'tapubulu_natures_madness',
  castTimeTicks: 30,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const armorValues = [30,  50,  500] as const
    const mrValues    = [30,  50,  500] as const

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

    // Grassy terrain: extra +30 defense and MR on transform
    if (state.terrain.grassy) {
      addStatusEffect(unit, {
        id:           'armorBuff',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude:    30,
        stackId:      'tapubulu_grassy_armor',
      })
      addStatusEffect(unit, {
        id:           'spDefBuff',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude:    30,
        stackId:      'tapubulu_grassy_spdef',
      })
    }

    const healValues   = [300, 500, 2000] as const
    const healAmount   = healValues[tier - 1]

    // Every 3rd strike in the empowered stage removes 50% of the target's CURRENT
    // health as true damage, and executes the target outright if it is at or below
    // 5% of its max health.
    const CHUNK_PCT         = 0.50
    const EXECUTE_THRESHOLD = 0.05

    addStatusEffect(unit, {
      id:           'tapubulu_madness',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude:    CHUNK_PCT,
      stackId:      'tapubulu_madness',
    })

    // Register passive attack handler for per-attack effects (idempotent)
    if (!unit.passiveAttackHandlers.find(h => h.id === 'tapubulu_madness')) {
      const handler: PassiveAttackHandler = {
        id: 'tapubulu_madness',
        onAttack: (src, tgt, st) => {
          // Only every 3rd strike carries the chunk/execute + heal.
          if (src.attackCount % 3 !== 0) return

          if (tgt.state !== 'dead' && tgt.team !== src.team) {
            if (tgt.currentHp <= tgt.maxHp * EXECUTE_THRESHOLD) {
              // Execute: overwhelming true damage guarantees the kill (through shields)
              applyDamage(src, tgt, {
                baseAmount: tgt.maxHp * 10,
                damageType: 'true',
                canCrit: false,
                abilityId: 'tapubulu_natures_madness',
              }, st)
            } else {
              // Chunk 50% of the target's current health
              const chunk = Math.round(tgt.currentHp * CHUNK_PCT)
              if (chunk > 0) {
                applyDamage(src, tgt, {
                  baseAmount: chunk,
                  damageType: 'true',
                  canCrit: false,
                  abilityId: 'tapubulu_natures_madness',
                }, st)
              }
            }
          }

          // Heal Tapu Bulu; under grassy terrain also heal all allies for 5% HP
          applyHeal(src, healAmount, src.id, st)
          if (st.terrain.grassy) {
            for (const ally of st.units.values()) {
              if (ally.id === src.id || ally.team !== src.team || ally.state === 'dead') continue
              applyHeal(ally, Math.round(ally.maxHp * 0.05), src.id, st)
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
