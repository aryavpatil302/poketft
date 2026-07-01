import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { hexDistance } from '../hexGrid'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'

const BORROW_PCT          = 0.33
const BUFF_DURATION_TICKS = 5 * TICK_RATE
const PROJ_SPEED          = 10

function findNearestAlly(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.id === unit.id || other.team !== unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

export const StonjournerAbility: AbilityHandler = {
  abilityId: 'stonjourner_power_spot',
  castTimeTicks: 30,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const healAmounts = [250, 350, 450] as const
    const healAmount  = healAmounts[tier - 1]

    const ally = findNearestAlly(unit, state)
    if (!ally) return

    const allyDef   = ally._computedStats?.defense   ?? ally.defense
    const allySpDef = ally._computedStats?.spDefense ?? ally.spDefense
    const flatDef   = Math.round(allyDef   * BORROW_PCT)
    const flatSpDef = Math.round(allySpDef * BORROW_PCT)

    // Projectile flies from the ally to Stonjourner; heal + buff apply on arrival
    const proj = createProjectile({
      sourceId:  unit.id,
      targetId:  unit.id,
      startPos:  { ...ally.visualPos },
      speed:     PROJ_SPEED,
      hitRadius: 14,
      abilityId: 'stonjourner_power_spot',
      onHit: (_src, target, st) => {
        applyHeal(target, healAmount, target.id, st)
        addStatusEffect(target, {
          id:            'armorBuff',
          sourceUnitId:  target.id,
          magnitude:     flatDef,
          durationTicks: BUFF_DURATION_TICKS,
          stackId:       'stonjourner_def',
        })
        addStatusEffect(target, {
          id:            'spDefBuff',
          sourceUnitId:  target.id,
          magnitude:     flatSpDef,
          durationTicks: BUFF_DURATION_TICKS,
          stackId:       'stonjourner_spdef',
        })
        st.events.push({ type: 'vfx', effectId: 'stonjourner_rock_hit', unitId: target.id })
      },
    })
    state.projectiles.set(proj.id, proj)
  },
}
