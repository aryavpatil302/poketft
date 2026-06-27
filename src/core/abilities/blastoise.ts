import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'
import { computeStats } from '../unitFactory'

const SECOND_SHOT_DELAY = 7  // ticks (~0.12s) between first and second cannon

export const BlastoiseAbility: AbilityHandler = {
  abilityId: 'blastoise_hydro_cannons',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const atkSpdBonuses = [0.50, 0.75, 20.00] as const
    const dmgRatios     = [0.75, 1.00, 5.00]  as const

    const atkSpdBonus = atkSpdBonuses[tier - 1]
    const dmgRatio    = dmgRatios[tier - 1]

    addStatusEffect(unit, {
      id: 'atkSpd_buff',
      sourceUnitId: unit.id,
      durationTicks: 5 * TICK_RATE,
      magnitude: atkSpdBonus,
      stackId: 'blastoise_hydro_atkspd',
    })

    addStatusEffect(unit, {
      id: 'blastoise_mode',
      sourceUnitId: unit.id,
      durationTicks: 5 * TICK_RATE,
      stackId: 'blastoise_mode',
      onExpire: (u) => {
        u.passiveAttackHandlers = u.passiveAttackHandlers.filter(h => h.id !== 'blastoise_hydro')
      },
    })

    state.events.push({ type: 'vfx', effectId: 'blastoise_sway', unitId: unit.id })

    const handler: PassiveAttackHandler = {
      id: 'blastoise_hydro',
      suppressBaseAttack: true,
      onAttack: (src: Unit, tgt: Unit, st: CombatState) => {
        if (!src.statusEffects.some(fx => fx.id === 'blastoise_mode')) {
          src.passiveAttackHandlers = src.passiveAttackHandlers.filter(h => h.id !== 'blastoise_hydro')
          return
        }
        const stats  = computeStats(src)
        const spBuff = getSpellBuff(src, st)
        const dmg    = Math.round(stats.attack * dmgRatio * (1 + spBuff * 0.05))
        const srcId  = src.id
        const tgtId  = tgt.id
        const startPos = { ...src.visualPos }

        // First shot — immediate
        const proj1 = createProjectile({
          sourceId: srcId,
          targetId: tgtId,
          startPos,
          speed: 18,
          damagePayload: { baseAmount: dmg, damageType: 'magic', canCrit: false },
          abilityId: 'blastoise_hydro_cannons',
        })
        st.projectiles.set(proj1.id, proj1)

        // Second shot — fires exactly SECOND_SHOT_DELAY ticks later via onExpire
        // Each shot gets a unique stackId so concurrent pending shots don't clobber each other
        addStatusEffect(src, {
          id: 'blastoise_second_shot',
          sourceUnitId: srcId,
          durationTicks: SECOND_SHOT_DELAY,
          stackId: `blastoise_shot_${st.tick}_${srcId}`,
          onExpire: (_u, st2) => {
            const liveTgt = st2.units.get(tgtId)
            if (!liveTgt || liveTgt.state === 'dead') return
            const proj2 = createProjectile({
              sourceId: srcId,
              targetId: tgtId,
              startPos,
              speed: 18,
              damagePayload: { baseAmount: dmg, damageType: 'magic', canCrit: false },
              abilityId: 'blastoise_hydro_cannons',
            })
            st2.projectiles.set(proj2.id, proj2)
          },
        })
      },
    }

    unit.passiveAttackHandlers = unit.passiveAttackHandlers.filter(h => h.id !== 'blastoise_hydro')
    unit.passiveAttackHandlers.push(handler)

    incrementSpellBuff(unit, state)
  },
}
