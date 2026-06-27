import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Projectile } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { createProjectile } from '../projectile'
import { hexDistance, hexLinePath, hexId, hexesInRange } from '../hexGrid'
import { computeStats } from '../unitFactory'

const BEAM_SPEED    = 18   // px/tick — fast cannon blast
const HIT_RADIUS    = 8
const HIT_THRESHOLD = BEAM_SPEED + HIT_RADIUS + 4  // match tickProjectiles hit window

export const ArmarougeAbility: AbilityHandler = {
  abilityId: 'armarouge_armor_cannon',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues   = [200, 300, 500]     as const
    const atkBonusPerHit = [7,   10,  15]      as const
    const atkSpdBonuses  = [0.35, 0.50, 0.75]  as const
    const aoeFractions   = [0.15, 0.25, 0.33]  as const

    const dmg         = damageValues[tier - 1]
    const atkBonus    = atkBonusPerHit[tier - 1]
    const atkSpdBonus = atkSpdBonuses[tier - 1]
    const aoeFraction = aoeFractions[tier - 1]
    const casterId    = unit.id
    const startPos    = { ...unit.visualPos }

    // Find farthest living enemy
    let farthest: Unit | null = null
    let maxDist = -1
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      const d = hexDistance(unit.hexPos, other.hexPos)
      if (d > maxDist) { maxDist = d; farthest = other }
    }
    if (!farthest) return

    const farthestId   = farthest.id
    const linePath     = hexLinePath(unit.hexPos, farthest.hexPos)
    const farthestVisual = { ...farthest.visualPos }
    const lineDX  = farthestVisual.x - startPos.x
    const lineDY  = farthestVisual.y - startPos.y
    const lineLen = Math.sqrt(lineDX * lineDX + lineDY * lineDY) || 1
    const lineDirX = lineDX / lineLen
    const lineDirY = lineDY / lineLen

    // Track which units the beam has already damaged
    const hitUnits = new Set<string>()

    // Reset attack timer so the first empowered auto doesn't fire overlapping the cast animation
    unit.attackTimer = Math.round(TICK_RATE * 0.4)
    unit.isInWindup = false
    unit.attackWindupTimer = 0

    // ── Apply empowered-auto buffs immediately on cast (not when beam lands) ──
    // Attack speed buff for 3 seconds — invalidate cache so it takes effect immediately
    addStatusEffect(unit, {
      id: 'atkSpd_buff',
      sourceUnitId: casterId,
      durationTicks: Math.round(3 * TICK_RATE),
      magnitude: atkSpdBonus,
      stackId: 'armarouge_atkspd',
    })
    unit._computedStats = null  // force attackCooldownTicks to recompute with new speed

    // Cannon mode status — gates the visual window and cleans up the modifier on expiry
    addStatusEffect(unit, {
      id: 'armarouge_cannon_mode',
      sourceUnitId: casterId,
      durationTicks: Math.round(3 * TICK_RATE),
      stackId: 'armarouge_cannon_mode',
      onExpire: (u) => {
        u.attackModifiers = u.attackModifiers.filter(m => m.id !== 'armarouge_cannon_auto')
      },
    })

    // Empowered auto modifier — unlimited charges, removed by the cannon_mode onExpire above.
    // visualId is baked into each launched projectile so the cannon visual persists in flight
    // even after the 3-second window closes.
    const fraction = aoeFraction
    unit.attackModifiers.push({
      id: 'armarouge_cannon_auto',
      remainingCharges: 9999,
      visualId: 'armarouge_cannon_auto',
      projectileSpeed: 10.4,
      onHit: (src, tgtAuto, st) => {
        const stats = src._computedStats ?? computeStats(src)
        const aoeDmg = Math.round(stats.attack * fraction)

        for (const adjHex of hexesInRange(tgtAuto.hexPos, 1)) {
          const adjId = st.hexOccupancy.get(hexId(adjHex))
          if (!adjId || adjId === tgtAuto.id) continue
          const adj = st.units.get(adjId)
          if (!adj || adj.team === src.team || adj.state === 'dead') continue
          applyDamage(src, adj, {
            baseAmount: aoeDmg,
            damageType: 'physical',
            canCrit: false,
            abilityId: 'armarouge_cannon_auto',
          }, st)
        }

        st.events.push({
          type: 'vfx',
          effectId: 'armarouge_cannon_explosion',
          x: tgtAuto.visualPos.x,
          y: tgtAuto.visualPos.y,
          large: true,
        })
      },
    })

    // ── Launch beam — permanent attack bonus applied when it lands ───────────
    const proj = createProjectile({
      sourceId: unit.id,
      targetId: farthestId,
      startPos,
      speed: BEAM_SPEED,
      hitRadius: HIT_RADIUS,
      abilityId: 'armarouge_armor_cannon',

      onTick: (p: Projectile, _src, s: CombatState) => {
        const caster = s.units.get(casterId)
        if (!caster || caster.state === 'dead') return

        const travelX = p.currentPos.x - startPos.x
        const travelY = p.currentPos.y - startPos.y
        const projDist = travelX * lineDirX + travelY * lineDirY

        for (const hex of linePath) {
          const occupantId = s.hexOccupancy.get(hexId(hex))
          if (!occupantId || occupantId === farthestId || hitUnits.has(occupantId)) continue
          const enemy = s.units.get(occupantId)
          if (!enemy || enemy.team === caster.team || enemy.state === 'dead') continue

          const unitDist = (enemy.visualPos.x - startPos.x) * lineDirX +
                           (enemy.visualPos.y - startPos.y) * lineDirY

          if (projDist >= unitDist - HIT_THRESHOLD) {
            applyDamage(caster, enemy, {
              baseAmount: dmg,
              damageType: 'physical',
              canCrit: false,
              abilityId: 'armarouge_armor_cannon',
            }, s)
            s.events.push({
              type: 'vfx',
              effectId: 'armarouge_cannon_explosion',
              x: enemy.visualPos.x,
              y: enemy.visualPos.y,
            })
            hitUnits.add(occupantId)
          }
        }
      },

      onHit: (_src, tgt, s) => {
        const caster = s.units.get(casterId)
        if (!caster || caster.state === 'dead') return

        // Guarantee farthest target takes damage (onTick can't reach it in the final tick)
        if (!hitUnits.has(tgt.id) && tgt.state !== 'dead') {
          applyDamage(caster, tgt, {
            baseAmount: dmg,
            damageType: 'physical',
            canCrit: false,
            abilityId: 'armarouge_armor_cannon',
          }, s)
          s.events.push({
            type: 'vfx',
            effectId: 'armarouge_cannon_explosion',
            x: tgt.visualPos.x,
            y: tgt.visualPos.y,
          })
          hitUnits.add(tgt.id)
        }

        // Permanent attack bonus per enemy the beam passed through
        const hitCount = hitUnits.size
        if (hitCount > 0) {
          caster.attack += atkBonus * hitCount
          caster._computedStats = null
        }
      },
    })
    state.projectiles.set(proj.id, proj)
  },
}
