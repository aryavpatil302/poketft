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

// shinyFrac / shinyHealTag: when the caster is shiny, dmg & heal here have been
// scaled ×1.5 — attribute the marginal 0.5/1.5 of each damage hit and the full
// scaled heal to the shiny rollup (applyHeal has no fractional-credit param).
function applyAuraDamage(
  spiritomb: Unit,
  state: CombatState,
  dmg: number,
  heal: number,
  shinyFrac?: { trait: string; frac: number },
  shinyHealTag?: string,
): void {
  for (const hex of hexesInRange(spiritomb.hexPos, 1)) {
    const uid = state.hexOccupancy.get(hexId(hex))
    if (!uid) continue
    const target = state.units.get(uid)
    if (!target || target.team === spiritomb.team || target.state === 'dead') continue
    applyDamage(spiritomb, target, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'spiritomb_destiny_bond', traitFrac: shinyFrac }, state)
    applyHeal(spiritomb, heal, spiritomb.id, state, shinyHealTag)
  }
}

export const SpiritombAbility: AbilityHandler = {
  abilityId: 'spiritomb_destiny_bond',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dmgValues  = [75,  100, 500] as const
    const healValues = [20,  40,  100] as const
    let dmg: number  = dmgValues[tier - 1]
    let heal: number = healValues[tier - 1]
    // Shiny Spiritomb: Destiny Bond aura's damage AND healing amplified
    // ×1.5. Both the passive aura tick and the per-mark tick below close
    // over these same locals, so this one insertion point covers both
    // consumers.
    if (unit.isShiny) {
      dmg  = Math.round(dmg * 1.5)
      heal = Math.round(heal * 1.5)
    }
    const spiritombId = unit.id
    const shinyTag  = unit.isShiny ? 'shiny:' + unit.definitionId : undefined
    const shinyFrac = shinyTag ? { trait: shinyTag, frac: 1 / 3 } as const : undefined

    // ── Passive aura (permanent, set up once per cast to refresh closure over tier) ──
    addStatusEffect(unit, {
      id:           'spiritomb_destiny_aura',
      sourceUnitId: unit.id,
      durationTicks: -1,
      tickInterval:  AURA_INTERVAL,
      stackId:      'spiritomb_destiny_aura',
      tickEffect:   (u, st) => applyAuraDamage(u, st, dmg, heal, shinyFrac, shinyTag),
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
          applyDamage(spiritomb, u, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'spiritomb_destiny_bond', traitFrac: shinyFrac }, st)
          applyHeal(spiritomb, heal, spiritomb.id, st, shinyTag)
        },
      })

      state.events.push({ type: 'vfx', effectId: 'spiritomb_mark_apply', unitId: unit.id, targetId: capturedTarget.id })
    }
  },
}
