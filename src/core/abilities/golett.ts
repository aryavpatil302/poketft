import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

export const GolettAbility: AbilityHandler = {
  abilityId: 'golett_shadow_punch',
  castTimeTicks: 1,

  onCombatStart(unit: Unit): void {
    const passivePct = 0.30
    if (!unit.passiveAttackHandlers.some(h => h.id === 'golett_special_passive')) {
      const handler: PassiveAttackHandler = {
        id: 'golett_special_passive',
        onAttack(src: Unit, tgt: Unit, st: CombatState) {
          const bonus = Math.round(src.special * passivePct)
          applyDamage(src, tgt, { baseAmount: bonus, damageType: 'magic', canCrit: false, abilityId: 'golett_shadow_punch' }, st)
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }
  },

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldAmounts = [200, 250, 325] as const
    const empoweredPcts = [400, 500, 700] as const
    const followUpDmgs  = [100, 150, 200] as const
    const shieldAmt     = shieldAmounts[tier - 1]
    const empoweredDmg  = Math.round(computeStats(unit).attack * (empoweredPcts[tier - 1] / 100))
    const followUpDmg   = followUpDmgs[tier - 1]

    // Grant shield
    const shield: Shield = {
      id: `golett_shield_${state.tick}`,
      sourceAbility: 'golett_shadow_punch',
      value: shieldAmt,
      maxValue: shieldAmt,
      durationTicks: 4 * TICK_RATE,
    }
    addShield(unit, shield, state)
    unit.attackTimer = 0

    // Empower next auto with shadow punch physical hit + 2s magic follow-up
    unit.attackModifiers.push({
      id: 'shadow_punch_empowered',
      remainingCharges: 1,
      bonusDamage: empoweredDmg,
      bonusDamageType: 'physical',
      onHit(source: Unit, target: Unit, st: CombatState) {
        const dx   = target.visualPos.x - source.visualPos.x
        const dy   = target.visualPos.y - source.visualPos.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const dirX = dist > 0 ? dx / dist : 1
        const dirY = dist > 0 ? dy / dist : 0
        st.events.push({ type: 'vfx', effectId: 'shadow_punch_strike', sourceId: source.id, targetId: target.id, dirX, dirY })
        st.events.push({ type: 'vfx', effectId: 'shadow_punch_appear', sourceId: source.id, targetId: target.id, dirX, dirY })

        const capturedTargetId = target.id
        addStatusEffect(source, {
          id: 'golett_follow_up_timer',
          sourceUnitId: source.id,
          durationTicks: 2 * TICK_RATE,
          stackId: 'golett_follow_up_timer',
          onExpire(src2: Unit, st2: CombatState) {
            st2.events.push({ type: 'vfx', effectId: 'shadow_punch_fly', sourceId: src2.id })
            const fTarget = st2.units.get(capturedTargetId)
            if (!fTarget || fTarget.state === 'dead') return
            applyDamage(src2, fTarget, { baseAmount: followUpDmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'golett_shadow_punch' }, st2)
          },
        })
      },
    })
  },
}
