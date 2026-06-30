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
    const shieldValues    = [350, 430, 550] as const
    const baseDamages     = [50,  100, 150] as const
    const manaDrainValues = [2,   3,   5  ] as const

    const shieldAmount = shieldValues[tier - 1]
    const baseDamage   = baseDamages[tier - 1]
    const manaDrain    = manaDrainValues[tier - 1]

    // Rumble on cast
    addStatusEffect(unit, {
      id: 'morgrem_rumble',
      sourceUnitId: unit.id,
      durationTicks: 14,
      magnitude: 14,
      stackId: 'morgrem_rumble',
    })

    // Shield (3 seconds)
    const shield: Shield = {
      id: `morgrem_shield_${unit.id}_${state.tick}`,
      sourceAbility: 'morgrem_spirit_break',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: 3 * TICK_RATE,
    }
    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmount })

    // Aura: drains mana from enemies in 1-hex radius every 0.5s for 3s
    let totalDrained = 0

    addStatusEffect(unit, {
      id: 'morgrem_spirit_break_aura',
      sourceUnitId: unit.id,
      durationTicks: 3 * TICK_RATE,
      magnitude: 0,
      stackId: 'morgrem_spirit_break_aura',
      suppressManaGain: true,
      tickInterval: Math.round(TICK_RATE / 2),
      tickEffect: (u: Unit, _st: CombatState) => {
        for (const other of _st.units.values()) {
          if (other.team === u.team || other.state === 'dead') continue
          if (hexDistance(u.hexPos, other.hexPos) > 1) continue
          const drained = Math.min(other.currentMana, manaDrain)
          other.currentMana = Math.max(0, other.currentMana - drained)
          totalDrained += drained
        }
      },
      onExpire: (u: Unit, st: CombatState) => {
        const strikeTarget = (() => {
          const t = u.targetId ? st.units.get(u.targetId) : undefined
          return (t && t.currentHp > 0 && t.team !== u.team) ? t : findNearestEnemy(u, st)
        })()

        const finalDamage = baseDamage + totalDrained
        let slapElapsed = 0
        let damageFired = false
        const capturedTarget = strikeTarget

        // Add slap animation — damage fires at midpoint (tick 10)
        addStatusEffect(u, {
          id: 'morgrem_slap',
          sourceUnitId: u.id,
          durationTicks: 20,
          magnitude: 20,
          stackId: 'morgrem_slap',
          suppressManaGain: true,
          tickEffect: (u2: Unit, st2: CombatState) => {
            slapElapsed++
            if (!damageFired && slapElapsed >= 10) {
              damageFired = true
              if (capturedTarget && capturedTarget.currentHp > 0) {
                applyDamage(u2, capturedTarget, {
                  baseAmount: finalDamage,
                  damageType: 'magic',
                  canCrit: false,
                  abilityId: 'morgrem_spirit_break',
                }, st2)
              }
            }
          },
        })
      },
    })
  },
}
