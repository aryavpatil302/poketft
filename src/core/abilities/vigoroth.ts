import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { hexDistance, hexId, getNeighbors, isValidHex } from '../hexGrid'
import { addStatusEffect, removeStatusEffect } from '../systems/statusEffect'
import { startLeap } from '../systems/movement'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

// Find the furthest enemy within `range` hexes, or null if none
function findFurthestEnemyInRange(unit: Unit, state: CombatState, range: number): Unit | null {
  let bestUnit: Unit | null = null
  let bestDist = -1

  for (const other of state.units.values()) {
    if (other.team === unit.team) continue
    if (other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d <= range && d > bestDist) {
      bestDist = d
      bestUnit = other
    }
  }

  return bestUnit
}

// Speed multiplier for the leap (passed to startLeap as hasteMagnitude)
// 4.0 → 5× base speed = ~7.5 hex/sec, ~8 ticks per hex
const LEAP_HASTE = 4.0

export const VigorothAbility: AbilityHandler = {
  abilityId: 'vigoroth_fury_swipes',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues   = [200,  350,  500 ] as const
    const atkSpdBonuses  = [0.20, 0.30, 0.50] as const
    const atkDmgBonuses  = [50,   75,   100 ] as const

    const spMult       = (unit._computedStats ?? computeStats(unit)).special / 100
    const shieldAmount = Math.round(shieldValues[tier - 1] * spMult)
    const atkSpdBonus  = atkSpdBonuses[tier - 1]
    const atkDmgBonus  = atkDmgBonuses[tier - 1]

    // Find furthest enemy within 4 hexes; fall back to current target
    const leapTarget =
      findFurthestEnemyInRange(unit, state, 4) ??
      (unit.targetId ? state.units.get(unit.targetId) ?? null : null)

    if (!leapTarget) return

    // Find a free adjacent hex next to the target to land on
    const candidates = getNeighbors(leapTarget.hexPos).filter(h => {
      if (!isValidHex(h)) return false
      const occupant = state.hexOccupancy.get(hexId(h))
      return !occupant || occupant === unit.id
    })
    candidates.sort((a, b) =>
      hexDistance(a, leapTarget.hexPos) - hexDistance(b, leapTarget.hexPos)
    )

    const dest = candidates[0]
    if (!dest) return  // no landing spot — do nothing

    // ── Straight-line pixel dash to dest ─────────────────────────────────
    // Shield and buffs are applied on landing so they can't be broken mid-flight.
    startLeap(unit, dest, state, LEAP_HASTE, (u, s) => {
      u.targetId = leapTarget.id  // lock onto the leaped unit after landing

      addStatusEffect(u, {
        id: 'atkSpd_buff',
        sourceUnitId: u.id,
        durationTicks: -1,
        magnitude: atkSpdBonus,
        stackId: 'vigoroth_atkspd',
      })
      addStatusEffect(u, {
        id: 'dmg_buff',
        sourceUnitId: u.id,
        durationTicks: -1,
        magnitude: atkDmgBonus,
        stackId: 'vigoroth_dmgbuff',
      })

      const shieldId = `vigoroth_fury_swipes_${u.id}_${s.tick}`
      const shield: Shield = {
        id: shieldId,
        sourceAbility: 'vigoroth_fury_swipes',
        value: shieldAmount,
        maxValue: shieldAmount,
        effectiveMaxHp: u.currentHp + shieldAmount,
        durationTicks: 360,   // 6 seconds
        onExpire: (expUnit: Unit) => {
          removeStatusEffect(expUnit, 'atkSpd_buff')
          removeStatusEffect(expUnit, 'dmg_buff')
        },
      }
      addShield(u, shield, s)
    })

    // Lock onto the leap target and enter leaping state
    unit.targetId = leapTarget.id
    unit.state = 'leaping'
  },
}
