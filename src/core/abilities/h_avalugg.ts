import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'
import { computeStats } from '../unitFactory'

const AVALANCHE_DELAY = 30  // ticks between icon appearing and impact

export const HAvaluggAbility: AbilityHandler = {
  abilityId: 'h_avalugg_mountain_gale',
  castTimeTicks: 25,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dmgPcts     = [120, 175, 285] as const
    const stunSeconds = [1.5, 2.0, 3.0] as const

    const dmgPct    = dmgPcts[tier - 1]
    const stunTicks = Math.round(stunSeconds[tier - 1] * TICK_RATE)
    const casterId  = unit.id

    const targets = findNearestEnemies(unit, state, 3)

    // Tell effectLayer to draw hovering → falling avalanche icons above each target
    state.events.push({
      type: 'vfx',
      effectId: 'h_avalugg_avalanche',
      positions: targets.map(t => ({ x: t.visualPos.x, y: t.visualPos.y, unitId: t.id })),
      hoverTicks: AVALANCHE_DELAY,
    })

    for (const target of targets) {
      const targetId = target.id
      addStatusEffect(target, {
        id: 'avalanche_pending',
        sourceUnitId: casterId,
        durationTicks: AVALANCHE_DELAY,
        stackId: `avalanche_pending_${targetId}`,
        onExpire: (tgt: Unit, st: CombatState) => {
          const src = st.units.get(casterId)
          if (!src) return
          if (tgt.state !== 'dead') {
            const srcAtk = (src._computedStats ?? computeStats(src)).attack
            applyDamage(src, tgt, {
              baseAmount: Math.round(srcAtk * dmgPct / 100),
              damageType: 'physical',
              canCrit: false,
              abilityId: 'h_avalugg_mountain_gale',
            }, st)
          }
          if (tgt.state !== 'dead') {
            addStatusEffect(tgt, {
              id: 'stun',
              sourceUnitId: casterId,
              durationTicks: stunTicks,
              stackId: `h_avalugg_stun_${targetId}`,
            })
          }
          // Squash animation on the target unit
          st.events.push({ type: 'vfx', effectId: 'h_avalugg_impact', unitId: targetId })
        },
      })
    }
  },
}
