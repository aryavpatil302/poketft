import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

export const MegaGolurkAbility: AbilityHandler = {
  abilityId: 'mega_golurk_phantom_force',
  castTimeTicks: 1,

  onCombatStart(unit: Unit): void {
    const passivePct = 0.55
    if (!unit.passiveAttackHandlers.some(h => h.id === 'mega_golurk_special_passive')) {
      const handler: PassiveAttackHandler = {
        id: 'mega_golurk_special_passive',
        onAttack(src: Unit, tgt: Unit, st: CombatState) {
          const bonus = Math.round(src.special * passivePct)
          applyDamage(src, tgt, { baseAmount: bonus, damageType: 'magic', canCrit: false, abilityId: 'mega_golurk_phantom_force' }, st)
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }
  },

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldAmounts = [300, 400, 550] as const
    const empoweredPcts = [275, 365, 500] as const
    const followUpDmgs  = [175, 275, 450] as const
    const shieldAmt     = shieldAmounts[tier - 1]
    const empoweredDmg  = Math.round(computeStats(unit).attack * (empoweredPcts[tier - 1] / 100))
    const followUpDmg   = followUpDmgs[tier - 1]

    // Grant shield
    const shield: Shield = {
      id: `mega_golurk_shield_${state.tick}`,
      sourceAbility: 'mega_golurk_phantom_force',
      value: shieldAmt,
      maxValue: shieldAmt,
      durationTicks: 4 * TICK_RATE,
    }
    addShield(unit, shield, state)
    unit.attackTimer = 0

    // Empower next auto: physical to primary + knockup primary + hit ALL enemies in onHit
    unit.attackModifiers.push({
      id: 'shadow_punch_empowered',
      remainingCharges: 1,
      bonusDamage: empoweredDmg,
      bonusDamageType: 'physical',
      knockUp: true,
      onHit(source: Unit, target: Unit, st: CombatState) {
        // Apply full empowered damage + knockup to every OTHER living enemy
        for (const victim of st.units.values()) {
          if (victim.team === source.team || victim.state === 'dead' || victim.id === target.id) continue
          applyDamage(source, victim, { baseAmount: empoweredDmg, damageType: 'physical', canCrit: true, abilityId: 'mega_golurk_phantom_force' }, st)
          addStatusEffect(victim, {
            id: 'knockUp',
            sourceUnitId: source.id,
            durationTicks: TICK_RATE,
            stackId: `mega_golurk_knockup_${victim.id}`,
          })
        }

        // Ghost VFX behind every enemy hit (primary + all others)
        for (const victim of st.units.values()) {
          if (victim.team === source.team || victim.state === 'dead') continue
          const dx   = victim.visualPos.x - source.visualPos.x
          const dy   = victim.visualPos.y - source.visualPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          st.events.push({ type: 'vfx', effectId: 'shadow_punch_strike', sourceId: source.id, targetId: victim.id, dirX: dist > 0 ? dx / dist : 1, dirY: dist > 0 ? dy / dist : 0 })
          st.events.push({ type: 'vfx', effectId: 'shadow_punch_appear', sourceId: source.id, targetId: victim.id, dirX: dist > 0 ? dx / dist : 1, dirY: dist > 0 ? dy / dist : 0 })
        }

        // Snapshot all living enemies for follow-up
        const allEnemyIds = [...st.units.values()]
          .filter(u => u.team !== source.team && u.state !== 'dead')
          .map(u => u.id)

        addStatusEffect(source, {
          id: 'mega_golurk_follow_up_timer',
          sourceUnitId: source.id,
          durationTicks: 2 * TICK_RATE,
          stackId: 'mega_golurk_follow_up_timer',
          onExpire(src2: Unit, st2: CombatState) {
            st2.events.push({ type: 'vfx', effectId: 'shadow_punch_fly', sourceId: src2.id })
            for (const tid of allEnemyIds) {
              const fTarget = st2.units.get(tid)
              if (!fTarget || fTarget.state === 'dead') continue
              applyDamage(src2, fTarget, { baseAmount: followUpDmg, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', abilityId: 'mega_golurk_phantom_force' }, st2)
            }
          },
        })
      },
    })
  },
}
