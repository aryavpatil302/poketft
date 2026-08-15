import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId } from '../hexGrid'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

export const GolurkAbility: AbilityHandler = {
  abilityId: 'golurk_poltergeist',
  castTimeTicks: 1,

  onCombatStart(unit: Unit): void {
    const passivePct = 0.40
    if (!unit.passiveAttackHandlers.some(h => h.id === 'golurk_special_passive')) {
      const handler: PassiveAttackHandler = {
        id: 'golurk_special_passive',
        onAttack(src: Unit, tgt: Unit, st: CombatState) {
          const bonus = Math.round(src.special * passivePct)
          applyDamage(src, tgt, { baseAmount: bonus, damageType: 'magic', canCrit: false, abilityId: 'golurk_poltergeist' }, st)
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }
  },

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldAmounts = [225, 300, 375] as const
    const empoweredPcts = [320, 430, 535] as const
    const followUpDmgs  = [125, 175, 250] as const
    const shieldAmt     = shieldAmounts[tier - 1]
    const empoweredDmg  = Math.round(computeStats(unit).attack * (empoweredPcts[tier - 1] / 100))
    const followUpDmg   = followUpDmgs[tier - 1]

    // Grant shield
    const shield: Shield = {
      id: `golurk_shield_${state.tick}`,
      sourceAbility: 'golurk_poltergeist',
      value: shieldAmt,
      maxValue: shieldAmt,
      durationTicks: 4 * TICK_RATE,
    }
    addShield(unit, shield, state)
    unit.attackTimer = 0

    // Empower next auto: physical + 1-hex AoE + knockup primary + 2s follow-up to AoE
    unit.attackModifiers.push({
      id: 'shadow_punch_empowered',
      remainingCharges: 1,
      bonusDamage: empoweredDmg,
      bonusDamageType: 'physical',
      aoeRadius: 1,
      knockUp: true,
      onHit(source: Unit, target: Unit, st: CombatState) {
        // Snapshot AoE targets at hit time for the follow-up
        const aoeTargetIds: string[] = [target.id]
        for (const hex of hexesInRange(target.hexPos, 1)) {
          const uid = st.hexOccupancy.get(hexId(hex))
          if (!uid || uid === target.id) continue
          const splash = st.units.get(uid)
          if (!splash || splash.team === source.team || splash.state === 'dead') continue
          aoeTargetIds.push(uid)
        }

        // Ghost VFX behind each target hit
        for (const tid of aoeTargetIds) {
          const tUnit = st.units.get(tid)
          if (!tUnit) continue
          const dx   = tUnit.visualPos.x - source.visualPos.x
          const dy   = tUnit.visualPos.y - source.visualPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          st.events.push({ type: 'vfx', effectId: 'shadow_punch_strike', sourceId: source.id, targetId: tid, dirX: dist > 0 ? dx / dist : 1, dirY: dist > 0 ? dy / dist : 0 })
          st.events.push({ type: 'vfx', effectId: 'shadow_punch_appear', sourceId: source.id, targetId: tid, dirX: dist > 0 ? dx / dist : 1, dirY: dist > 0 ? dy / dist : 0 })
        }

        addStatusEffect(source, {
          id: 'golurk_follow_up_timer',
          sourceUnitId: source.id,
          durationTicks: 2 * TICK_RATE,
          stackId: 'golurk_follow_up_timer',
          onExpire(src2: Unit, st2: CombatState) {
            st2.events.push({ type: 'vfx', effectId: 'shadow_punch_fly', sourceId: src2.id })
            for (const tid of aoeTargetIds) {
              const fTarget = st2.units.get(tid)
              if (!fTarget || fTarget.state === 'dead') continue
              applyDamage(src2, fTarget, { baseAmount: followUpDmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'golurk_poltergeist' }, st2)
            }
          },
        })
      },
    })
  },
}
