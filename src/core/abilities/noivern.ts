import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'

// Delay between VFX launch and damage landing — syncs with soundwave travel animation
const DAMAGE_DELAY_TICKS = 15

export const NoivernAbility: AbilityHandler = {
  abilityId: 'noivern_boomburst',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages = [400, 650, 2000] as const
    const damage  = damages[tier - 1]

    // Emit VFX event — effectLayer spawns 6 soundwave pulses radiating outward
    state.events.push({
      type: 'vfx',
      effectId: 'boomburst_soundwave',
      x: unit.visualPos.x,
      y: unit.visualPos.y,
      sourceId: unit.id,
    })

    // Delay damage so it lands in sync with the soundwave reaching targets
    addStatusEffect(unit, {
      id: 'noivern_boomburst_pending',
      sourceUnitId: unit.id,
      durationTicks: DAMAGE_DELAY_TICKS,
      stackId: 'noivern_boomburst_pending',
      onExpire: (u: Unit, s: CombatState) => {
        for (const target of s.units.values()) {
          if (target.team === u.team || target.state === 'dead') continue
          if (Math.abs(target.hexPos.row - u.hexPos.row) > 3) continue
          applyDamage(u, target, {
            baseAmount: damage,
            damageType: 'magic',
            canCrit: false,
            abilityId: 'noivern_boomburst',
          }, s)
        }
      },
    })
  },
}
