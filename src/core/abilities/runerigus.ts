import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { addStatusEffect, removeStatusEffectByStack } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'
import { hexDistance } from '../hexGrid'

export const RunerigusAbility: AbilityHandler = {
  abilityId: 'runerigus_wandering_spirit',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dmgValues = [550, 875, 7000] as const
    const dmg = dmgValues[tier - 1]

    const targets: Unit[] = []

    if (tier === 3) {
      // 3-star: mark every living unmarked enemy
      for (const other of state.units.values()) {
        if (other.team === unit.team || other.state === 'dead') continue
        if (other.statusEffects.some(fx => fx.stackId === 'runerigus_wandering_spirit')) continue
        targets.push(other)
      }
    } else {
      // 1-star / 2-star: nearest unmarked enemy only
      let best: Unit | null = null
      let bestDist = Infinity
      for (const other of state.units.values()) {
        if (other.team === unit.team || other.state === 'dead') continue
        if (other.statusEffects.some(fx => fx.stackId === 'runerigus_wandering_spirit')) continue
        const d = hexDistance(unit.hexPos, other.hexPos)
        if (d < bestDist) { bestDist = d; best = other }
      }
      if (best) targets.push(best)
    }

    if (targets.length === 0) return

    // Arm travel time — matches approximate VFX duration before the spirit "arrives"
    const ARM_TICKS = 30

    for (const target of targets) {
      state.events.push({ type: 'vfx', effectId: 'wandering_spirit_mark_apply', unitId: unit.id, targetId: target.id })

      // Units that can never reach full mana (no-mana dummies, permanently mana-locked, or
      // a unit like Graveler whose maxMana is the codebase's 9999 "unreachable pool" sentinel —
      // he casts once instantly off startMana === maxMana, then applyManaLock resets him to 0
      // with no realistic way back to 9999) will never trigger the normal wandering spirit via
      // triggerAbility — detonate on arrival instead.
      const neverCasts = target.maxMana === 0 || target.maxMana >= 9999 ||
        target.statusEffects.some(fx => fx.suppressManaGain && fx.durationTicks === -1)

      if (neverCasts) {
        const sourceId = unit.id
        addStatusEffect(target, {
          id:            'runerigus_wandering_spirit',
          sourceUnitId:  sourceId,
          durationTicks: ARM_TICKS,
          magnitude:     dmg,
          stackId:       'runerigus_wandering_spirit',
          onExpire: (u, st) => {
            if (u.state === 'dead') return
            removeStatusEffectByStack(u, 'runerigus_wandering_spirit')
            const src = st.units.get(sourceId) ?? u
            applyDamage(src, u, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'runerigus_wandering_spirit' }, st)
            st.events.push({ type: 'vfx', effectId: 'wandering_spirit_consume', unitId: u.id })
          },
        })
      } else {
        addStatusEffect(target, {
          id:            'silence',
          sourceUnitId:  unit.id,
          durationTicks: -1,
          magnitude:     dmg,
          stackId:       'runerigus_wandering_spirit',
        })
        target.silenced = true
      }
    }
  },
}
