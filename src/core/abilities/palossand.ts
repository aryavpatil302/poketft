import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexId } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'
import { incrementSpellBuff } from '../systems/spellBuff'

export const PalossandAbility: AbilityHandler = {
  abilityId: 'palossand_scorching_sands',
  castTimeTicks: 8,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const targetCounts  = [3, 3, 4] as const
    const damages       = [75, 150, 300] as const
    const BURN_DURATION = 4 * TICK_RATE

    const count  = targetCounts[tier - 1]
    const damage = damages[tier - 1]

    const targets = findNearestEnemies(unit, state, count)

    for (const target of targets) {
      // Sand erupts under each target's feet
      state.events.push({ type: 'vfx', effectId: 'scorching_sands', unitId: target.id, x: target.visualPos.x, y: target.visualPos.y })

      applyDamage(unit, target, {
        baseAmount: damage,
        damageType: 'magic',
        canCrit: false,
        abilityId: 'palossand_scorching_sands',
      }, state)

      if (target.state === 'dead') continue

      // 1% max HP per second — will scale with SpellBuff% when beachy trait is wired
      const burnPerSec = Math.round(target.maxHp * 0.01)
      addStatusEffect(target, {
        id: 'burn',
        sourceUnitId: unit.id,
        durationTicks: BURN_DURATION,
        magnitude: burnPerSec,
        tickInterval: TICK_RATE,
        tickEffect: (u, st) => {
          u.currentHp = Math.max(0, u.currentHp - burnPerSec)
          st.events.push({ type: 'damage', targetId: u.id, amount: burnPerSec, damageType: 'true', isCrit: false, sourceId: unit.id, abilityId: 'palossand_scorching_sands' })
          if (u.currentHp <= 0) {
            u.currentHp = 0; u.state = 'dead'
            st.hexOccupancy.delete(hexId(u.hexPos))
            st.events.push({ type: 'death', unitId: u.id, sourceId: unit.id, abilityId: 'palossand_scorching_sands' })
          }
        },
        stackId: `palossand_burn_${target.id}`,
      })
    }

    incrementSpellBuff(unit, state)
  },
}
