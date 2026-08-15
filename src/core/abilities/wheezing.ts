import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId } from '../hexGrid'

const PULSE_INTERVAL = Math.round(TICK_RATE * 0.5)  // 0.5s between puffs
const DURATION_TICKS = 5 * TICK_RATE                // 5-second window

export const WheezingAbility: AbilityHandler = {
  abilityId: 'wheezing_poison_gas',
  castTimeTicks: 15,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const damageValues = [8,   10,  12]  as const
    const healValues   = [50,  75,  200] as const

    const dmg        = damageValues[tier - 1]
    const healPerHit = healValues[tier - 1]
    const wheezingId = unit.id

    // Pin manaLockTimer > 0 every tick so Wheezing can't gain mana during the gas window.
    // Value of 2 ensures it survives tickManaLock's decrement (2→1, still > 0).
    addStatusEffect(unit, {
      id: 'wheezing_mana_suppressed',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      stackId: 'wheezing_mana_suppressed',
      tickEffect: (u: Unit) => { u.manaLockTimer = Math.max(u.manaLockTimer, 2) },
    })

    addStatusEffect(unit, {
      id: 'wheezing_gas_active',
      sourceUnitId: unit.id,
      durationTicks: DURATION_TICKS,
      stackId: 'wheezing_gas_active',
      tickInterval: PULSE_INTERVAL,
      tickEffect: (_u: Unit, st: CombatState) => {
        const wheezing = st.units.get(wheezingId)
        if (!wheezing || wheezing.state === 'dead') return

        // Smog puff VFX — effectLayer spawns 6 particles flying outward
        st.events.push({ type: 'vfx', effectId: 'wheezing_gas_puff', x: wheezing.visualPos.x, y: wheezing.visualPos.y })

        let hitCount = 0
        for (const hex of hexesInRange(wheezing.hexPos, 1)) {
          const occupantId = st.hexOccupancy.get(hexId(hex))
          if (!occupantId) continue
          const target = st.units.get(occupantId)
          if (!target || target.team === wheezing.team || target.state === 'dead') continue

          applyDamage(wheezing, target, {
            baseAmount: dmg,
            damageType: 'magic',
            canCrit: false,
            scalingStat: 'special',
            scalingRatio: 0,
            abilityId: 'wheezing_poison_gas',
          }, st)

          // 30% armor/MR reduction — refreshes each pulse, doesn't stack
          addStatusEffect(target, {
            id: 'sunder_pct',
            sourceUnitId: wheezingId,
            durationTicks: 180,
            magnitude: 0.30,
            stackId: `wheezing_sunder_${target.id}`,
          })
          addStatusEffect(target, {
            id: 'shred_pct',
            sourceUnitId: wheezingId,
            durationTicks: 180,
            magnitude: 0.30,
            stackId: `wheezing_shred_${target.id}`,
          })

          hitCount++
        }

        if (hitCount > 0) {
          applyHeal(wheezing, healPerHit * hitCount, wheezingId, st)
        }
      },
    })
  },
}
