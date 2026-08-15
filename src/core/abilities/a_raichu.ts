import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { startLeap } from '../systems/movement'
import { createProjectile } from '../projectile'
import { hexDistance, hexId, hexesInRange, isValidHex } from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'
import { addStatusEffect } from '../systems/statusEffect'
import { computeStats } from '../unitFactory'

/**
 * Find a dash hex (2 steps away, fallback 1) that:
 *  1. Keeps the current attack target in range (priority)
 *  2. Maximises distance from the nearest threat (secondary)
 */
function findSafetyDash(
  unit: Unit,
  state: CombatState,
  currentTarget: Unit | undefined,
  attackRange: number,
): { col: number; row: number } | null {
  const enemies = [...state.units.values()].filter(u => u.team !== unit.team && u.state !== 'dead')
  if (enemies.length === 0) return null

  const nearestThreat = enemies.reduce((closest, e) =>
    hexDistance(e.hexPos, unit.hexPos) < hexDistance(closest.hexPos, unit.hexPos) ? e : closest
  )

  for (const targetDist of [2, 1]) {
    const candidates = hexesInRange(unit.hexPos, targetDist)
      .filter(h => isValidHex(h) && hexDistance(h, unit.hexPos) === targetDist)
      .filter(h => {
        const occ = state.hexOccupancy.get(hexId(h))
        return !occ || occ === unit.id
      })
      .filter(h => enemies.some(e => hexDistance(h, e.hexPos) <= attackRange))
    if (candidates.length === 0) continue

    candidates.sort((a, b) => {
      // Priority 1: prefer hexes that keep the current attack target in range
      const aKeepsTarget = currentTarget ? hexDistance(a, currentTarget.hexPos) <= attackRange : false
      const bKeepsTarget = currentTarget ? hexDistance(b, currentTarget.hexPos) <= attackRange : false
      if (aKeepsTarget !== bKeepsTarget) return aKeepsTarget ? -1 : 1
      // Priority 2: prefer hexes toward the ally base — player wants higher rows (bottom),
      //             enemy wants lower rows (top), so Raichu retreats rather than diving deeper
      const allyRowDiff = unit.team === 'player' ? b.row - a.row : a.row - b.row
      if (allyRowDiff !== 0) return allyRowDiff
      // Priority 3: maximise distance from the target (or nearest threat if no target)
      const ref = currentTarget ?? nearestThreat
      return hexDistance(b, ref.hexPos) - hexDistance(a, ref.hexPos)
    })
    return candidates[0]
  }
  return null
}

// Bolts-per-target grows with Raichu's own dash count, not the team spell
// buff — 1st dash: 1 bolt/target, 2nd: 3, 3rd: 5, ... (+2 per dash). Tracked
// as a permanent self status effect so it persists across the whole fight.
const DASH_STACK_ID = 'a_raichu_dash_stacks'

function boltsPerTargetFor(unit: Unit): number {
  const dashesSoFar = unit.statusEffects.find(fx => fx.stackId === DASH_STACK_ID)?.magnitude ?? 0
  return 1 + dashesSoFar * 2
}

function incrementDashStacks(unit: Unit): void {
  const existing = unit.statusEffects.find(fx => fx.stackId === DASH_STACK_ID)
  if (existing) existing.magnitude = (existing.magnitude ?? 0) + 1
  else addStatusEffect(unit, {
    id: DASH_STACK_ID, sourceUnitId: unit.id, durationTicks: -1, magnitude: 1, stackId: DASH_STACK_ID,
  })
}

export const ARaichuAbility: AbilityHandler = {
  abilityId: 'a_raichu_surge_surfer',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const basePcts = [60, 80, 100] as const
    // Beachy spell buff now adds flat special% per stack to EACH bolt's
    // damage, instead of controlling how many bolts fire (that's the dash
    // count below) — 4 stacks = +4% special on top of the tier base.
    const bonusPct = getSpellBuff(unit, state)
    const boltPct = basePcts[tier - 1] + bonusPct

    const attackRange = (unit._computedStats ?? computeStats(unit)).range

    // Prefer a dash hex that keeps the current attack target in range
    const currentTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const validTarget = currentTarget && currentTarget.state !== 'dead' ? currentTarget : undefined
    const dest = findSafetyDash(unit, state, validTarget, attackRange)
    if (!dest) return

    const boltsPerTarget = boltsPerTargetFor(unit)
    const primaryTargetId = unit.targetId  // capture before leap

    startLeap(unit, dest, state, 5.0, undefined, (u, s) => {
      // After landing, keep targeting the original unit if still in range;
      // otherwise let the combat engine recalculate naturally
      if (primaryTargetId) {
        const primaryTarget = s.units.get(primaryTargetId)
        if (primaryTarget && primaryTarget.state !== 'dead' && hexDistance(u.hexPos, primaryTarget.hexPos) <= attackRange) {
          u.targetId = primaryTargetId
        }
      }

      // Build a pool of up to 2 target units (primary first, then nearest other)
      const allNear = findNearestEnemies(u, s, 3)
      const primary = primaryTargetId ? s.units.get(primaryTargetId) : undefined
      const targetPool: Unit[] = []
      if (primary && primary.state !== 'dead') targetPool.push(primary)
      for (const t of allNear) {
        if (targetPool.length >= 2) break
        if (t.id !== primary?.id) targetPool.push(t)
      }
      if (targetPool.length === 0) return

      const totalBolts = boltsPerTarget * targetPool.length
      const BOLT_INTERVAL = 5  // ticks between each bolt (~83 ms)

      // Cycle through the target pool so bolts alternate targets visually
      // (e.g. A,B,A,B,...) while still landing exactly boltsPerTarget on each.
      for (let i = 0; i < totalBolts; i++) {
        const tgt = targetPool[i % targetPool.length]
        const capturedTargetId = tgt.id

        const fireProj = (raichu: Unit, st: CombatState) => {
          const target = st.units.get(capturedTargetId)
          if (!target || target.state === 'dead') return
          const proj = createProjectile({
            sourceId: raichu.id,
            targetId: target.id,
            startPos: { ...raichu.visualPos },
            speed: 14,
            damagePayload: { baseAmount: boltPct, damageType: 'magic', canCrit: false, abilityScalingStat: 'special', beachyFrac: boltPct > 0 ? bonusPct / boltPct : 0 },
            abilityId: 'a_raichu_surge_surfer',
          })
          st.projectiles.set(proj.id, proj)
        }

        if (i === 0) {
          fireProj(u, s)
        } else {
          addStatusEffect(u, {
            id: 'a_raichu_queued_bolt',
            sourceUnitId: u.id,
            durationTicks: i * BOLT_INTERVAL,
            stackId: `a_raichu_bolt_${u.id}_${i}`,
            onExpire: (raichu, st) => fireProj(raichu, st),
          })
        }
      }
    })

    unit.state = 'leaping'
    incrementDashStacks(unit)
    incrementSpellBuff(unit, state)
  },
}
