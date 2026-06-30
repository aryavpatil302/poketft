import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { startLeap } from '../systems/movement'
import { hexId, hexesInRange, getNeighbors, isValidHex } from '../hexGrid'
import { findFurthestEnemyInRange } from '../systems/targeting'
import { computeStats } from '../unitFactory'

const LEAP_HASTE = 4.5

export const ExcadrillAbility: AbilityHandler = {
  abilityId: 'excadrill_drill_run',
  castTimeTicks: 10,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [250, 375, 500] as const
    const bonusDmgs    = [110, 165, 300] as const

    const damage   = damageValues[tier - 1]
    const bonusDmg = bonusDmgs[tier - 1]

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

      // 3 empowered autos — primary target takes auto + bonus; adjacent enemies take both too
      for (let i = 0; i < 3; i++) {
        u.attackModifiers.push({
          id: 'excadrill_drill',
          remainingCharges: 1,
          bonusDamage: bonusDmg,
          bonusDamageType: 'physical',
          onHit: (src, tgt, st) => {
            const srcAtk = (src._computedStats ?? computeStats(src)).attack
            for (const hex of hexesInRange(tgt.hexPos, 1)) {
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
          },
        })
      }

      u.targetId = targetId
    })

    unit.state = 'leaping'
  },
}
