import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { createProjectile } from '../projectile'
import { findNearestEnemies } from '../systems/targeting'
import { addStatusEffect } from '../systems/statusEffect'
import { computeStats } from '../unitFactory'
import { incrementSpellBuff } from '../systems/spellBuff'
import { hexDistance } from '../hexGrid'

const LAUNCH_STAGGER = 5  // ticks between successive fireball launches

export const TyphlosionAbility: AbilityHandler = {
  abilityId: 'typhlosion_eruption',
  // Fireballs launch at tick 15 — during the stretch phase of the squash_launch animation
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [200, 350, 500] as const
    const targetCounts = [1, 2, 3] as const

    const targetCount  = targetCounts[tier - 1]
    const inRange      = (u: Unit) => hexDistance(unit.hexPos, u.hexPos) <= unit.range
    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const primary      = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team && inRange(attackTarget))
      ? attackTarget
      : null
    const rest = findNearestEnemies(unit, state, targetCount + 1)
      .filter(u => inRange(u) && u.id !== primary?.id)
      .slice(0, targetCount - (primary ? 1 : 0))
    const targets = primary ? [primary, ...rest] : rest
    if (targets.length === 0) return

    const stats      = computeStats(unit)
    const baseAmount = Math.round(stats.attack * (damageValues[tier - 1] / 100))

    const launchAt = (tgt: Unit, delay: number) => {
      const dx = tgt.visualPos.x - unit.visualPos.x
      const dy = tgt.visualPos.y - unit.visualPos.y
      const launchDist = Math.sqrt(dx * dx + dy * dy)

      const fire = (st: CombatState) => {
        const liveTgt = st.units.get(tgt.id)
        if (!liveTgt || liveTgt.state === 'dead') return
        const proj = createProjectile({
          sourceId: unit.id,
          targetId: tgt.id,
          startPos: { ...unit.visualPos },
          speed: 6,
          arcHeight: 120,
          launchDist,
          damagePayload: { baseAmount, damageType: 'physical', canCrit: false },
          abilityId: 'typhlosion_eruption',
        })
        st.projectiles.set(proj.id, proj)
      }

      if (delay === 0) {
        fire(state)
      } else {
        addStatusEffect(unit, {
          id: 'typhlosion_launch',
          sourceUnitId: unit.id,
          durationTicks: delay,
          stackId: `typhlosion_launch_${state.tick}_${tgt.id}`,
          onExpire: (_u, st) => fire(st),
        })
      }
    }

    targets.forEach((tgt, i) => launchAt(tgt, i * LAUNCH_STAGGER))

    incrementSpellBuff(unit, state)
  },
}
