import { describe, it, expect, afterEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { SHINY_EFFECT_REGISTRY, initShinyEffects } from './shinyEffects'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered (required by createCombatState → initAbilityPassives)
import './ability'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Place units on the board and create combat state.
function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

// Registry hygiene: SHINY_EFFECT_REGISTRY is module-global and shared across
// test files in the same worker. Every test that registers an entry removes
// it here, and we assert it returns to empty so a leaked entry fails loudly
// here rather than corrupting an unrelated suite.
afterEach(() => {
  SHINY_EFFECT_REGISTRY.delete('tangela')
  expect(SHINY_EFFECT_REGISTRY.size).toBe(0)
})

// ─── initShinyEffects: dispatch ────────────────────────────────────────────────

describe('shinyEffects — dispatch', () => {

  it('(a) empty registry, shiny unit — no effect and no crash; shields/statusEffects match a non-shiny control', () => {
    const shiny = makeUnit('tangela', 'player', 1)
    shiny.isShiny = true
    const control = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([shiny, control], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    const controlUnit = state.units.get(control.id)!
    expect(shinyUnit.shields.length).toBe(controlUnit.shields.length)
    expect(shinyUnit.statusEffects.length).toBe(controlUnit.statusEffects.length)
  })

  it('(b) registered effect fires exactly once for the shiny unit and receives (self, state)', () => {
    const fired: string[] = []
    let receivedState: CombatState | undefined
    SHINY_EFFECT_REGISTRY.set('tangela', {
      id: 'test_shiny_tangela',
      description: 'test-only effect',
      onCombatStart(self, state) {
        fired.push(self.id)
        receivedState = state
      },
    })

    const shiny = makeUnit('tangela', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([shiny], [enemy])

    expect(fired.length).toBe(1)
    expect(fired[0]).toBe(shiny.id)
    expect(receivedState).toBe(state)
  })

  it('(c) non-shiny unit of the same registered definitionId does not fire — isShiny gates dispatch, not the definitionId match', () => {
    const fired: string[] = []
    SHINY_EFFECT_REGISTRY.set('tangela', {
      id: 'test_shiny_tangela',
      description: 'test-only effect',
      onCombatStart(self) {
        fired.push(self.id)
      },
    })

    const shiny = makeUnit('tangela', 'player', 1)
    shiny.isShiny = true
    const nonShiny = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    makeState([shiny, nonShiny], [enemy])

    expect(fired.length).toBe(1)
    expect(fired[0]).toBe(shiny.id)
  })

  it('(d) shipped configuration smoke test — empty registry, createCombatState and a repeat initShinyEffects call do not throw', () => {
    const shiny = makeUnit('tangela', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    let state: CombatState
    expect(() => { state = makeState([shiny], [enemy]) }).not.toThrow()
    expect(() => initShinyEffects(state!)).not.toThrow()
  })
})

// ─── initShinyEffects: universal stat passive ──────────────────────────────────

describe('shinyEffects — universal stat passive', () => {

  it('(a) shiny 1-star Tangela gets exactly +5% on the six base stats; non-shiny control is unaffected', () => {
    const shiny = makeUnit('tangela', 'player', 1)
    shiny.isShiny = true
    const control = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([shiny, control], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    const controlUnit = state.units.get(control.id)!

    // 5% of the raw 1-star Tangela base (hp 600, attack 40, special 100, defense 50, spDefense 50, attackSpeed 0.50)
    expect(shinyUnit.maxHp).toBe(630)
    expect(shinyUnit.currentHp).toBe(630)
    expect(shinyUnit.attack).toBe(42)
    expect(shinyUnit.special).toBe(105)
    expect(shinyUnit.defense).toBe(53)
    expect(shinyUnit.spDefense).toBe(53)
    expect(shinyUnit.attackSpeed).toBeCloseTo(0.525, 10)

    // Control is untouched — no leakage from the shiny pass.
    expect(controlUnit.maxHp).toBe(600)
    expect(controlUnit.currentHp).toBe(600)
    expect(controlUnit.attack).toBe(40)
    expect(controlUnit.special).toBe(100)
    expect(controlUnit.defense).toBe(50)
    expect(controlUnit.spDefense).toBe(50)
    expect(controlUnit.attackSpeed).toBeCloseTo(0.50, 10)
  })
})
