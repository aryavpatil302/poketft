import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState, tickUnit } from '../combatEngine'
import { hexId, getNeighbors } from '../hexGrid'
import { startLeap, recalculatePath, reconcileHexOccupancy } from './movement'
import { acquireTarget } from './targeting'
import { addStatusEffect, tickStatusEffects } from './statusEffect'
import type { CombatState, Unit } from '../types'

import '../systems/ability'   // register ability handlers

function state1v1(pHex = { col: 3, row: 5 }, eHex = { col: 3, row: 1 }): { u: Unit; e: Unit; state: CombatState } {
  const u = makeUnit('tangela', 'player', 1); u.hexPos = { ...pHex }
  const e = makeUnit('dummy', 'enemy', 1);   e.hexPos = { ...eHex }
  const state = createCombatState([u], [e])
  return { u, e, state }
}

// ─── Fix A: CC hard-stop in the unified per-unit step ────────────────────────
describe('unified tickUnit — CC blocks casting (bug 1)', () => {
  it('a stunned unit at full mana does not cast', () => {
    const u = makeUnit('tapu_lele', 'player', 1); u.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1);       e.hexPos = { col: 3, row: 4 }
    const state = createCombatState([u], [e])
    u.currentMana = u.maxMana
    expect(u.maxMana).toBeGreaterThan(0)

    addStatusEffect(u, { id: 'stun', sourceUnitId: 'x', durationTicks: 60, stackId: 'stun' })
    tickStatusEffects(state.units, state)   // forces u.state = 'stunned'
    expect(u.state).toBe('stunned')

    tickUnit(u, state)
    expect(u.state).toBe('stunned')          // NOT 'casting'
    expect(u.currentMana).toBe(u.maxMana)    // mana not consumed
  })
})

// ─── Fix A: Tapu Lele channel roots in the shared (headless) step (bug 4) ────
describe('unified tickUnit — tapulele_channel roots (bug 4)', () => {
  it('a channeling unit does not start moving toward a far enemy', () => {
    const { u, state } = state1v1()
    u.currentMana = 0   // won't cast
    addStatusEffect(u, { id: 'tapulele_channel', sourceUnitId: u.id, durationTicks: 60, stackId: 'tapulele_channel' })
    tickUnit(u, state)
    expect(u.state).toBe('idle')   // rooted — did not enter 'moving'
  })
})

// ─── Fix C: stale moveProgress can't stack the next slide (bug 2) ────────────
describe('recalculatePath resets moveProgress (bug 2)', () => {
  it('a fresh path zeroes a stale fractional moveProgress', () => {
    const { u, e, state } = state1v1()
    u.targetId = e.id
    u.moveProgress = 0.5   // leftover from an interrupted slide
    recalculatePath(u, state)
    expect(u.moveProgress).toBe(0)
    expect(u.path.length).toBeGreaterThan(0)
  })
})

// ─── Fix B: reconcile self-heals in-flight interrupt leaks (bug 3) ───────────
describe('reconcileHexOccupancy — self-heals interrupt leaks (bug 3)', () => {
  it('frees an orphaned reservation left by a bare force-idle', () => {
    const { u, state } = state1v1()
    u.state = 'idle'
    const orphan = hexId({ col: 3, row: 4 })
    state.hexOccupancy.set(orphan, u.id)   // leaked destination reservation

    reconcileHexOccupancy(state)

    expect(state.hexOccupancy.get(orphan)).toBeUndefined()          // orphan freed
    expect(state.hexOccupancy.get(hexId(u.hexPos))).toBe(u.id)      // still owns its own hex
  })

  it('clears a stranded _leap and reclaims the unit’s hex', () => {
    const { u, state } = state1v1()
    const origin = { ...u.hexPos }
    u.state = 'leaping'
    startLeap(u, { col: 3, row: 3 }, state, 2)   // frees origin, sets _leap
    expect(state.hexOccupancy.has(hexId(origin))).toBe(false)
    u.state = 'ascended'                         // force-interrupted without cleanup

    reconcileHexOccupancy(state)

    expect(u._leap).toBeUndefined()                                // stranded leap cleared
    expect(u.hexPos).toEqual(origin)
    expect(state.hexOccupancy.get(hexId(origin))).toBe(u.id)       // hex reclaimed
  })
})

// ─── Fix D-5: a unit boxed in by allies can still path out ───────────────────
describe('findPath — squeeze through allies when boxed in (bug 5)', () => {
  it('routes through stationary allies but not through stationary enemies', () => {
    // Mover in a corner; every forward neighbor occupied; enemy beyond.
    const mover = makeUnit('tangela', 'player', 1); mover.hexPos = { col: 0, row: 7 }
    const target = makeUnit('dummy', 'enemy', 1);   target.hexPos = { col: 0, row: 3 }
    const allies = getNeighbors(mover.hexPos).map((h, i) => {
      const a = makeUnit('tangela', 'player', 1); a.hexPos = { ...h }; a.id = `ally_${i}`; return a
    })
    const state = createCombatState([mover, ...allies], [target])
    mover.targetId = target.id

    recalculatePath(mover, state)
    expect(mover.path.length).toBeGreaterThan(0)   // found a route through allies

    // Control: same wall but made of stationary enemies → hard-blocked, no path.
    for (const a of allies) { a.team = 'enemy' }
    state.units.forEach(u => { u._computedStats = null })
    recalculatePath(mover, state)
    expect(mover.path.length).toBe(0)
  })
})

// ─── Fix D-6: targeting avoids an unreachable nearest enemy ───────────────────
describe('acquireTarget — prefers a reachable enemy (bug 6)', () => {
  it('does not lock onto a nearest enemy walled off by stationary enemies', () => {
    const mover = makeUnit('tangela', 'player', 1); mover.hexPos = { col: 0, row: 7 }
    // Nearest enemy, fully surrounded by other stationary enemies → unreachable.
    const walled = makeUnit('dummy', 'enemy', 1); walled.hexPos = { col: 0, row: 5 }
    const wall = getNeighbors(walled.hexPos).map((h, i) => {
      const w = makeUnit('dummy', 'enemy', 1); w.hexPos = { ...h }; w.id = `wall_${i}`; return w
    })
    // A clearly reachable enemy far away in the open.
    const reachable = makeUnit('dummy', 'enemy', 1); reachable.hexPos = { col: 6, row: 7 }
    const state = createCombatState([mover], [walled, ...wall, reachable])

    const chosen = acquireTarget(mover, state)
    expect(chosen).not.toBe(walled.id)   // didn't park on the unreachable nearest
    expect(chosen).not.toBeNull()
  })
})
