import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexId } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'

export const FezandiptiAbility: AbilityHandler = {
  abilityId: 'fezandipiti_toxic_chain',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const targetCounts = [2, 3, 4] as const
    const hpArmors     = [150, 225, 350] as const

    const count   = targetCounts[tier - 1]
    const hpBonus = hpArmors[tier - 1]

    const targets = findNearestEnemies(unit, state, count)

    for (const target of targets) {
      let damage = 50
      let tick   = 0

      addStatusEffect(target, {
        id: 'poison',
        sourceUnitId: unit.id,
        durationTicks: 4 * TICK_RATE,
        magnitude: 50,
        tickInterval: TICK_RATE,
        tickEffect: (u, st) => {
          u.currentHp = Math.max(0, u.currentHp - damage)
          st.events.push({ type: 'damage', targetId: u.id, amount: damage, damageType: 'magic', isCrit: false, sourceId: unit.id })
          if (u.currentHp <= 0) {
            u.currentHp = 0; u.state = 'dead'
            st.hexOccupancy.delete(hexId(u.hexPos))
            st.events.push({ type: 'death', unitId: u.id, sourceId: unit.id, abilityId: 'fezandipiti_toxic_chain' })
          }
          damage *= 2  // double each second
          tick++
        },
        onExpire: (u, st) => {
          if (u.state === 'dead') return
          addStatusEffect(u, { id: 'stun', sourceUnitId: unit.id, durationTicks: 1.5 * TICK_RATE, stackId: `fez_stun_${u.id}`, onExpire: (x) => { if (x.state === 'stunned') x.state = 'idle' } })
        },
        stackId: `fez_chain_${target.id}_${state.tick}`,
      })
    }

    // Durability buff
    unit.maxHp     += hpBonus
    unit.currentHp += hpBonus
    addStatusEffect(unit, { id: 'armorBuff', sourceUnitId: unit.id, durationTicks: 4 * TICK_RATE, magnitude: hpBonus / 10, stackId: 'fez_armorBuff' })
  },
}
