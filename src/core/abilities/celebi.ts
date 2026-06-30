import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addMark } from '../systems/marks'
import { addStatusEffect } from '../systems/statusEffect'

function findNearestUnmarkedEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    if (other.marks.some(m => m.id.startsWith('celebi_mark_'))) continue
    const dx = other.visualPos.x - unit.visualPos.x
    const dy = other.visualPos.y - unit.visualPos.y
    const d  = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

export const CelebiAbility: AbilityHandler = {
  abilityId: 'celebi_future_sight',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageMults  = [0.10, 0.20, 0.30] as const
    const detonDamages = [450,  600,  900 ] as const

    const mult   = damageMults[tier - 1]
    const detDmg = detonDamages[tier - 1]

    // Hop + spin animation on cast
    addStatusEffect(unit, {
      id: 'celebi_hop',
      sourceUnitId: unit.id,
      durationTicks: 20,
      magnitude: 20,
      stackId: 'celebi_hop',
    })

    const target = findNearestUnmarkedEnemy(unit, state)
    if (!target) return

    // Amplify all incoming damage on target
    target.incomingDamageMult = 1 + mult

    state.events.push({
      type: 'vfx',
      effectId: 'celebi_mark_apply',
      unitId: target.id,
      x: target.visualPos.x,
      y: target.visualPos.y,
    })

    addMark(target, {
      id: `celebi_mark_${target.id}`,
      sourceUnitId: unit.id,
      durationTicks: 2 * TICK_RATE,
      onDetonate: (marked: Unit, source: Unit | undefined, st: CombatState) => {
        marked.incomingDamageMult = 1.0
        // Damage fires even if Celebi died — use marked as dummy source since
        // baseAmount is flat and canCrit: false so source stats don't matter
        applyDamage(source ?? marked, marked, {
          baseAmount: detDmg,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'celebi_future_sight',
        }, st)
      },
    })
  },
}
