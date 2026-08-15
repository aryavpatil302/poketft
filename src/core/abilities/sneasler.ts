import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE, HEX_SIZE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { findNearestEnemies } from '../systems/targeting'
import { getNeighbors, hexId, hexToPixel } from '../hexGrid'
import { computeStats } from '../unitFactory'

export const SneaslerAbility: AbilityHandler = {
  abilityId: 'sneasler_dire_claw',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [285, 465, 750] as const
    const poisonValues = [20,  50,  75 ] as const

    const stats        = computeStats(unit)
    const damageAmount = Math.round(stats.attack * (damageValues[tier - 1] / 100))
    const poisonMag    = poisonValues[tier - 1]

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!target) return

    // Compute attack direction (Sneasler → target)
    const dx = target.visualPos.x - unit.visualPos.x
    const dy = target.visualPos.y - unit.visualPos.y
    const dist = Math.hypot(dx, dy)
    const fdX = dist > 0 ? dx / dist : 0
    const fdY = dist > 0 ? dy / dist : 0

    // Arc hexes = target + the 2 hexes adjacent to BOTH Sneasler and the target.
    // These "common neighbors" are the exact flanking pair shown in the diagram.
    const arcHexes = [target.hexPos]
    const sneaslerNbrIds = new Set(getNeighbors(unit.hexPos).map(h => hexId(h)))
    const flankers = getNeighbors(target.hexPos).filter(h => sneaslerNbrIds.has(hexId(h)))

    if (flankers.length >= 2) {
      arcHexes.push(...flankers)
    } else {
      // Fallback for non-adjacent targets: pick 2 most-perpendicular neighbors of target
      const tgtPixel = hexToPixel(target.hexPos, HEX_SIZE)
      const withFwd = getNeighbors(target.hexPos).map(h => {
        const p = hexToPixel(h, HEX_SIZE)
        const relX = p.x - tgtPixel.x, relY = p.y - tgtPixel.y
        return { h, forwardDot: Math.abs(fdX * relX + fdY * relY) }
      })
      withFwd.sort((a, b) => a.forwardDot - b.forwardDot)
      arcHexes.push(...withFwd.slice(0, 2).map(x => x.h))
    }

    // Damage + poison every enemy in the arc
    const hit = new Set<string>()
    for (const hex of arcHexes) {
      const uid = state.hexOccupancy.get(hexId(hex))
      if (!uid || hit.has(uid)) continue
      const tgt = state.units.get(uid)
      if (!tgt || tgt.team === unit.team || tgt.state === 'dead') continue
      hit.add(uid)

      const alreadyPoisoned = tgt.statusEffects.some(fx => fx.id === 'poison')
      applyDamage(unit, tgt, {
        baseAmount: damageAmount,
        damageType: 'physical',
        canCrit:    false,
        forceCrit:  alreadyPoisoned,
        abilityId:  'sneasler_dire_claw',
      }, state)

      // Unique stackId per cast × target so stacks accumulate across recasts
      addStatusEffect(tgt, {
        id:            'poison',
        sourceUnitId:  unit.id,
        durationTicks: 4 * TICK_RATE,
        magnitude:     poisonMag,
        tickInterval:  TICK_RATE,
        stackId:       `sneasler_poison_${state.tick}_${uid}`,
        tickEffect: (u: Unit, st: CombatState) => {
          if (u.state === 'dead') return
          applyDamage(unit, u, {
            baseAmount:        poisonMag,
            damageType:        'magic',
            canCrit:           false,
            abilityScalingStat: 'special',
            abilityId:         'sneasler_dire_claw',
          }, st)
        },
      })
    }

    // VFX: claw arc icon at each hit hex
    state.events.push({
      type:         'vfx',
      effectId:     'sneasler_dire_claw',
      sourceId:     unit.id,
      hexPositions: arcHexes.map(h => hexToPixel(h, HEX_SIZE)),
      angle:        Math.atan2(fdY, fdX),
    })
  },
}
