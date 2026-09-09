import { describe, it, expect, afterEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { SHINY_EFFECT_REGISTRY, initShinyEffects, grantShinyGold } from './shinyEffects'
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
// it here, and we assert it returns to its baseline so a leaked entry fails
// loudly here rather than corrupting an unrelated suite.
//
// Baseline is captured dynamically, NOT hardcoded to 0: `../combatEngine`
// (imported above) pulls in `./shinyEffects/index`, the barrel that
// registers every real per-species shiny effect as a module-load side
// effect (klawf, gogoat, sneasler, aerodactyl, and siblings from other
// trait-group batches as they land). That registration has already run by
// the time this file's top-level code executes, so BASELINE_SIZE below
// reflects however many real species are wired in at test-run time — this
// keeps the assertion correct as more species are added, batch by batch.
const BASELINE_SIZE = SHINY_EFFECT_REGISTRY.size

afterEach(() => {
  SHINY_EFFECT_REGISTRY.delete('tangela')
  expect(SHINY_EFFECT_REGISTRY.size).toBe(BASELINE_SIZE)
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

  it('(b) non-shiny isolation — a non-shiny unit alongside a shiny unit in the same combat reads raw base stats, no leakage', () => {
    const shiny = makeUnit('tangela', 'player', 1)
    shiny.isShiny = true
    const nonShiny = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([shiny, nonShiny], [enemy])

    const nonShinyUnit = state.units.get(nonShiny.id)!
    expect(nonShinyUnit.maxHp).toBe(600)
    expect(nonShinyUnit.currentHp).toBe(600)
    expect(nonShinyUnit.attack).toBe(40)
    expect(nonShinyUnit.special).toBe(100)
    expect(nonShinyUnit.defense).toBe(50)
    expect(nonShinyUnit.spDefense).toBe(50)
    expect(nonShinyUnit.attackSpeed).toBeCloseTo(0.50, 10)
  })

  it('(c) tier composition — the 5% bonus composes on top of the tier-2-scaled stored base, not the raw definition base', () => {
    const shiny2 = makeUnit('tangela', 'player', 2)
    shiny2.isShiny = true
    const control2 = makeUnit('tangela', 'player', 2)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([shiny2, control2], [enemy])

    const shinyUnit = state.units.get(shiny2.id)!
    const controlUnit = state.units.get(control2.id)!

    // 600 -> 1080 via the star-2 1.8x, then x1.05 -> 1134. NOT 600 * 1.05 = 630.
    expect(shinyUnit.maxHp).toBe(1134)
    // 40 -> 60 via the star-2 1.5x, then x1.05 -> 63.
    expect(shinyUnit.attack).toBe(63)
    // Star tier does not scale special/defense/spDefense — same 5% as 1-star.
    expect(shinyUnit.special).toBe(105)
    expect(shinyUnit.defense).toBe(53)
    expect(shinyUnit.spDefense).toBe(53)

    // Non-shiny 2-star control proves the tier scaling itself is unchanged.
    expect(controlUnit.maxHp).toBe(1080)
    expect(controlUnit.attack).toBe(60)
  })

  it('(d) full health invariant — currentHp strictly equals maxHp for both a shiny 1-star and a shiny 2-star', () => {
    const shiny1 = makeUnit('tangela', 'player', 1)
    shiny1.isShiny = true
    const shiny2 = makeUnit('tangela', 'player', 2)
    shiny2.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([shiny1, shiny2], [enemy])

    const shiny1Unit = state.units.get(shiny1.id)!
    const shiny2Unit = state.units.get(shiny2.id)!
    expect(shiny1Unit.currentHp).toBe(shiny1Unit.maxHp)
    expect(shiny2Unit.currentHp).toBe(shiny2Unit.maxHp)
  })

  it('(e) untouched stats — critChance, critDamage, range, maxMana, moveSpeed and currentMana are unaffected on a shiny unit', () => {
    const shiny = makeUnit('tangela', 'player', 1)
    shiny.isShiny = true
    const control = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([shiny, control], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    const controlUnit = state.units.get(control.id)!

    expect(shinyUnit.critChance).toBe(0.25)
    expect(shinyUnit.critDamage).toBe(1.40)
    expect(shinyUnit.range).toBe(1)
    expect(shinyUnit.maxMana).toBe(110)
    expect(shinyUnit.moveSpeed).toBe(controlUnit.moveSpeed)
    expect(shinyUnit.currentMana).toBe(controlUnit.currentMana)
  })
})

// ─── grantShinyGold: cross-cutting plumbing (Sableye) ───────────────────────
// No per-species shiny effect calls this yet (Sableye's own 30%-chance-roll
// lands in a later batch) — this proves the mechanism itself: the counter on
// CombatState, its per-team keying, and the zero-amount no-op.

describe('grantShinyGold — plumbing', () => {
  it('(a) a single grant lands exactly on the given team, the other team stays untouched', () => {
    const player = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([player], [enemy])

    grantShinyGold(state, 'player', 25)

    expect(state.shinyGoldEarned.get('player')).toBe(25)
    expect(state.shinyGoldEarned.get('enemy')).toBeUndefined()
  })

  it('(b) repeated grants on the same team accumulate rather than overwrite', () => {
    const player = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([player], [enemy])

    grantShinyGold(state, 'player', 10)
    grantShinyGold(state, 'player', 15)

    expect(state.shinyGoldEarned.get('player')).toBe(25)
  })

  it('(c) grants on both teams accumulate independently, with no cross-team bleed', () => {
    const player = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([player], [enemy])

    grantShinyGold(state, 'player', 40)
    grantShinyGold(state, 'enemy', 5)

    expect(state.shinyGoldEarned.get('player')).toBe(40)
    expect(state.shinyGoldEarned.get('enemy')).toBe(5)
  })

  it('(d) a zero-amount grant is a no-op — the counter is left unset, nothing throws', () => {
    const player = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([player], [enemy])

    expect(() => grantShinyGold(state, 'player', 0)).not.toThrow()
    expect(state.shinyGoldEarned.get('player')).toBeUndefined()
  })

  it('(e) a negative amount is also a no-op (defensive — never a valid caller input)', () => {
    const player = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([player], [enemy])

    grantShinyGold(state, 'player', -5)

    expect(state.shinyGoldEarned.get('player')).toBeUndefined()
  })

  it('(f) createCombatState starts shinyGoldEarned empty — no grant, no entries', () => {
    const player = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([player], [enemy])

    expect(state.shinyGoldEarned.size).toBe(0)
  })
})
