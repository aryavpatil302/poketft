import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { findNearestEnemies } from '../systems/targeting'

const RUMBLE_TICKS   = 15
const SHIELD_DURATION = 3 * TICK_RATE

function findLowestHpPctAllies(unit: Unit, state: CombatState, count: number): Unit[] {
  return [...state.units.values()]
    .filter(u => u.team === unit.team && u.id !== unit.id && u.state !== 'dead')
    .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))
    .slice(0, count)
}

export const SableyeAbility: AbilityHandler = {
  abilityId: 'sableye_power_gem',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues = [250, 325, 425] as const
    const damageValues = [200, 300, 550] as const
    const shieldAmt = shieldValues[tier - 1]
    const damage    = damageValues[tier - 1]

    // Parity: magnitude=0 (or absent) → shield cast; magnitude=1 → damage cast
    const parity = unit.statusEffects.find(fx => fx.stackId === 'sableye_parity')
    const isShieldCast = !parity || parity.magnitude === 0

    if (!parity) {
      addStatusEffect(unit, {
        id: 'sableye_parity',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: 1,
        stackId: 'sableye_parity',
      })
    } else {
      parity.magnitude = isShieldCast ? 1 : 0
    }

    // Brief launch shake
    addStatusEffect(unit, {
      id: 'sableye_rumble',
      sourceUnitId: unit.id,
      durationTicks: RUMBLE_TICKS,
      stackId: 'sableye_rumble',
    })

    const allies = isShieldCast ? findLowestHpPctAllies(unit, state, 2) : []
    const doShield = isShieldCast && allies.length > 0

    if (doShield) {
      for (const ally of allies) {
        const proj = createProjectile({
          sourceId: unit.id,
          targetId: ally.id,
          startPos: { ...unit.visualPos },
          speed: 13,
          onHit: (_src, hitTarget, hitState) => {
            const shield: Shield = {
              id: `sableye_gem_shield_${hitTarget.id}_${hitState.tick}`,
              sourceAbility: 'sableye_power_gem',
              value: shieldAmt,
              maxValue: shieldAmt,
              durationTicks: SHIELD_DURATION,
            }
            hitTarget.shields.push(shield)
            hitState.events.push({ type: 'shield', unitId: hitTarget.id, amount: shieldAmt })
          },
          abilityId: 'sableye_power_gem_shield',
        })
        state.projectiles.set(proj.id, proj)
      }
    }
    if (!doShield) {
      const enemies = findNearestEnemies(unit, state, 2)
      for (const enemy of enemies) {
        const proj = createProjectile({
          sourceId: unit.id,
          targetId: enemy.id,
          startPos: { ...unit.visualPos },
          speed: 13,
          damagePayload: {
            baseAmount: damage,
            damageType: 'magic',
            canCrit: false,
          },
          abilityId: 'sableye_power_gem_damage',
        })
        state.projectiles.set(proj.id, proj)
      }
    }
  },
}
