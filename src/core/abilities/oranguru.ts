import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'

export const OranGuruAbility: AbilityHandler = {
  abilityId: 'oranguru_stored_power',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const waveDamageValues = [120, 180, 300] as const
    const manaGainValues   = [15,  25,  40 ] as const

    const waveDamage = waveDamageValues[tier - 1]
    const manaGain   = manaGainValues[tier - 1]

    // Closure-based wave count so we don't add arbitrary fields to Unit
    let waveCount = 0

    const handlerId = `oranguru_wave_${unit.id}_${state.tick}`

    // Passive attack handler — fires wave damage on each auto attack
    const handler = {
      id: handlerId,
      onAttack(src: Unit, tgt: Unit, st: CombatState): void {
        if (tgt.state === 'dead') return

        applyDamage(src, tgt, {
          baseAmount: waveDamage,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'oranguru_stored_power',
        }, st)

        waveCount++
        if (waveCount % 5 === 0) {
          src.currentMana = Math.min(src.maxMana, src.currentMana + manaGain)
        }
      },
    }

    unit.passiveAttackHandlers.push(handler)

    // Status effect tracks the 5-second duration; on expiry, remove the handler
    addStatusEffect(unit, {
      id: 'oranguru_stored_power',
      sourceUnitId: unit.id,
      durationTicks: 5 * TICK_RATE,
      stackId: 'oranguru_stored_power',
      onExpire: (u: Unit, _st: CombatState) => {
        u.passiveAttackHandlers = u.passiveAttackHandlers.filter(h => h.id !== handlerId)
      },
    })
  },
}
