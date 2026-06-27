import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
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

export const MorgremAbility: AbilityHandler = {
  abilityId: 'morgrem_spirit_break',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues  = [120, 180, 280] as const
    const damageValues  = [150, 225, 350] as const

    const shieldAmount = shieldValues[tier - 1]
    const burstDamage  = damageValues[tier - 1]
    const casterId     = unit.id
    const casterTeam   = unit.team

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemy(unit, state)

    // Apply mana drain tickEffect on nearest enemy for 4 sec
    if (target) {
      addStatusEffect(target, {
        id: 'taunt',
        sourceUnitId: unit.id,
        durationTicks: 4 * TICK_RATE,
        magnitude: 5,
        tickInterval: TICK_RATE,
        tickEffect: (u: Unit) => {
          u.currentMana = Math.max(0, u.currentMana - 5)
        },
        onExpire: (u: Unit, st: CombatState) => {
          // Find nearest enemy of the original caster and deal burst damage
          let blastTarget: Unit | null = null
          let bestDist = Infinity
          const casterUnit = st.units.get(casterId)
          if (!casterUnit || casterUnit.state === 'dead') return
          for (const other of st.units.values()) {
            if (other.team === casterTeam || other.state === 'dead') continue
            const d = hexDistance(casterUnit.hexPos, other.hexPos)
            if (d < bestDist) { bestDist = d; blastTarget = other }
          }
          if (blastTarget) {
            applyDamage(casterUnit, blastTarget, {
              baseAmount: burstDamage,
              damageType: 'magic',
              canCrit: false,
              abilityId: 'morgrem_spirit_break',
            }, st)
          }
        },
        stackId: `morgrem_spirit_break_${target.id}_${state.tick}`,
      })
    }

    // Grant self a shield
    const shieldId = `morgrem_spirit_break_shield_${unit.id}_${state.tick}`
    const shield: Shield = {
      id: shieldId,
      sourceAbility: 'morgrem_spirit_break',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: 4 * TICK_RATE,
    }
    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmount })
  },
}
