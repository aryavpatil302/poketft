import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { getNeighbors, isValidHex, hexId, hexDistance } from '../hexGrid'
import { startLeap } from '../systems/movement'
import { addStatusEffect } from '../systems/statusEffect'

const STRIKE_ANIM_TICKS = 16
const DAMAGE_TICK        = 8   // fires at progress=0.5 → 180° into the spin

export const BarraskewdaAbility: AbilityHandler = {
  abilityId: 'barraskewda_fishous_rend',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const baseDamages = [200, 320, 550] as const
    const base = baseDamages[tier - 1]

    // Find lowest-HP enemy within 2 hexes
    let target: Unit | null = null
    let bestHp = Infinity
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (hexDistance(unit.hexPos, other.hexPos) > 2) continue
      if (other.currentHp < bestHp) { bestHp = other.currentHp; target = other }
    }
    if (!target && unit.targetId) target = state.units.get(unit.targetId) ?? null
    if (!target || target.state === 'dead') return

    // Reduce own mana cost on successive casts (floor 20)
    unit.maxMana = Math.max(20, unit.maxMana - 10)
    unit.currentMana = Math.min(unit.currentMana, unit.maxMana)

    const capturedTarget = target

    const onLand = (u: Unit, _st: CombatState) => {
      u.targetId = capturedTarget.id

      let elapsed = 0
      let damageFired = false

      addStatusEffect(u, {
        id: 'barraskewda_strike',
        sourceUnitId: u.id,
        durationTicks: STRIKE_ANIM_TICKS,
        magnitude: STRIKE_ANIM_TICKS,
        stackId: 'barraskewda_strike',
        tickEffect: (u2: Unit, st2: CombatState) => {
          elapsed++
          if (!damageFired && elapsed >= DAMAGE_TICK) {
            damageFired = true
            if (capturedTarget.currentHp > 0) {
              const damage = capturedTarget.currentHp < capturedTarget.maxHp / 2
                ? Math.round(base * 1.5)
                : base
              applyDamage(u2, capturedTarget, {
                baseAmount: damage,
                damageType: 'physical',
                canCrit: true,
                abilityId: 'barraskewda_fishous_rend',
              }, st2)
            }
          }
        },
      })
    }

    // Dash to adjacent hex; on landing deal damage at 180° of the strike spin
    const candidates = getNeighbors(capturedTarget.hexPos).filter(h => {
      if (!isValidHex(h)) return false
      const occ = state.hexOccupancy.get(hexId(h))
      return !occ || occ === unit.id
    })

    if (candidates.length > 0) {
      startLeap(unit, candidates[0], state, 5.0, onLand)
      unit.state = 'leaping'
    } else {
      onLand(unit, state)
    }
  },
}
