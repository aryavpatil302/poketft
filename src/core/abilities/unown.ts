import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { hexesInRange, hexId } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'
import { combatRng } from '../rng'

type HpType = 'ice' | 'fire' | 'electric'

const HP_TYPES: HpType[] = ['ice', 'fire', 'electric']

export const UnownAbility: AbilityHandler = {
  abilityId: 'unown_hidden_power',
  castTimeTicks: 40,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const baseDamage = [150, 200, 300][tier - 1]

    const atkTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (atkTarget && atkTarget.state !== 'dead' && atkTarget.team !== unit.team)
      ? atkTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!target) return

    const hpType: HpType  = HP_TYPES[Math.floor(combatRng() * 3)]
    const finalDamage      = hpType === 'fire' ? Math.round(baseDamage * 1.5) : baseDamage
    const casterId         = unit.id

    const proj = createProjectile({
      sourceId:  unit.id,
      targetId:  target.id,
      startPos:  { ...unit.visualPos },
      speed:     15,
      hitRadius: 10,
      abilityId: `unown_hidden_power_${hpType}`,
      damagePayload: {
        baseAmount:        finalDamage,
        damageType:        'magic',
        canCrit:           false,
        abilityScalingStat: 'special',
        abilityId:         'unown_hidden_power',
      },
      onHit: (src, hitTarget, st) => {
        if (hitTarget.state === 'dead') return

        if (hpType === 'ice') {
          addStatusEffect(hitTarget, {
            id:          'stun',
            sourceUnitId: casterId,
            durationTicks: TICK_RATE,
          })
        } else if (hpType === 'electric') {
          // 50% splash to units in 1-hex radius around the target
          for (const hex of hexesInRange(hitTarget.hexPos, 1)) {
            const uid = st.hexOccupancy.get(hexId(hex))
            if (!uid || uid === hitTarget.id) continue
            const victim = st.units.get(uid)
            if (!victim || victim.team !== hitTarget.team || victim.state === 'dead') continue
            applyDamage(src ?? hitTarget, victim, {
              baseAmount:        Math.round(finalDamage * 0.5),
              damageType:        'magic',
              canCrit:           false,
              abilityScalingStat: 'special',
              abilityId:         'unown_hidden_power',
            }, st)
          }
          st.events.push({
            type:     'vfx',
            effectId: 'unown_hp_electric_ring',
            x: hitTarget.visualPos.x,
            y: hitTarget.visualPos.y,
          })
        }
        // fire: damage already applied via damagePayload at +50%
      },
    })
    state.projectiles.set(proj.id, proj)
  },
}
