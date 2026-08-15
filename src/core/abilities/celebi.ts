import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, UnitMark } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addMark } from '../systems/marks'
import { addStatusEffect } from '../systems/statusEffect'

function findNearestUnmarkedEnemy(unit: Unit, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.team === unit.team || other.state === 'dead') continue
    if (other.marks.some(m => m.id.startsWith('celebi_mark_'))) continue
    const dx = other.visualPos.x - unit.visualPos.x
    const dy = other.visualPos.y - unit.visualPos.y
    const d  = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

// Nearest living enemy to a point — used to retarget the mark when its
// carrier dies before it detonates. Unlike findNearestUnmarkedEnemy this
// does not skip already-marked units, since right after a death there may be
// nothing else nearby to jump to.
function findNearestEnemyToPoint(x: number, y: number, casterTeam: Unit['team'], excludeId: string, state: CombatState): Unit | null {
  let best: Unit | null = null
  let bestDist = Infinity
  for (const other of state.units.values()) {
    if (other.id === excludeId || other.team === casterTeam || other.state === 'dead') continue
    const dx = other.visualPos.x - x
    const dy = other.visualPos.y - y
    const d  = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; best = other }
  }
  return best
}

// Places (or re-places, on transfer) the Future Sight mark on `target` with
// `durationTicks` remaining. If `target` dies before it detonates, the mark
// jumps — with its current remaining timing intact — to the nearest living
// enemy to where it died, instead of fizzling silently on the corpse.
function placeMark(caster: Unit, target: Unit, mult: number, detDmg: number, durationTicks: number, state: CombatState): void {
  target.incomingDamageMult = 1 + mult

  state.events.push({
    type: 'vfx',
    effectId: 'celebi_mark_apply',
    unitId: target.id,
    x: target.visualPos.x,
    y: target.visualPos.y,
  })

  addMark(target, {
    id: `celebi_mark_${target.id}`,
    sourceUnitId: caster.id,
    durationTicks,
    onDetonate: (marked: Unit, source: Unit | undefined, st: CombatState) => {
      // Deal damage first so the active incomingDamageMult amplifies the hit
      applyDamage(source ?? marked, marked, {
        baseAmount:        detDmg,
        damageType:        'magic',
        canCrit:           false,
        abilityScalingStat: 'special',
        abilityId:         'celebi_future_sight',
      }, st)
      marked.incomingDamageMult = 1.0
    },
    onCarrierDeath: (marked: Unit, mark: UnitMark, st: CombatState) => {
      marked.incomingDamageMult = 1.0
      if (mark.durationTicks <= 0) return
      const next = findNearestEnemyToPoint(marked.visualPos.x, marked.visualPos.y, caster.team, marked.id, st)
      if (!next) return
      placeMark(caster, next, mult, detDmg, mark.durationTicks, st)
    },
  })
}

export const CelebiAbility: AbilityHandler = {
  abilityId: 'celebi_future_sight',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageMults  = [0.10, 0.20, 0.30] as const
    const detonDamages = [450,  600,  900 ] as const

    const mult   = damageMults[tier - 1]
    const detDmg = detonDamages[tier - 1]

    // Hop + spin animation on cast
    addStatusEffect(unit, {
      id: 'celebi_hop',
      sourceUnitId: unit.id,
      durationTicks: 20,
      magnitude: 20,
      stackId: 'celebi_hop',
    })

    const target = findNearestUnmarkedEnemy(unit, state)
    if (!target) return

    placeMark(unit, target, mult, detDmg, 2 * TICK_RATE, state)
  },
}
