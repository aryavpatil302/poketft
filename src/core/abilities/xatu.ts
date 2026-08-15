import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

export const XatuAbility: AbilityHandler = {
  abilityId: 'xatu_magic_bounce',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const shieldValues = [400, 475, 600] as const
    const ratios       = [0.90, 1.20, 1.50] as const
    const spMult       = (unit._computedStats ?? computeStats(unit)).special / 100
    const shieldVal    = Math.round(shieldValues[tier - 1] * spMult)
    const ratio        = ratios[tier - 1]
    const DURATION     = 3 * TICK_RATE  // 180 ticks

    const shield: Shield = {
      id: crypto.randomUUID(),
      sourceAbility: 'xatu_magic_bounce',
      value: shieldVal,
      maxValue: shieldVal,
      durationTicks: DURATION,
      onExpire: (u: Unit, s: Shield) => {
        // Damage absorbed = initial value minus whatever remains
        const storedDamage = s.maxValue - s.value
        const bonusDamage  = Math.round(storedDamage * ratio)
        if (bonusDamage <= 0) return

        u.attackModifiers.push({
          id: 'xatu_bounce_shot',
          remainingCharges: 1,
          onHit: (src: Unit, tgt: Unit, st: CombatState) => {
            applyDamage(src, tgt, {
              baseAmount:  bonusDamage,
              damageType:  'magic',
              canCrit:     false,
              abilityId:   'xatu_magic_bounce',
            }, st)
            st.events.push({ type: 'vfx', effectId: 'xatu_bounce_shot_hit', unitId: src.id })
          },
        })
      },
    }

    addShield(unit, shield, state)
  },
}
