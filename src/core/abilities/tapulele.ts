import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { isTerrainActive } from '../systems/terrain'
import { findNearestEnemies } from '../systems/targeting'

export const TapuLeleAbility: AbilityHandler = {
  abilityId: 'tapulele_natures_madness',
  castTimeTicks: 25,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const targetCounts = [4,   5,   10  ] as const
    const damages      = [500, 750, 5000] as const
    const piercePcts   = [0.30, 0.45, 1.00] as const

    const count   = targetCounts[tier - 1]
    const damage  = damages[tier - 1]
    const pierce  = piercePcts[tier - 1]
    const psychic = isTerrainActive(state, 'psychic')

    // Fire damage this many ticks before the 2-second window ends so it coincides
    // with the apex of the psystrike.webm explosion rather than its tail-out.
    const DAMAGE_EARLY_TICKS = 10

    // Get all living enemies sorted closest-first.
    // If fewer exist than `count`, the closest enemies absorb the leftover cast slots
    // (e.g. 3 enemies, count=5 → 2 closest get 2 casts / 2× damage, third gets 1×).
    const allEnemies = findNearestEnemies(unit, state, Number.MAX_SAFE_INTEGER)
    if (allEnemies.length === 0) return
    const numTargets = Math.min(allEnemies.length, count)
    const targets    = allEnemies.slice(0, numTargets)

    // Distribute `count` slots across `numTargets` targets. Extras go to the closest.
    const base   = Math.floor(count / numTargets)
    const extras = count % numTargets  // first `extras` targets get one more hit

    // tapulele_channel lives on Lele — drives movement/attack suppression + rumble.
    // If Lele dies, this effect is skipped, which is fine (dead Lele can't move or attack).
    addStatusEffect(unit, {
      id: 'tapulele_channel',
      sourceUnitId: unit.id,
      durationTicks: 2 * TICK_RATE,
      stackId: 'tapulele_channel',
      onExpire: (u, _st) => {
        // 0.2s recovery — no autos immediately after the strike
        addStatusEffect(u, {
          id: 'tapulele_post_channel',
          sourceUnitId: u.id,
          durationTicks: Math.round(0.2 * TICK_RATE),
          stackId: 'tapulele_post_channel',
        })
      },
    })

    // Damage timers live on each TARGET so they survive Lele's death.
    // hitCount > 1 means the target was hit by multiple "cast slots" — damage multiplies.
    for (let i = 0; i < targets.length; i++) {
      const target   = targets[i]
      const hitCount = base + (i < extras ? 1 : 0)

      // Spread hitCount animations with even rotation so they don't perfectly overlap.
      // Single hit: no rotation. Multiple hits: fan across ±20° total spread.
      const SPREAD = Math.PI / 9  // 40° total (±20°)
      for (let h = 0; h < hitCount; h++) {
        const rotation = hitCount > 1
          ? (h / (hitCount - 1) - 0.5) * SPREAD
          : 0
        state.events.push({
          type: 'vfx',
          effectId: 'tapulele_psystrike',
          targetId: target.id,
          x: target.visualPos.x,
          y: target.visualPos.y,
          rotation,
        })
      }

      addStatusEffect(target, {
        id: `tapulele_psystrike_${target.id}`,
        sourceUnitId: unit.id,
        durationTicks: 2 * TICK_RATE - DAMAGE_EARLY_TICKS,
        stackId: `tapulele_psystrike_${target.id}`,
        onExpire: (_t, st) => {
          applyDamage(unit, target, {
            baseAmount:        damage * hitCount,
            damageType:        'magic',
            canCrit:           false,
            abilityScalingStat: 'special',
            abilityId:         'tapulele_natures_madness',
            spDefPiercePct:    psychic ? pierce : undefined,
          }, st)
        },
      })
    }
  },
}
