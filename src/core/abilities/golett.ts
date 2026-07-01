import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'

export const GolettAbility: AbilityHandler = {
  abilityId: 'golett_shadow_punch',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldAmounts = [200, 250, 325] as const
    const empoweredDmgs = [200, 250, 350] as const
    const followUpDmgs  = [100, 150, 200] as const
    const shieldAmt     = shieldAmounts[tier - 1]
    const empoweredDmg  = empoweredDmgs[tier - 1]
    const followUpDmg   = followUpDmgs[tier - 1]
    const passivePct    = 0.30

    // Register passive (+30% special as magic on every auto) once per combat
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

    // Grant shield
    const shield: Shield = {
      id: `golett_shield_${state.tick}`,
      sourceAbility: 'golett_shadow_punch',
      value: shieldAmt,
      maxValue: shieldAmt,
      durationTicks: 4 * TICK_RATE,
    }
    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: shieldAmt })
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
            applyDamage(src2, fTarget, { baseAmount: followUpDmg, damageType: 'magic', canCrit: false, abilityId: 'golett_shadow_punch' }, st2)
          },
        })
      },
    })
  },
}
