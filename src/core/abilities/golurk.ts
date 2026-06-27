import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler, Shield } from '../types'
import { applyDamage } from '../systems/damage'
import { hexesInRange, hexId } from '../hexGrid'

// Golurk: every 3rd attack fires shadow punch + grants a shield
export const GolurkAbility: AbilityHandler = {
  abilityId: 'golurk_poltergeist',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages  = [120, 180, 300] as const
    const shields  = [200, 300, 500] as const
    const dmg      = damages[tier - 1]
    const shieldAmt = shields[tier - 1]

    const existing = unit.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')
    if (!existing) {
      const handler: PassiveAttackHandler = {
        id: 'golurk_shadow',
        onAttack: (src, tgt, st) => {
          if (src.attackCount % 3 !== 0) return
          applyDamage(src, tgt, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityId: 'golurk_poltergeist' }, st)
          for (const hex of hexesInRange(tgt.hexPos, 1)) {
            const uid = st.hexOccupancy.get(hexId(hex))
            if (!uid || uid === tgt.id) continue
            const splash = st.units.get(uid)
            if (!splash || splash.team === src.team || splash.state === 'dead') continue
            applyDamage(src, splash, { baseAmount: Math.round(dmg * 0.5), damageType: 'magic', canCrit: false, abilityId: 'golurk_poltergeist' }, st)
          }
          // Grant shield
          const s: Shield = {
            id: `golurk_shield_${st.tick}`,
            sourceAbility: 'golurk_poltergeist',
            value: shieldAmt,
            maxValue: shieldAmt,
            durationTicks: -1,
          }
          src.shields.push(s)
          st.events.push({ type: 'shield', unitId: src.id, amount: shieldAmt })
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }
  },
}
