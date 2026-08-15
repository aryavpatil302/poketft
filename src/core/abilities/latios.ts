import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE, HEX_SIZE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findLargestEnemyCluster } from '../systems/targeting'
import { createProjectile } from '../projectile'
import { hexDistance, hexToPixel } from '../hexGrid'

const DAMAGE       = [250, 600, 3000] as const
const BLAST_RADIUS = 3                    // hexes around the cluster center
const SHRED_PCT    = 0.5                  // Sp. Defense halved
const SHRED_TICKS  = 3 * TICK_RATE
const ORB_SPEED    = 16
const ORB_ARC      = 120                   // px arc height on the way in

// Brief channel while the orb charges above him; unitLayer keys the
// side-to-side sway off this, effectLayer grows the orb over the same window.
export const LATIOS_CHANNEL_TICKS = 45

export const LatiosAbility: AbilityHandler = {
  abilityId: 'latios_luster_purge',
  castTimeTicks: LATIOS_CHANNEL_TICKS,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damage = DAMAGE[tier - 1]

    const cluster = findLargestEnemyCluster(unit, state, BLAST_RADIUS)
    if (cluster.units.length === 0) return
    const targetCenter = cluster.center
    const targetPx = hexToPixel(targetCenter, HEX_SIZE)

    const startPos = { x: unit.visualPos.x, y: unit.visualPos.y - 55 }  // launches from above his head
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
      abilityId: 'latios_luster_purge_orb',
      onTick: (p, source, st) => {
        if (burst || !source) return
        const dx = p.targetPos!.x - p.currentPos.x
        const dy = p.targetPos!.y - p.currentPos.y
        if (Math.sqrt(dx * dx + dy * dy) > p.speed + p.hitRadius) return
        burst = true

        st.events.push({ type: 'vfx', effectId: 'luster_purge_burst', x: p.targetPos!.x, y: p.targetPos!.y })

        for (const enemy of st.units.values()) {
          if (enemy.team === source.team || enemy.state === 'dead') continue
          if (hexDistance(enemy.hexPos, targetCenter) > BLAST_RADIUS) continue
          applyDamage(source, enemy, {
            baseAmount: damage,
            damageType: 'magic',
            canCrit: false,
            abilityScalingStat: 'special',
            abilityId: 'latios_luster_purge',
          }, st)
          if (enemy.currentHp > 0) {
            addStatusEffect(enemy, {
              id: 'shred_pct',
              sourceUnitId: source.id,
              durationTicks: SHRED_TICKS,
              magnitude: SHRED_PCT,
              stackId: 'luster_purge_shred',
            })
          }
        }
      },
    })
    state.projectiles.set(proj.id, proj)
  },
}
