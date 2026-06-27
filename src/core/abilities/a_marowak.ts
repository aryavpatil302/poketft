import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { hexesInRange, hexId } from '../hexGrid'

export const AMaRowakAbility: AbilityHandler = {
  abilityId: 'a_marowak_shadow_bone',
  castTimeTicks: 15,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const normalDmg = [300, 450, 700]  as const
    const bigDmg    = [450, 600, 850]  as const
    const dmg1 = normalDmg[tier - 1]
    const dmg3 = bigDmg[tier - 1]
    const srcId = unit.id

    const makeSwing = (swingDir: number) => ({
      id: 'a_marowak_bone',
      remainingCharges: 1,
      swingDir,
      onHit: (src: Unit, _tgt: Unit, st: CombatState) => {
        applyDamage(src, _tgt, { baseAmount: dmg1, damageType: 'magic' as const, canCrit: false, abilityId: 'a_marowak_shadow_bone' }, st)
      },
    })

    const makeFinisher = () => ({
      id: 'a_marowak_bone_3',
      remainingCharges: 1,
      onHit: (src: Unit, _tgt: Unit, st: CombatState) => {
        let totalDamage = 0
        for (const hex of hexesInRange(src.hexPos, 1)) {
          const uid = st.hexOccupancy.get(hexId(hex))
          if (!uid) continue
          const enemy = st.units.get(uid)
          if (!enemy || enemy.team === src.team || enemy.state === 'dead') continue
          const result = applyDamage(src, enemy, {
            baseAmount: dmg3,
            damageType: 'magic' as const,
            canCrit: false,
            abilityId: 'a_marowak_shadow_bone',
          }, st)
          totalDamage += result.finalDamage
        }
        const healAmt = Math.round(totalDamage * 0.50)
        if (healAmt > 0) applyHeal(src, healAmt, srcId, st)
        st.events.push({ type: 'vfx', effectId: 'marowak_spin_strike', unitId: srcId })
      },
    })

    // First strike CW arc, second CCW arc (swingDir sign flips the rotation)
    unit.attackModifiers.push(makeSwing(-1), makeSwing(1), makeFinisher())
  },
}
