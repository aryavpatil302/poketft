import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { hexesInRange, hexId, getNeighbors, isValidHex } from '../hexGrid'
import { startLeap } from '../systems/movement'
import { addStatusEffect } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'
import { applyHeal } from '../systems/heal'
import type { OffsetCoord } from '../hexGrid'

const PAUSE_TICKS = 10  // brief pause after landing before the slash fires

// Shiny Absol's dash-stacking attack bonus, tracked as a single persistent
// self status effect (id 'dmg_buff' = flat attack, per unitFactory.ts's
// computeStats) so it shows up wherever active buffs are displayed — mirrors
// A-Raichu's own dash-stack idiom (a_raichu.ts's DASH_STACK_ID). A raw
// `unit.attack += 10` mutation (the previous implementation) is functionally
// identical for damage purposes but invisible to any UI that reads
// statusEffects, which is exactly what this fixes.
const SHINY_DASH_STACK_ID = 'absol_shiny_dash_stacks'

function grantShinyDashStack(unit: Unit): void {
  const existing = unit.statusEffects.find(fx => fx.stackId === SHINY_DASH_STACK_ID)
  if (existing) {
    existing.magnitude = (existing.magnitude ?? 0) + 10
    unit._computedStats = null
  } else {
    addStatusEffect(unit, {
      id: 'dmg_buff', sourceUnitId: unit.id, durationTicks: -1,
      magnitude: 10, stackId: SHINY_DASH_STACK_ID,
    })
  }
}

function findDashDest(unit: Unit, state: CombatState): OffsetCoord | null {
  const neighbors = getNeighbors(unit.hexPos)
  let bestHex: OffsetCoord | null = null
  let bestCount = -1

  for (const nb of neighbors) {
    if (!isValidHex(nb)) continue
    const occupant = state.hexOccupancy.get(hexId(nb))
    if (occupant && occupant !== unit.id) continue

    let count = 0
    for (const hex of hexesInRange(nb, 1)) {
      const uid = state.hexOccupancy.get(hexId(hex))
      if (!uid) continue
      const u = state.units.get(uid)
      if (u && u.team !== unit.team && u.state !== 'dead') count++
    }
    if (count > bestCount) { bestCount = count; bestHex = nb }
  }

  return bestCount > 0 ? bestHex : null
}

function doSlash(unit: Unit, state: CombatState, tier: number): void {
  const damageValues = [100, 150, 250] as const
  const healValues   = [50,  75,  100] as const
  const damage       = damageValues[tier - 1]
  const healPerHit   = healValues[tier - 1]

  // Compute angle toward nearest enemy before dealing damage (units may die mid-loop)
  let startAngle = 0
  let bestD = Infinity
  for (const u of state.units.values()) {
    if (u.team === unit.team || u.state === 'dead') continue
    const d = Math.hypot(u.visualPos.x - unit.visualPos.x, u.visualPos.y - unit.visualPos.y)
    if (d < bestD) { bestD = d; startAngle = Math.atan2(u.visualPos.y - unit.visualPos.y, u.visualPos.x - unit.visualPos.x) }
  }

  const hit = new Set<string>()
  for (const hex of hexesInRange(unit.hexPos, 1)) {
    const uid = state.hexOccupancy.get(hexId(hex))
    if (!uid || hit.has(uid)) continue
    const target = state.units.get(uid)
    if (!target || target.team === unit.team || target.state === 'dead') continue
    hit.add(uid)

    applyDamage(unit, target, {
      baseAmount:   damage,
      damageType:   'physical',
      canCrit:      true,
      scalingStat:  'attack',
      scalingRatio: 1.0,
      abilityId:    'absol_night_slash',
    }, state)

    applyHeal(unit, healPerHit, unit.id, state)
  }

  state.events.push({ type: 'vfx', effectId: 'absol_night_slash', unitId: unit.id, startAngle })
}

export const AbsolAbility: AbilityHandler = {
  abilityId: 'absol_night_slash',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dest = findDashDest(unit, state)

    if (dest) {
      // Shiny Absol: every REAL dash (this branch only — never the no-dash
      // slash-in-place fallback below) grants a permanent, for-this-fight
      // +10 attack, stacking across multiple dashes. Mirrors Armor Cannon's
      // existing in-combat pattern.
      if (unit.isShiny) {
        grantShinyDashStack(unit)
      }

      const capturedTier = tier
      startLeap(unit, dest, state, 10.0, (u, _s) => {
        // Drop pre-dash target so tickTargeting re-acquires from the new hex position.
        u.targetId = null
        // After landing: brief pause, then slash.
        // tickEffect cancels any movement the combat loop starts during the pause
        // so Absol stays planted at the dash hex until the slash fires.
        addStatusEffect(u, {
          id:           'absol_pre_slash',
          sourceUnitId: u.id,
          durationTicks: PAUSE_TICKS,
          stackId:      'absol_pre_slash',
          tickEffect:   (uu) => { if (uu.state === 'moving') uu.state = 'idle' },
          onExpire:     (uu, ss) => doSlash(uu, ss, capturedTier),
        })
      })
      unit.state = 'leaping'
    } else {
      // No valid dash destination — slash in place immediately
      doSlash(unit, state, tier)
    }
  },
}
