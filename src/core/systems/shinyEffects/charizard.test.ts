import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// New shape being introduced by this batch: shiny-conditional combat
// behavior tests. Every test below sets `isShiny = true` on exactly the
// unit(s) that should be affected, and includes a non-shiny control proving
// the effect does NOT fire without it.

import './index'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('Shiny Charizard — 30 less max mana', () => {
  it('(a) reduces maxMana by exactly 30 (base 80 -> 50)', () => {
    const charizard = makeUnit('charizard', 'player', 1)
    charizard.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([charizard], [enemy])

    const self = state.units.get(charizard.id)!
    expect(self.maxMana).toBe(50)
  })

  it('(b) currentMana is clamped down to the new maxMana if it would otherwise exceed it', () => {
    // startMana (50) equals the post-reduction maxMana (50) for Charizard
    // today, so this can't happen with real data — prove the clamp branch
    // itself works by forcing an over-cap currentMana before combat start.
    const charizard = makeUnit('charizard', 'player', 1)
    charizard.isShiny = true
    charizard.currentMana = 9999
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([charizard], [enemy])

    const self = state.units.get(charizard.id)!
    expect(self.currentMana).toBe(self.maxMana)
    expect(self.currentMana).toBe(50)
  })

  it('(c) currentMana below the new cap is left untouched', () => {
    const charizard = makeUnit('charizard', 'player', 1)
    charizard.isShiny = true
    charizard.currentMana = 10
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([charizard], [enemy])

    const self = state.units.get(charizard.id)!
    expect(self.currentMana).toBe(10)
  })

  it('(d) does not touch a teammate\'s mana — self-only', () => {
    const charizard = makeUnit('charizard', 'player', 1)
    charizard.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const allyMaxManaBefore = ally.maxMana
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([charizard, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    expect(allyUnit.maxMana).toBe(allyMaxManaBefore)
  })

  it('(e) non-shiny control — a non-shiny Charizard keeps its normal 80 maxMana', () => {
    const charizard = makeUnit('charizard', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([charizard], [enemy])

    const self = state.units.get(charizard.id)!
    expect(self.maxMana).toBe(80)
  })

  it('(f) edge case — the floor at 0 never produces a negative maxMana even with a hypothetically small base', () => {
    // Simulate a rebalanced Charizard with maxMana already below the 30
    // reduction by mutating a fresh unit's maxMana directly before the
    // shiny hook fires would require re-running createCombatState — instead
    // call the registered effect's onCombatStart directly with a crafted unit.
    const charizard = makeUnit('charizard', 'player', 1)
    charizard.isShiny = true
    charizard.maxMana = 10
    charizard.currentMana = 10
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([charizard], [enemy])

    const self = state.units.get(charizard.id)!
    expect(self.maxMana).toBeGreaterThanOrEqual(0)
    expect(self.maxMana).toBe(0)
    expect(self.currentMana).toBe(0)
  })
})
