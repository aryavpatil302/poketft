import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE } from '../constants'
import { computeStats } from '../unitFactory'
import { createProjectile } from '../projectile'
import { addStatusEffect } from '../systems/statusEffect'
import { hexDistance } from '../hexGrid'

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

// Nearest ally to a pixel position — for finding the ally closest to the hit enemy
function findNearestAllyToPos(
  casterTeam: string,
  px: number, py: number,
  state: CombatState,
): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.team !== casterTeam || other.state === 'dead') continue
    const dx = other.visualPos.x - px
    const dy = other.visualPos.y - py
    const d = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

export const MorelullAbility: AbilityHandler = {
  abilityId: 'morelull_strength_sap',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const baseDamages = [300, 450, 700] as const
    const healPcts    = [0.85, 1.00, 1.30] as const

    const damage  = baseDamages[tier - 1]
    const healPct = healPcts[tier - 1]
    const spMult  = (unit._computedStats ?? computeStats(unit)).special / 100

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const enemy = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemy(unit, state)
    if (!enemy) return

    const casterTeam = unit.team

    // Brief shake when launching
    addStatusEffect(unit, {
      id: 'morelull_shake',
      sourceUnitId: unit.id,
      durationTicks: 14,
      magnitude: 14,
      stackId: 'morelull_shake',
    })

    state.projectiles.set(
      `proj_${Math.random().toString(36).slice(2, 9)}`,
      createProjectile({
        sourceId: unit.id,
        targetId: enemy.id,
        startPos: { ...unit.visualPos },
        speed: 10,
        abilityId: 'morelull_strength_sap',
        damagePayload: {
          baseAmount:        damage,
          damageType:        'magic',
          canCrit:           false,
          abilityScalingStat: 'special',
          abilityId:         'morelull_strength_sap',
        },
        onHit: (_src, tgt, st) => {
          // 33% attack reduction for 3 seconds (flat of their current attack)
          const atkBefore = computeStats(tgt).attack
          const flatReduction = Math.round(atkBefore * 0.33)
          if (flatReduction > 0) {
            addStatusEffect(tgt, {
              id: 'atk_reduction',
              sourceUnitId: unit.id,
              durationTicks: 3 * TICK_RATE,
              magnitude: flatReduction,
              stackId: `morelull_atkreduc_${tgt.id}`,
            })
          }

          // Heal amount = healPct × target's attack (before applying the reduction), scaled by Morelull's spell power
          const healAmount = Math.round(atkBefore * healPct * spMult)
          if (healAmount <= 0) return

          // Second projectile: from enemy → nearest ally to that enemy
          const ally = findNearestAllyToPos(casterTeam, tgt.visualPos.x, tgt.visualPos.y, st)
          if (!ally) return

          st.projectiles.set(
            `proj_${Math.random().toString(36).slice(2, 9)}`,
            createProjectile({
              sourceId: tgt.id,
              targetId: ally.id,
              startPos: { ...tgt.visualPos },
              speed: 8,
              abilityId: 'morelull_strength_sap_heal',
              healPayload: { amount: healAmount },
            }),
          )
        },
      }),
    )
  },
}
