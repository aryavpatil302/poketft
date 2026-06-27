import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { applyDamage } from '../systems/damage'
import { createProjectile } from '../projectile'
import { hexDistance } from '../hexGrid'

export const AerodactylAbility: AbilityHandler = {
  abilityId: 'aerodactyl_ancient_power',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const statBonuses  = [0.08, 0.12, 0.20] as const
    const rockDamages  = [80, 120, 200] as const

    const bonus    = statBonuses[tier - 1]
    const rockDmg  = rockDamages[tier - 1]

    // Permanently buff all stats
    unit.attack     = Math.round(unit.attack     * (1 + bonus))
    unit.special    = Math.round(unit.special    * (1 + bonus))
    unit.defense    = Math.round(unit.defense    * (1 + bonus))
    unit.spDefense  = Math.round(unit.spDefense  * (1 + bonus))
    unit.maxHp      = Math.round(unit.maxHp      * (1 + bonus))
    unit.currentHp  = Math.min(unit.currentHp + Math.round(unit.maxHp * bonus), unit.maxHp)
    unit._computedStats = null

    // Passive: each auto launches a rock projectile to furthest nearby enemy
    const existingHandler = unit.passiveAttackHandlers.find(h => h.id === 'aerodactyl_rock')
    if (!existingHandler) {
      const handler: PassiveAttackHandler = {
        id: 'aerodactyl_rock',
        onAttack: (src: Unit, _tgt: Unit, st: CombatState) => {
          // Find the furthest living enemy
          let farthest: Unit | null = null
          let farthestDist = -1
          for (const other of st.units.values()) {
            if (other.team === src.team || other.state === 'dead') continue
            const d = hexDistance(src.hexPos, other.hexPos)
            if (d > farthestDist) { farthestDist = d; farthest = other }
          }
          if (!farthest) return

          const proj = createProjectile({
            sourceId: src.id,
            targetId: farthest.id,
            startPos: { ...src.visualPos },
            speed: 6,
            damagePayload: { baseAmount: rockDmg, damageType: 'magic', canCrit: false },
            abilityId: 'aerodactyl_ancient_power',
          })
          st.projectiles.set(proj.id, proj)
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }
  },
}
