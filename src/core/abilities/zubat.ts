import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { hexDistance } from '../hexGrid'

function findNearestEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

export const ZubatAbility: AbilityHandler = {
  abilityId: 'zubat_poison_sting',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues    = [100, 150, 250] as const
    const poisonDmgValues = [20,  30,  50 ] as const

    const damage    = damageValues[tier - 1]
    const poisonDmg = poisonDmgValues[tier - 1]

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemy(unit, state)
    if (!target) return

    const casterId = unit.id
    const tick     = state.tick

    const proj = createProjectile({
      sourceId: unit.id,
      targetId: target.id,
      startPos: { ...unit.visualPos },
      speed: 10,
      damagePayload: {
        baseAmount: damage,
        damageType: 'magic',
        canCrit: false,
      },
      onHit: (_source, hitTarget, hitState) => {
        if (hitTarget.state === 'dead') return
        addStatusEffect(hitTarget, {
          id: 'poison',
          sourceUnitId: casterId,
          durationTicks: 3 * TICK_RATE,
          magnitude: poisonDmg,
          tickInterval: TICK_RATE,
          tickEffect: (u: Unit, st: CombatState) => {
            u.currentHp = Math.max(0, u.currentHp - poisonDmg)
            st.events.push({
              type: 'damage',
              targetId: u.id,
              amount: poisonDmg,
              damageType: 'magic',
              isCrit: false,
              sourceId: casterId,
            })
            if (u.currentHp <= 0) {
              u.currentHp = 0
              u.state = 'dead'
              st.events.push({ type: 'death', unitId: u.id, sourceId: unit.id, abilityId: 'zubat_poison_sting' })
            }
          },
          stackId: `poison_${casterId}_${tick}`,
        })
      },
      abilityId: 'zubat_poison_sting',
    })
    state.projectiles.set(proj.id, proj)
  },
}
