import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { hexDistance } from '../hexGrid'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'

const MAX_RANGE = 2

function findTargetsInRange(unit: Unit, state: CombatState, count: number): Unit[] {
  return [...state.units.values()]
    .filter(u => u.team !== unit.team && u.state !== 'dead' && hexDistance(unit.hexPos, u.hexPos) <= MAX_RANGE)
    .sort((a, b) => hexDistance(unit.hexPos, a.hexPos) - hexDistance(unit.hexPos, b.hexPos))
    .slice(0, count)
}

export const VenusaurAbility: AbilityHandler = {
  abilityId: 'venusaur_leech_seed',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const targetCounts  = [2, 2, 3] as const
    const damagePerSec  = [80, 100, 120] as const

    const count  = targetCounts[tier - 1]
    const damage = damagePerSec[tier - 1]

    const targets = findTargetsInRange(unit, state, count)

    for (const target of targets) {
      const dx = target.visualPos.x - unit.visualPos.x
      const dy = target.visualPos.y - unit.visualPos.y
      const launchDist = Math.sqrt(dx * dx + dy * dy)

      const proj = createProjectile({
        sourceId: unit.id,
        targetId: target.id,
        startPos: { ...unit.visualPos },
        speed: 5,
        arcHeight: 55,
        launchDist,
        abilityId: 'venusaur_leech_seed',
        onHit: (_source, tgt, _state) => {
          // addStatusEffect refreshes duration automatically via stackId match
          addStatusEffect(tgt, {
            id: 'leech_seed',
            sourceUnitId: unit.id,
            durationTicks: 180,   // 3 seconds
            magnitude: damage,
            stackId: `leech_seed_${tgt.id}`,
          })
        },
      })
      state.projectiles.set(proj.id, proj)
    }
  },
}
