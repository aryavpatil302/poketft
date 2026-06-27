import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler, AttackModifier } from '../types'
import { applyDamage } from '../systems/damage'
import { hexesInRange, hexId } from '../hexGrid'

// Golett: every 4th attack fires shadow punch (bonus magic + 1-hex AoE)
export const GolettAbility: AbilityHandler = {
  abilityId: 'golett_shadow_punch',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages = [80, 120, 200] as const
    const dmg = damages[tier - 1]

    const existing = unit.passiveAttackHandlers.find(h => h.id === 'golett_shadow')
    if (!existing) {
      const handler: PassiveAttackHandler = {
        id: 'golett_shadow',
        onAttack: (src, tgt, st) => {
          if (src.attackCount % 4 !== 0) return
          applyDamage(src, tgt, { baseAmount: dmg, damageType: 'magic', canCrit: false, abilityId: 'golett_shadow_punch' }, st)
          for (const hex of hexesInRange(tgt.hexPos, 1)) {
            const uid = st.hexOccupancy.get(hexId(hex))
            if (!uid || uid === tgt.id) continue
            const splash = st.units.get(uid)
            if (!splash || splash.team === src.team || splash.state === 'dead') continue
            applyDamage(src, splash, { baseAmount: Math.round(dmg * 0.5), damageType: 'magic', canCrit: false, abilityId: 'golett_shadow_punch' }, st)
          }
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }
  },
}
