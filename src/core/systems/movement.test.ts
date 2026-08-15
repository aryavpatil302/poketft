import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { hexId, isValidHex, BOARD_COLS, BOARD_ROWS } from '../hexGrid'
import { startLeap, tickLeapPixel, teleportUnit } from './movement'
import { addStatusEffect, tickStatusEffects } from './statusEffect'
import type { CombatState, Unit } from '../types'
import type { OffsetCoord } from '../hexGrid'

function makeState(): { state: CombatState; unit: Unit; enemy: Unit } {
  const unit = makeUnit('tangela', 'player', 1)
  const enemy = makeUnit('dummy', 'enemy', 1)
  unit.hexPos = { col: 2, row: 4 }
  enemy.hexPos = { col: 3, row: 1 }
  const state = createCombatState([unit], [enemy])
  return { state, unit, enemy }
}

// A stun/knockup landing mid-move or mid-leap must never leave two units
// mapped to the same hex, and hexOccupancy must always agree with hexPos.
function assertNoSharedHexes(state: CombatState): void {
  const seen = new Map<string, string>()
  for (const u of state.units.values()) {
    if (u.state === 'dead') continue
    const key = hexId(u.hexPos)
    expect(seen.has(key), `hex ${key} claimed by both ${seen.get(key)} and ${u.id}`).toBe(false)
    seen.set(key, u.id)
    // Whoever hexOccupancy says owns this unit's hex must be this unit (or
    // nobody, for the odd one-tick "just started moving" window).
    const owner = state.hexOccupancy.get(key)
    expect(owner === undefined || owner === u.id).toBe(true)
  }
}

// Run a leap to completion the way combatEngine's tickLeapMovement does.
function advanceLeap(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (tickLeapPixel(unit, state)) break
  }
}

function addUnitAt(state: CombatState, hex: OffsetCoord, team: 'player' | 'enemy' = 'player'): Unit {
  const u = makeUnit('tangela', team, 1)
  u.hexPos = { ...hex }
  state.units.set(u.id, u)
  state.hexOccupancy.set(hexId(hex), u.id)
  return u
}

// A dash reserves nothing while in flight: startLeap picks the destination at
// cast time and only claims it on landing, so the hex can be taken in between.
// The incumbent keeps it; the arriving unit slides to the nearest open hex.
describe('hex claiming — one unit per hex', () => {
  it('a dash landing on a hex taken mid-flight lands on the nearest open hex instead', () => {
    const { state, unit } = makeState()
    const destHex = { col: 4, row: 4 }

    unit.state = 'leaping'
    startLeap(unit, destHex, state, 2)

    // Someone walks into the destination while the dash is in the air
    const squatter = addUnitAt(state, destHex)

    advanceLeap(unit, state)

    expect(squatter.hexPos).toEqual(destHex)                              // incumbent keeps it
    expect(state.hexOccupancy.get(hexId(destHex))).toBe(squatter.id)
    expect(unit.hexPos).not.toEqual(destHex)                              // arriver slid off
    expect(state.hexOccupancy.get(hexId(unit.hexPos))).toBe(unit.id)
    assertNoSharedHexes(state)
  })

  it('teleporting onto an occupied hex does not evict the occupant', () => {
    const { state, unit } = makeState()
    const destHex = { col: 4, row: 5 }
    const squatter = addUnitAt(state, destHex)

    teleportUnit(unit, destHex, state)

    expect(squatter.hexPos).toEqual(destHex)
    expect(state.hexOccupancy.get(hexId(destHex))).toBe(squatter.id)
    expect(unit.hexPos).not.toEqual(destHex)
    expect(state.hexOccupancy.get(hexId(unit.hexPos))).toBe(unit.id)
    assertNoSharedHexes(state)
  })

  it('landing on a hex whose occupant is dead takes the hex', () => {
    const { state, unit } = makeState()
    const destHex = { col: 4, row: 4 }
    unit.state = 'leaping'
    startLeap(unit, destHex, state, 2)

    const corpse = addUnitAt(state, destHex)
    corpse.state = 'dead'

    advanceLeap(unit, state)

    expect(unit.hexPos).toEqual(destHex)
    expect(state.hexOccupancy.get(hexId(destHex))).toBe(unit.id)
  })

  it('falls back to its origin hex when every other hex is taken', () => {
    const { state, unit } = makeState()
    const originHex = { ...unit.hexPos }

    unit.state = 'leaping'
    startLeap(unit, { col: 4, row: 4 }, state, 2)

    // Fill every hex except the one he took off from. (A leaping unit owns no
    // hex mid-flight, so its origin reads as free — skip it explicitly.)
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const hex = { col, row }
        if (!isValidHex(hex)) continue
        if (hex.col === originHex.col && hex.row === originHex.row) continue
        if (state.hexOccupancy.has(hexId(hex))) continue
        addUnitAt(state, hex)
      }
    }

    advanceLeap(unit, state)

    // Nowhere else to go — he ends up back where he started, not stacked
    expect(unit.hexPos).toEqual(originHex)
    expect(state.hexOccupancy.get(hexId(originHex))).toBe(unit.id)
    assertNoSharedHexes(state)
  })
})

describe('cancelInFlightMovement (via stun/knockup mid-move)', () => {
  it('stunning a unit mid hex-slide snaps it to the already-reserved next hex', () => {
    const { state, unit } = makeState()
    const destHex = { col: 3, row: 4 }
    unit.state = 'moving'
    unit.path = [destHex]
    // Reserve the destination the way tickMovement would on the first tick of the slide
    state.hexOccupancy.delete(hexId(unit.hexPos))
    state.hexOccupancy.set(hexId(destHex), unit.id)
    unit.moveProgress = 0.4

    addStatusEffect(unit, { id: 'stun', sourceUnitId: 'x', durationTicks: 30, stackId: 'stun' })
    tickStatusEffects(state.units, state)

    expect(unit.state).toBe('stunned')
    expect(unit.hexPos).toEqual(destHex)
    expect(unit.path).toHaveLength(0)
    expect(unit.moveProgress).toBe(0)
    expect(state.hexOccupancy.get(hexId(destHex))).toBe(unit.id)
    assertNoSharedHexes(state)
  })

  it('stunning a unit mid-leap re-claims its origin hex instead of leaving it unowned', () => {
    const { state, unit } = makeState()
    const originHex = { ...unit.hexPos }
    unit.state = 'leaping'
    startLeap(unit, { col: 4, row: 4 }, state, 2, undefined, undefined, false)
    // startLeap frees the origin hex immediately for a real (non-visual) leap
    expect(state.hexOccupancy.has(hexId(originHex))).toBe(false)

    addStatusEffect(unit, { id: 'knockUp', sourceUnitId: 'x', durationTicks: 20, stackId: 'knockUp' })
    tickStatusEffects(state.units, state)

    expect(unit.state).toBe('knockedUp')
    expect(unit._leap).toBeUndefined()
    expect(unit.hexPos).toEqual(originHex)
    expect(state.hexOccupancy.get(hexId(originHex))).toBe(unit.id)
    assertNoSharedHexes(state)
  })

  it('stunning a unit mid-leap relocates it when another unit took its origin (no shared hex)', () => {
    // The reported bug: a real leap frees its origin, another unit moves onto that
    // origin during the flight, then the leaper is CC'd. The interrupt must NOT
    // blindly re-claim the origin (clobbering the incumbent) — it must relocate.
    const unit     = makeUnit('tangela', 'player', 1)
    const intruder = makeUnit('dummy', 'enemy', 1)
    unit.hexPos     = { col: 2, row: 4 }
    intruder.hexPos = { col: 5, row: 5 }
    const state = createCombatState([unit], [intruder])
    const originHex = { ...unit.hexPos }

    unit.state = 'leaping'
    startLeap(unit, { col: 4, row: 4 }, state, 2, undefined, undefined, false)
    expect(state.hexOccupancy.has(hexId(originHex))).toBe(false)

    // Another unit claims the now-free origin mid-flight.
    intruder.hexPos = { ...originHex }
    state.hexOccupancy.set(hexId(originHex), intruder.id)

    addStatusEffect(unit, { id: 'knockUp', sourceUnitId: 'x', durationTicks: 20, stackId: 'knockUp' })
    tickStatusEffects(state.units, state)

    expect(unit.state).toBe('knockedUp')
    expect(unit._leap).toBeUndefined()
    // Incumbent keeps the origin; the interrupted leaper is relocated elsewhere.
    expect(state.hexOccupancy.get(hexId(originHex))).toBe(intruder.id)
    expect(hexId(unit.hexPos)).not.toBe(hexId(originHex))
    expect(state.hexOccupancy.get(hexId(unit.hexPos))).toBe(unit.id)
    assertNoSharedHexes(state)
  })

  it('knockup landing on a unit that just entered "moving" this tick (nothing reserved yet) leaves hexPos/occupancy untouched and consistent', () => {
    const { state, unit } = makeState()
    const originHex = { ...unit.hexPos }
    unit.state = 'moving'
    unit.path = [{ col: 3, row: 4 }]
    unit.moveProgress = 0   // no tickMovement has run for this leg yet — nothing reserved

    addStatusEffect(unit, { id: 'knockUp', sourceUnitId: 'x', durationTicks: 20, stackId: 'knockUp' })
    tickStatusEffects(state.units, state)

    expect(unit.state).toBe('knockedUp')
    expect(unit.hexPos).toEqual(originHex)
    expect(unit.path).toHaveLength(0)
    expect(state.hexOccupancy.get(hexId(originHex))).toBe(unit.id)
    assertNoSharedHexes(state)
  })
})
