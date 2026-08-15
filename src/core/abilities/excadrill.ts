import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect, removeStatusEffectByStack } from '../systems/statusEffect'
import { startLeap } from '../systems/movement'
import { hexId, hexesInRange, getNeighbors, isValidHex } from '../hexGrid'
import { findFurthestEnemyInRange } from '../systems/targeting'
import { computeStats } from '../unitFactory'

const LEAP_HASTE = 4.5

export const ExcadrillAbility: AbilityHandler = {
  abilityId: 'excadrill_drill_run',
  castTimeTicks: 10,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [385, 575, 770] as const
    const bonusDmgs    = [170, 250, 460] as const

    const stats    = computeStats(unit)
    const damage   = Math.round(stats.attack * (damageValues[tier - 1] / 100))
    const bonusDmg = Math.round(stats.attack * (bonusDmgs[tier - 1] / 100))

    // Furthest enemy within 3 hexes; fall back to current target
    const leapTarget = findFurthestEnemyInRange(unit, state, 3)
      ?? (unit.targetId ? (state.units.get(unit.targetId) ?? null) : null)
    if (!leapTarget || leapTarget.state === 'dead') return

    // Find an open adjacent hex to the target to land on
    const dest = getNeighbors(leapTarget.hexPos).find(h => {
      if (!isValidHex(h)) return false
      const occ = state.hexOccupancy.get(hexId(h))
      return !occ || occ === unit.id
    })
    if (!dest) return

    const targetId = leapTarget.id

    // Invulnerable during the tunnel
    unit.incomingDamageMult = 0

    startLeap(unit, dest, state, LEAP_HASTE, (u, s) => {
      // Restore vulnerability on landing
      u.incomingDamageMult = 1.0
      s.events.push({ type: 'vfx', effectId: 'excadrill_land', unitId: u.id })

      const target = s.units.get(targetId)
      if (!target || target.state === 'dead') return

      // Knockup 0.5s
      addStatusEffect(target, {
        id: 'knockUp',
        sourceUnitId: u.id,
        durationTicks: Math.round(0.5 * TICK_RATE),
        stackId: `excadrill_knockup_${target.id}`,
      })

      // Landing damage
      applyDamage(u, target, {
        baseAmount: damage,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'excadrill_drill_run',
      }, s)

      // The orbit-spin VFX is driven per-auto off windup progress in unitLayer,
      // keyed on the excadrill_drill attack modifiers queued below.

      // Empowered mode blocks ALL mana gain, not just the on-hit mana the
      // modifiers already suppress — he must not re-cast off damage taken
      // mid-sequence. Cleared by the last empowered auto; the duration is only
      // a safety net for a sequence that never finishes (death, no target).
      addStatusEffect(u, {
        id: 'excadrill_empowered',
        sourceUnitId: u.id,
        durationTicks: 10 * TICK_RATE,
        stackId: 'excadrill_empowered',
        suppressManaGain: true,
      })

      // 3 empowered autos — primary target takes auto + bonus; adjacent enemies take both too
      for (let i = 0; i < 3; i++) {
        const isLast = i === 2
        u.attackModifiers.push({
          id: 'excadrill_drill',
          remainingCharges: 1,
          bonusDamage: bonusDmg,
          bonusDamageType: 'physical',
          suppressManaGain: true,
          onHit: (src, tgt, st) => {
            const srcAtk = (src._computedStats ?? computeStats(src)).attack
            // Centered on Excadrill himself, not the attack target — he hits everyone
            // directly adjacent to him, not everyone adjacent to whoever he's attacking.
            for (const hex of hexesInRange(src.hexPos, 1)) {
              const uid = st.hexOccupancy.get(hexId(hex))
              if (!uid || uid === tgt.id) continue
              const adj = st.units.get(uid)
              if (!adj || adj.team === src.team || adj.state === 'dead') continue
              applyDamage(src, adj, {
                baseAmount: srcAtk + bonusDmg,
                damageType: 'physical',
                canCrit: true,
                abilityId: 'excadrill_drill_run',
              }, st)
            }
            // Sequence over — back to normal autos and normal mana gain.
            if (isLast) removeStatusEffectByStack(src, 'excadrill_empowered')
          },
        })
      }

      u.targetId = targetId
    }, undefined, undefined, (u) => {
      // Dash interrupted (stun/knockup mid-tunnel, or force-idled): restore
      // vulnerability, otherwise incomingDamageMult stays 0 and he's immune forever.
      u.incomingDamageMult = 1.0
    })

    unit.state = 'leaping'
  },
}
