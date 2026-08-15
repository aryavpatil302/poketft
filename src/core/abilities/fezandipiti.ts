import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { hexDistance } from '../hexGrid'

export const FezandiptiAbility: AbilityHandler = {
  abilityId: 'fezandipiti_toxic_chain',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damagePerSec  = [20,  30,  90  ] as const   // sec 1; doubles each sec
    const durabilityPct = [0.40, 0.50, 0.90] as const  // defense + spDef %
    const healTotals    = [370, 516, 1589] as const

    const baseDmg   = damagePerSec[tier - 1]
    const durPct    = durabilityPct[tier - 1]
    const totalHeal = healTotals[tier - 1]
    const DURATION  = 4 * TICK_RATE

    // Short rumble before chains fly
    addStatusEffect(unit, {
      id: 'fez_rumble', sourceUnitId: unit.id,
      durationTicks: 20, magnitude: 20, stackId: 'fez_rumble',
    })

    // Collect all enemies in 3-hex radius
    const targets: Unit[] = []
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (hexDistance(unit.hexPos, other.hexPos) <= 3) targets.push(other)
    }

    // Apply toxic chain to each target
    for (const target of targets) {
      let dmg = baseDmg
      let elapsed = 0

      addStatusEffect(target, {
        id: `fez_chain_${target.id}`,
        sourceUnitId: unit.id,
        durationTicks: DURATION,
        magnitude: baseDmg,
        stackId: `fez_chain_${target.id}`,
        tickEffect: (u, st) => {
          elapsed++
          if (elapsed % TICK_RATE === 0) {
            if (u.state !== 'dead') {
              applyDamage(unit, u, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'fezandipiti_toxic_chain' }, st)
            }
            dmg *= 2
          }
        },
        onExpire: (u, _st) => {
          if (u.state === 'dead') return
          addStatusEffect(u, {
            id: 'stun', sourceUnitId: unit.id,
            durationTicks: TICK_RATE,
            stackId: `fez_stun_${u.id}`,
          })
        },
      })
    }

    // Durability buff — defense + spDefense ×(1 + durPct) for 4 seconds
    // suppressManaGain: Fezandipiti cannot gain mana while chains are active
    addStatusEffect(unit, {
      id: 'fez_durability', sourceUnitId: unit.id,
      durationTicks: DURATION, magnitude: durPct, stackId: 'fez_durability',
      suppressManaGain: true,
    })
    unit._computedStats = null

    // Gradual heal over 4 seconds
    let healTick = 0
    addStatusEffect(unit, {
      id: 'fez_heal', sourceUnitId: unit.id,
      durationTicks: DURATION, stackId: 'fez_heal',
      tickEffect: (u, st) => {
        healTick++
        const target = Math.round(totalHeal * healTick / DURATION)
        const prev   = Math.round(totalHeal * (healTick - 1) / DURATION)
        const gain   = target - prev
        if (gain > 0) applyHeal(u, gain, u.id, st)
      },
    })
  },
}
