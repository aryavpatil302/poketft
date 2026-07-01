import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId, hexDistance } from '../hexGrid'

declare module '../types' {
  interface Unit {
    _spiritombMarkedIds?: Set<string>
  }
}

const AURA_INTERVAL = TICK_RATE  // 60 ticks = 1 second

function applyAuraDamage(spiritomb: Unit, state: CombatState, dmg: number, heal: number): void {
  for (const hex of hexesInRange(spiritomb.hexPos, 1)) {
    const uid = state.hexOccupancy.get(hexId(hex))
    if (!uid) continue
    const target = state.units.get(uid)
    if (!target || target.team === spiritomb.team || target.state === 'dead') continue
    applyDamage(spiritomb, target, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityId: 'spiritomb_destiny_bond' }, state)
    applyHeal(spiritomb, heal, spiritomb.id, state)
  }
}

export const SpiritombAbility: AbilityHandler = {
  abilityId: 'spiritomb_destiny_bond',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dmgValues  = [75,  100, 500] as const
    const healValues = [20,  40,  100] as const
    const dmg  = dmgValues[tier - 1]
    const heal = healValues[tier - 1]
    const spiritombId = unit.id

    // ── Passive aura (permanent, set up once per cast to refresh closure over tier) ──
    addStatusEffect(unit, {
      id:           'spiritomb_destiny_aura',
      sourceUnitId: unit.id,
      durationTicks: -1,
      tickInterval:  AURA_INTERVAL,
      stackId:      'spiritomb_destiny_aura',
      tickEffect:   (u, st) => applyAuraDamage(u, st, dmg, heal),
    })

    // ── Mark nearest enemy outside 1-hex radius that hasn't been marked before ──
    // Marks are permanent and stack — each cast adds a new mark without removing old ones.
    const markedIds = (unit._spiritombMarkedIds ??= new Set<string>())
    let markTarget: Unit | null = null
    let bestDist = Infinity
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      if (markedIds.has(other.id)) continue  // already marked once — pick a new unit
      const d = hexDistance(unit.hexPos, other.hexPos)
      if (d <= 1) continue  // must be outside the aura
      if (d < bestDist) { bestDist = d; markTarget = other }
    }

    if (markTarget) {
      markedIds.add(markTarget.id)
      const capturedTarget = markTarget
      addStatusEffect(capturedTarget, {
        id:           'spiritomb_destiny_mark',
        sourceUnitId: unit.id,
        durationTicks: -1,
        tickInterval:  AURA_INTERVAL,
        stackId:      'spiritomb_destiny_mark',
        tickEffect:   (u, st) => {
          const spiritomb = st.units.get(spiritombId)
          if (!spiritomb || spiritomb.state === 'dead') return
          applyDamage(spiritomb, u, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityId: 'spiritomb_destiny_bond' }, st)
          applyHeal(spiritomb, heal, spiritomb.id, st)
        },
      })

      state.events.push({ type: 'vfx', effectId: 'spiritomb_mark_apply', unitId: unit.id, targetId: capturedTarget.id })
    }
  },
}
