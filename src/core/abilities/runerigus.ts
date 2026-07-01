import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { addStatusEffect } from '../systems/statusEffect'
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

    for (const target of targets) {
      addStatusEffect(target, {
        id:            'silence',
        sourceUnitId:  unit.id,
        durationTicks: -1,
        magnitude:     dmg,
        stackId:       'runerigus_wandering_spirit',
      })
      target.silenced = true
      state.events.push({ type: 'vfx', effectId: 'wandering_spirit_mark_apply', unitId: unit.id, targetId: target.id })
    }
  },
}
