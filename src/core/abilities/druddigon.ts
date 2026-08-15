import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage, mitigationFactor } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexId, hexDistance, hexKnockbackPath, hexToPixel, isValidHex } from '../hexGrid'
import { releaseHexes } from '../systems/movement'
import { computeStats } from '../unitFactory'
import { HEX_SIZE } from '../constants'

const CAST_TICKS  = 32
const SLIDE_TICKS = 25   // ticks for the 2-hex visual slide (~0.42s)

function findNearestEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    const d = hexDistance(unit.hexPos, other.hexPos)
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

// Rough pre-check: post-mitigation + post-shield damage estimate (no crit)
function estimateHpDamage(damage: number, target: Unit): number {
  const stats = target._computedStats ?? computeStats(target)
  let remaining = Math.round(damage * (1 - mitigationFactor(stats.defense)))
  for (const sh of target.shields) remaining = Math.max(0, remaining - sh.value)
  return remaining
}

export const DruddigonAbility: AbilityHandler = {
  abilityId: 'druddigon_dragon_tail',
  castTimeTicks: CAST_TICKS,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [450, 550, 650] as const
    const stats  = computeStats(unit)
    const damage = Math.round(stats.attack * (damageValues[tier - 1] / 100))

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemy(unit, state)
    if (!target) return

    // Quick pre-check — would the blow kill?
    const wouldKill = estimateHpDamage(damage, target) >= target.currentHp

    if (!wouldKill) {
      applyDamage(unit, target, {
        baseAmount: damage,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'druddigon_dragon_tail',
      }, state)
      return
    }

    // Killing blow: stun the target, slide their sprite 2 hexes away, kill on arrival
    const path = hexKnockbackPath(unit.hexPos, target.hexPos, 2)

    const dest = path[1] && isValidHex(path[1]) ? path[1]
               : path[0] && isValidHex(path[0]) ? path[0]
               : null

    if (!dest) {
      // No room to slide — kill immediately
      applyDamage(unit, target, {
        baseAmount: damage, damageType: 'physical', canCrit: true, abilityId: 'druddigon_dragon_tail',
      }, state)
      return
    }

    const startX      = target.visualPos.x
    const startY      = target.visualPos.y
    const destPx      = hexToPixel(dest, HEX_SIZE)
    const collisionDmg = Math.round(damage * 0.30)
    const druddigonId  = unit.id
    const targetTeam   = target.team
    let slideTick = 0

    // Invulnerable so intermediate ticks don't kill it before the slide completes
    target.incomingDamageMult = 0

    // Stun — shows the stun indicator and prevents the unit from acting
    addStatusEffect(target, {
      id: 'stun',
      sourceUnitId: druddigonId,
      durationTicks: SLIDE_TICKS,
      stackId: `druddigon_stun_${target.id}`,
    })

    // Slide + deferred kill — tickEffect lerps visualPos every tick;
    // onExpire deals collision damage and fires the kill
    addStatusEffect(target, {
      id: 'druddigon_knockback',
      sourceUnitId: druddigonId,
      durationTicks: SLIDE_TICKS,
      stackId: `druddigon_knockback_${target.id}`,

      tickEffect: (sliding, _s) => {
        slideTick++
        const t = Math.min(slideTick / SLIDE_TICKS, 1)
        // Ease-in for a snappy "launched" feel
        const ease = t * t
        sliding.visualPos = {
          x: startX + (destPx.x - startX) * ease,
          y: startY + (destPx.y - startY) * ease,
        }
      },

      onExpire: (sliding, s) => {
        // Snap visual to destination
        sliding.visualPos = { x: destPx.x, y: destPx.y }

        // 30% damage to any unit occupying the 2 knockback hexes
        for (const hex of path) {
          if (!isValidHex(hex)) continue
          const uid = s.hexOccupancy.get(hexId(hex))
          if (!uid || uid === sliding.id) continue
          const collider = s.units.get(uid)
          if (!collider || collider.state === 'dead' || collider.team !== targetTeam) continue
          const src = s.units.get(druddigonId)
          if (src) {
            applyDamage(src, collider, {
              baseAmount: collisionDmg,
              damageType: 'physical',
              canCrit: false,
              abilityId: 'druddigon_dragon_tail',
            }, s)
          }
        }

        // Killing blow at destination
        sliding.incomingDamageMult = 1.0
        const src = s.units.get(druddigonId)
        if (src) {
          applyDamage(src, sliding, {
            baseAmount: damage,
            damageType: 'physical',
            canCrit: true,
            abilityId: 'druddigon_dragon_tail',
          }, s)
        } else {
          sliding.currentHp = 0
          sliding.state = 'dead'
          releaseHexes(sliding, s)
          s.events.push({ type: 'death', unitId: sliding.id, sourceId: druddigonId, abilityId: 'druddigon_dragon_tail' })
        }
      },
    })
  },
}
