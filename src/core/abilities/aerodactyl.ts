import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { hexDistance } from '../hexGrid'
import { computeStats } from '../unitFactory'

export const AerodactylAbility: AbilityHandler = {
  abilityId: 'aerodactyl_ancient_power',
  castTimeTicks: 20,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const bonuses  = [0.30, 0.45, 0.80] as const
    const rockPcts = [0.50, 0.75, 3.00] as const

    const bonus   = bonuses[tier - 1]
    const rockPct = rockPcts[tier - 1]

    // Guard: only apply the stat buff once (stackId prevents duplicate status effects)
    if (!unit.statusEffects.some(fx => fx.stackId === 'aerodactyl_ancient_power_applied')) {
      addStatusEffect(unit, {
        id: 'ancient_power_stats',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: bonus,
        stackId: 'aerodactyl_ancient_power_applied',
      })
      addStatusEffect(unit, {
        id: 'omnivamp_buff',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: 0.25,
        stackId: 'aerodactyl_ancient_power_omnivamp',
      })
      // Permanently block mana gain — Ancient Power fires once and never again
      addStatusEffect(unit, {
        id: 'mana_suppressed',
        sourceUnitId: unit.id,
        durationTicks: -1,
        suppressManaGain: true,
        stackId: 'aerodactyl_no_mana',
      })
      unit.range += 1
      unit._computedStats = null
    }

    // Passive: bounce rock from the auto-attack target to the furthest enemy from that target.
    // Uses onProjectileHit so the rock only launches after the auto actually lands.
    if (!unit.passiveAttackHandlers.some(h => h.id === 'aerodactyl_rock')) {
      const launchRock = (src: Unit, tgt: Unit, st: CombatState) => {
        // Find the living enemy furthest from the target (not the target itself)
        let farthest: Unit | null = null
        let farthestDist = -1
        for (const other of st.units.values()) {
          if (other.team === src.team || other.state === 'dead' || other.id === tgt.id) continue
          const d = hexDistance(tgt.hexPos, other.hexPos)
          if (d > farthestDist) { farthestDist = d; farthest = other }
        }
        if (!farthest) return

        const stats   = src._computedStats ?? computeStats(src)
        const rockDmg = Math.round(stats.attack * rockPct)

        // Rock spawns at the target's position and travels to the farthest enemy
        const proj = createProjectile({
          sourceId: src.id,
          targetId: farthest.id,
          startPos: { ...tgt.visualPos },
          speed:    14,
          damagePayload: {
            baseAmount: rockDmg,
            damageType: 'physical',
            canCrit:    false,
            abilityId:  'aerodactyl_ancient_power',
          },
          abilityId: 'aerodactyl_ancient_power_rock',
        })
        st.projectiles.set(proj.id, proj)
      }

      const handler: PassiveAttackHandler = {
        id: 'aerodactyl_rock',
        onAttack: () => { /* no-op: rock fires on hit, not on launch */ },
        onProjectileHit: launchRock,
      }
      unit.passiveAttackHandlers.push(handler)
    }
  },
}
