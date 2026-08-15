import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE, HEX_SIZE } from '../constants'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import { addStatusEffect } from '../systems/statusEffect'
import { findLargestEnemyCluster } from '../systems/targeting'
import { createProjectile } from '../projectile'
import { hexDistance, hexToPixel } from '../hexGrid'

const DAMAGE        = [150, 250, 1000] as const
const HEAL_TOTAL    = [300, 400, 2000] as const
const BLAST_RADIUS  = 2                    // hexes around the cluster center (tighter than Latios)
const SHRED_PCT     = 0.5                  // Sp. Attack halved
const SHRED_TICKS   = 3 * TICK_RATE
const ORB_SPEED     = 24
const ORB_ARC       = 70
const HEAL_INTERVAL = 15                   // heal pulse every 15 ticks over the channel

// Longer channel than Latios — she's the slow, tanky half of the pair.
export const LATIAS_CHANNEL_TICKS = 75

export const LatiasAbility: AbilityHandler = {
  abilityId: 'latias_mist_ball',
  castTimeTicks: LATIAS_CHANNEL_TICKS,

  // Heal-over-channel: pulses while she charges the orb, not on release
  onCastStart(unit: Unit, _state: CombatState, tier: number): void {
    const pulses  = Math.floor(LATIAS_CHANNEL_TICKS / HEAL_INTERVAL)
    const perTick = Math.round(HEAL_TOTAL[tier - 1] / Math.max(1, pulses))
    addStatusEffect(unit, {
      id: 'latias_mist_ball_heal',
      sourceUnitId: unit.id,
      durationTicks: LATIAS_CHANNEL_TICKS,
      tickInterval: HEAL_INTERVAL,
      stackId: 'latias_mist_ball_heal',
      tickEffect: (u, st) => {
        if (u.state === 'dead') return
        applyHeal(u, perTick, u.id, st)
      },
    })
  },

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damage = DAMAGE[tier - 1]

    const cluster = findLargestEnemyCluster(unit, state, BLAST_RADIUS)
    if (cluster.units.length === 0) return
    const targetCenter = cluster.center
    const targetPx = hexToPixel(targetCenter, HEX_SIZE)

    const startPos = { x: unit.visualPos.x, y: unit.visualPos.y - 55 }
    const launchDx = targetPx.x - startPos.x
    const launchDy = targetPx.y - startPos.y

    // Fixed-position projectiles don't fire onHit — detect arrival in onTick
    // with the same distance test tickProjectiles uses for removal.
    let burst = false
    const proj = createProjectile({
      sourceId: unit.id,
      targetPos: targetPx,
      startPos,
      speed: ORB_SPEED,
      hitRadius: 10,
      arcHeight: ORB_ARC,
      launchDist: Math.sqrt(launchDx * launchDx + launchDy * launchDy),
      abilityId: 'latias_mist_ball_orb',
      onTick: (p, source, st) => {
        if (burst || !source) return
        const dx = p.targetPos!.x - p.currentPos.x
        const dy = p.targetPos!.y - p.currentPos.y
        if (Math.sqrt(dx * dx + dy * dy) > p.speed + p.hitRadius) return
        burst = true

        st.events.push({ type: 'vfx', effectId: 'mist_ball_burst', x: p.targetPos!.x, y: p.targetPos!.y })

        for (const enemy of st.units.values()) {
          if (enemy.team === source.team || enemy.state === 'dead') continue
          if (hexDistance(enemy.hexPos, targetCenter) > BLAST_RADIUS) continue
          applyDamage(source, enemy, {
            baseAmount: damage,
            damageType: 'magic',
            canCrit: false,
            abilityScalingStat: 'special',
            abilityId: 'latias_mist_ball',
          }, st)
          if (enemy.currentHp > 0) {
            addStatusEffect(enemy, {
              id: 'sp_reduction_pct',
              sourceUnitId: source.id,
              durationTicks: SHRED_TICKS,
              magnitude: SHRED_PCT,
              stackId: 'mist_ball_shred',
            })
          }
        }
      },
    })
    state.projectiles.set(proj.id, proj)
  },
}
