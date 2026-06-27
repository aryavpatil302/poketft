import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId } from '../hexGrid'

export const DrednawAbility: AbilityHandler = {
  abilityId: 'drednaw_razor_shell',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const splashDamageValues = [60, 90, 150] as const
    const splashDamage = splashDamageValues[tier - 1]

    const handlerId = `drednaw_jaw_${unit.id}_${state.tick}`

    // Passive handler: AoE splash around target while 'drednaw_bite' is active
    const handler = {
      id: handlerId,
      onAttack(src: Unit, tgt: Unit, st: CombatState): void {
        // Self-remove if the bite status has expired
        if (!src.statusEffects.some(fx => fx.id === 'drednaw_bite' && fx.stackId === 'drednaw_bite_active')) {
          src.passiveAttackHandlers = src.passiveAttackHandlers.filter(h => h.id !== handlerId)
          return
        }

        // Deal splash magic damage to all enemies within 1 hex of the target
        const splashHexes = hexesInRange(tgt.hexPos, 1)
        const alreadyHit = new Set<string>([tgt.id])  // don't double-hit the primary target

        for (const hex of splashHexes) {
          const occupantId = st.hexOccupancy.get(hexId(hex))
          if (!occupantId) continue
          const splash = st.units.get(occupantId)
          if (!splash || splash.state === 'dead' || splash.team === src.team) continue
          if (alreadyHit.has(splash.id)) continue
          alreadyHit.add(splash.id)

          applyDamage(src, splash, {
            baseAmount: splashDamage,
            damageType: 'magic',
            canCrit: false,
            abilityId: 'drednaw_razor_shell',
          }, st)
        }
      },
    }

    unit.passiveAttackHandlers.push(handler)

    // 5-second status; on expiry remove the handler
    addStatusEffect(unit, {
      id: 'drednaw_bite',
      sourceUnitId: unit.id,
      durationTicks: 5 * TICK_RATE,
      stackId: 'drednaw_bite_active',
      onExpire: (u: Unit, _st: CombatState) => {
        u.passiveAttackHandlers = u.passiveAttackHandlers.filter(h => h.id !== handlerId)
      },
    })
  },
}
