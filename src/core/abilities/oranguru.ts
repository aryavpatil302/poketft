import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { computeStats } from '../unitFactory'
import { createProjectile } from '../projectile'
import { addStatusEffect } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'

export const OranGuruAbility: AbilityHandler = {
  abilityId: 'oranguru_stored_power',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const specialPcts  = [0.80, 1.00, 1.20] as const
    const empBonuses   = [100,  175,  300 ] as const
    const spGainValues = [1,    2,    5   ] as const
    const atkSpdBonuses = [0.20, 0.25, 0.30] as const

    const specialPct   = specialPcts[tier - 1]
    const empBonus     = empBonuses[tier - 1]
    const spGain       = spGainValues[tier - 1]
    const atkSpdBonus  = atkSpdBonuses[tier - 1]

    let waveCount = 0
    const handlerId = `oranguru_wave_${unit.id}_${state.tick}`

    const handler: PassiveAttackHandler = {
      id: handlerId,
      suppressBaseAttack: true,

      onAttack(src: Unit, tgt: Unit, st: CombatState): void {
        if (tgt.currentHp <= 0) return

        waveCount++
        const isEmp     = waveCount % 3 === 0
        const stats     = computeStats(src)
        const baseAmount = Math.round(stats.special * specialPct)

        // Permanent special stat gain on every 3rd wave
        if (isEmp) {
          const existing = src.statusEffects.find(fx => fx.stackId === 'oranguru_sp_buff')
          if (existing) {
            existing.magnitude = (existing.magnitude ?? 0) + spGain
            src._computedStats = null
          } else {
            addStatusEffect(src, {
              id: 'oranguru_sp_buff',
              sourceUnitId: src.id,
              durationTicks: -1,
              magnitude: spGain,
              stackId: 'oranguru_sp_buff',
            })
          }

          // Empowered waves also grant a 2-second attack speed buff, its
          // effectiveness scaling with Oranguru's special (100 special =
          // full 20/25/30%; higher special from his own stacking sp gain
          // makes each proc progressively stronger).
          addStatusEffect(src, {
            id: 'atkSpd_buff',
            sourceUnitId: src.id,
            durationTicks: 2 * TICK_RATE,
            magnitude: atkSpdBonus * (stats.special / 100),
            stackId: 'oranguru_wave_atkspd',
          })
        }

        const proj = createProjectile({
          sourceId: src.id,
          targetId: tgt.id,
          startPos: { ...src.visualPos },
          speed: 10,
          abilityId: isEmp ? 'oranguru_stored_power_emp' : 'oranguru_stored_power',
          damagePayload: {
            baseAmount: isEmp ? baseAmount + empBonus : baseAmount,
            damageType: 'magic',
            canCrit: true,
            abilityId: 'oranguru_stored_power',
          },
        })
        st.projectiles.set(proj.id, proj)
      },
    }

    unit.passiveAttackHandlers.push(handler)

    // Permanent marker — drives unitLayer fan animation, blocks mana gain, and never expires
    addStatusEffect(unit, {
      id: 'oranguru_stored_power',
      sourceUnitId: unit.id,
      durationTicks: -1,
      stackId: 'oranguru_stored_power',
      suppressManaGain: true,
    })
  },
}
