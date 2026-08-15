import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import type { OffsetCoord } from '../hexGrid'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { findNearestEnemies } from '../systems/targeting'
import { startLeap, findBestAttackHex, claimHex } from '../systems/movement'
import { hexDistance } from '../hexGrid'
import { computeStats } from '../unitFactory'

// ~0.5s total: cockback (30% of outbound) → sharp strike → quick return
const OUTBOUND_TICKS = 18   // ~0.3s outbound per target
const RETURN_TICKS   = 12   // ~0.2s return home

const HP_BONUS   = 1.60   // +60% vs targets with higher max HP
const RECAST_PCT = 0.75   // 75% damage on chain recast
const MIN_DAMAGE = 30     // stop chain below this (prevents infinite loop)

export const TalonflameAbility: AbilityHandler = {
  abilityId: 'talonflame_brave_bird',
  castTimeTicks: 15,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dmgPcts = [350, 565, 715] as const
    const returnHex: OffsetCoord = { ...unit.hexPos }
    diveAt(unit, state, Math.round(computeStats(unit).attack * (dmgPcts[tier - 1] / 100)), returnHex, 0)
  },
}

function diveAt(
  unit: Unit,
  state: CombatState,
  damage: number,
  returnHex: OffsetCoord,
  depth: number,
): void {
  if (damage < MIN_DAMAGE || depth > 6) {
    returnHome(unit, state, returnHex)
    return
  }

  // Depth 0: prefer the current auto-attack target so the spell follows who Talonflame is fighting.
  // Chain recasts (depth > 0): previous target is dead, so nearest surviving enemy is correct.
  const atkTarget = depth === 0 && unit.targetId ? state.units.get(unit.targetId) : undefined
  const [nearest] = findNearestEnemies(unit, state, 1)
  const target = (atkTarget && atkTarget.state !== 'dead' && atkTarget.team !== unit.team)
    ? atkTarget : nearest
  if (!target) {
    returnHome(unit, state, returnHex)
    return
  }

  const enemyHex: OffsetCoord = { ...target.hexPos }

  // 60% bonus vs higher-HP targets (compares base max HP)
  const finalDmg = Math.round(damage * (target.maxHp > unit.maxHp ? HP_BONUS : 1.0))

  const dist  = Math.max(1, hexDistance(unit.hexPos, enemyHex))
  const haste = Math.max(0, (TICK_RATE * dist) / (OUTBOUND_TICKS * unit.moveSpeed) - 1)

  startLeap(unit, enemyHex, state, haste, (u: Unit, s: CombatState) => {
    const tgt = s.units.get(target.id)
    if (tgt && tgt.state !== 'dead') {
      applyDamage(u, tgt, {
        baseAmount: finalDmg,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'talonflame_brave_bird',
      }, s)
    }

    if (tgt?.state === 'dead') {
      // Kill confirmed — chain immediately; next dive returns near the killed target's hex
      // (it's now free, so it's the "closest hex to the target just killed")
      diveAt(u, s, Math.round(damage * RECAST_PCT), { ...enemyHex }, depth + 1)
    } else if (depth > 0) {
      // Chain recast that didn't kill — rest near THIS target, not the original
      // home hex (tgt can be gone entirely, not just dead — fall back home)
      const nearHex = (tgt ? findBestAttackHex(u, tgt, s) : null) ?? returnHex
      returnHome(u, s, nearHex)
    } else {
      returnHome(u, s, returnHex)
    }
  }, undefined, true)   // visual-only: hexPos stays at returnHex during the leap

  unit.state = 'leaping'
}

function returnHome(unit: Unit, state: CombatState, dest: OffsetCoord): void {
  const haste = Math.max(0, TICK_RATE / (RETURN_TICKS * unit.moveSpeed) - 1)
  startLeap(unit, dest, state, haste, (u, s) => {
    // Visual-only leap, so hexPos is committed here. dest may have been taken
    // during the flight — claimHex falls back to the nearest open hex.
    claimHex(u, dest, s)
    u.state = 'idle'
  }, undefined, true)
  unit.state = 'leaping'
}
