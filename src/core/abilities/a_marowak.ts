import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { hexesInRange, hexId, hexToPixel } from '../hexGrid'
import { HEX_SIZE } from '../constants'

export const AMaRowakAbility: AbilityHandler = {
  abilityId: 'a_marowak_shadow_bone',
  castTimeTicks: 15,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const normalDmg = [300, 450, 700] as const
    const bigDmg    = [450, 600, 850] as const
    const dmg1 = normalDmg[tier - 1]
    const dmg3 = bigDmg[tier - 1]
    const srcId = unit.id

    const makeSwing = (swingDir: number) => ({
      id: 'a_marowak_bone',
      remainingCharges: 1,
      swingDir,
      onHit: (src: Unit, tgt: Unit, st: CombatState) => {
        applyDamage(src, tgt, { baseAmount: dmg1, damageType: 'magic' as const, canCrit: false, abilityId: 'a_marowak_shadow_bone' }, st)
      },
    })

    const makeFinisher = () => ({
      id: 'a_marowak_bone_3',
      remainingCharges: 1,
      onHit: (src: Unit, tgt: Unit, st: CombatState) => {
        let totalDamage = 0

        // BFS through connected enemies: primary target, then any enemy touching a hit enemy, etc.
        const hitSet = new Set<string>([tgt.id])
        const queue: Unit[] = [tgt]
        const hitUnits: Unit[] = [tgt]
        while (queue.length > 0) {
          const current = queue.shift()!
          for (const hex of hexesInRange(current.hexPos, 1)) {
            const uid = st.hexOccupancy.get(hexId(hex))
            if (!uid || hitSet.has(uid)) continue
            const adjacent = st.units.get(uid)
            if (!adjacent || adjacent.team === src.team || adjacent.state === 'dead') continue
            hitSet.add(uid)
            hitUnits.push(adjacent)
            queue.push(adjacent)
          }
        }

        for (const enemy of hitUnits) {
          const r = applyDamage(src, enemy, { baseAmount: dmg3, damageType: 'magic' as const, canCrit: false, abilityId: 'a_marowak_shadow_bone' }, st)
          totalDamage += r.finalDamage
        }

        const healAmt = Math.round(totalDamage * 0.50)
        if (healAmt > 0) applyHeal(src, healAmt, srcId, st)

        // Direction vector for lunge animation
        const dx = tgt.visualPos.x - src.visualPos.x
        const dy = tgt.visualPos.y - src.visualPos.y
        const len = Math.hypot(dx, dy) || 1

        // Fire VFX on every hit hex
        const hexPositions = hitUnits.map(u => hexToPixel(u.hexPos, HEX_SIZE))

        st.events.push({ type: 'vfx', effectId: 'marowak_shadow_bone_cone', unitId: srcId, dirX: dx / len, dirY: dy / len, hexPositions })
      },
    })

    unit.attackModifiers.push(makeSwing(-1), makeSwing(1), makeFinisher())
  },
}
