import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { releaseHexes } from '../systems/movement'
import { findNearestEnemies } from '../systems/targeting'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'

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

    const spellBuff = getSpellBuff(unit, state)
    // Burn rate: 1% of max HP per second baseline, +1% per spell buff stack
    const burnPct = 0.01 + spellBuff * 0.01
    // Beachy's share of each burn tick: the spell-buff % above the 1% baseline.
    const burnBeachyFrac = burnPct > 0 ? (spellBuff * 0.01) / burnPct : 0

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

      const burnPerSec = Math.max(1, Math.round(target.maxHp * burnPct))
      addStatusEffect(target, {
        id: 'burn',
        sourceUnitId: unit.id,
        durationTicks: BURN_DURATION,
        magnitude: burnPerSec,
        tickInterval: TICK_RATE,
        tickEffect: (u, st) => {
          const dealt = Math.min(u.currentHp, burnPerSec)
          u.currentHp = Math.max(0, u.currentHp - burnPerSec)
          st.events.push({ type: 'damage', targetId: u.id, amount: burnPerSec, damageType: 'true', isCrit: false, sourceId: unit.id, abilityId: 'palossand_scorching_sands' })
          if (burnBeachyFrac > 0) unit.traitDmg.beachy = (unit.traitDmg.beachy ?? 0) + dealt * burnBeachyFrac
          if (u.currentHp <= 0) {
            u.currentHp = 0; u.state = 'dead'
            releaseHexes(u, st)
            st.events.push({ type: 'death', unitId: u.id, sourceId: unit.id, abilityId: 'palossand_scorching_sands' })
          }
        },
        stackId: `palossand_burn_${target.id}`,
      })
    }

    // Regen: palossand.maxHp * spellBuff * 1.5% total over the burn duration
    const totalHeal = Math.min(Math.round(unit.maxHp * 0.5), Math.round(unit.maxHp * spellBuff * 0.03))
    if (totalHeal > 0) {
      const healPerTick = Math.round(totalHeal / 4)  // spread evenly across 4 seconds
      const palossandId = unit.id
      addStatusEffect(unit, {
        id: 'palossand_regen',
        sourceUnitId: palossandId,
        durationTicks: BURN_DURATION,
        tickInterval: TICK_RATE,
        stackId: 'palossand_regen',
        tickEffect: (u, st) => {
          applyHeal(u, healPerTick, palossandId, st)
        },
      })
    }

    incrementSpellBuff(unit, state)
  },
}
