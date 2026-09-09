import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// Ensure all abilities + shiny effects are registered (createCombatState
// wires the shinyEffects barrel via combatEngine.ts's own import)
import '../ability'

// Kingler, A-Raichu, Palossand, Blastoise — the 4 pure onCombatStart Beachy
// shiny effects (A-Exeggutor and Tapu Fini are ability-file hooks, tested
// separately in their own ability test files). Every case below pairs its
// shiny scenario with a non-shiny control proving the effect does NOT fire
// without isShiny.

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

// ─── Kingler — team-wide +5 attack ─────────────────────────────────────────────

describe('shiny Kingler — team-wide +5 attack', () => {
  it('(a) shiny Kingler and a non-shiny ally both gain +5 attack; enemy team unaffected', () => {
    const kingler = makeUnit('kingler', 'player', 1)
    kingler.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)           // base attack 40, unrelated species
    const dummyAlly = makeUnit('dummy', 'player', 1)         // isDummy — must be excluded
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([kingler, ally, dummyAlly], [enemy])
    const kinglerUnit = state.units.get(kingler.id)!
    const allyUnit = state.units.get(ally.id)!
    const dummyUnit = state.units.get(dummyAlly.id)!
    const enemyUnit = state.units.get(enemy.id)!

    // Kingler: base 45 attack, +5% universal shiny → 47 (round), +5 flat dmg_buff → 52
    expect(computeStats(kinglerUnit).attack).toBe(52)
    // Ally: base 40 attack, not shiny (no universal bonus), +5 flat dmg_buff → 45
    expect(computeStats(allyUnit).attack).toBe(45)
    // Dummy ally: excluded from the team-wide loop — no dmg_buff status at all
    expect(dummyUnit.statusEffects.some(fx => fx.id === 'dmg_buff')).toBe(false)
    // Enemy team: entirely untouched
    expect(enemyUnit.statusEffects.some(fx => fx.id === 'dmg_buff')).toBe(false)
    expect(computeStats(enemyUnit).attack).toBe(40)
  })

  it('(b) non-shiny control — Kingler present but not shiny: no dmg_buff anywhere', () => {
    const kingler = makeUnit('kingler', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([kingler, ally], [enemy])
    const kinglerUnit = state.units.get(kingler.id)!
    const allyUnit = state.units.get(ally.id)!

    expect(computeStats(kinglerUnit).attack).toBe(45)
    expect(computeStats(allyUnit).attack).toBe(40)
    expect(kinglerUnit.statusEffects.some(fx => fx.id === 'dmg_buff')).toBe(false)
    expect(allyUnit.statusEffects.some(fx => fx.id === 'dmg_buff')).toBe(false)
  })
})

// ─── A-Raichu — team-wide +10 special ──────────────────────────────────────────

describe('shiny A-Raichu — team-wide +10 special', () => {
  it('(a) shiny A-Raichu and a non-shiny ally both gain +10 special; enemy team unaffected', () => {
    const raichu = makeUnit('a_raichu', 'player', 1)
    raichu.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)   // base special 100
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([raichu, ally], [enemy])
    const raichuUnit = state.units.get(raichu.id)!
    const allyUnit = state.units.get(ally.id)!
    const enemyUnit = state.units.get(enemy.id)!

    // A-Raichu: base 100 special, +5% universal shiny → 105, +10 flat → 115
    expect(computeStats(raichuUnit).special).toBe(115)
    // Ally: base 100 special, not shiny, +10 flat → 110
    expect(computeStats(allyUnit).special).toBe(110)
    expect(computeStats(enemyUnit).special).toBe(100)
  })

  it('(b) non-shiny control — A-Raichu present but not shiny: no special buff anywhere', () => {
    const raichu = makeUnit('a_raichu', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([raichu, ally], [enemy])
    const raichuUnit = state.units.get(raichu.id)!
    const allyUnit = state.units.get(ally.id)!

    expect(computeStats(raichuUnit).special).toBe(100)
    expect(computeStats(allyUnit).special).toBe(100)
  })
})

// ─── Palossand — self-only shield + armor + magic resist ──────────────────────

describe('shiny Palossand — self: +200 shield, +10 armor, +10 magic resist', () => {
  it('(a) shiny Palossand gets the shield and both buffs; a non-shiny ally gets neither', () => {
    const palossand = makeUnit('palossand', 'player', 1)
    palossand.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)   // base defense 50, spDefense 50
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([palossand, ally], [enemy])
    const palossandUnit = state.units.get(palossand.id)!
    const allyUnit = state.units.get(ally.id)!

    expect(palossandUnit.shields.length).toBe(1)
    expect(palossandUnit.shields[0].value).toBe(200)
    // Palossand: base 55 defense/65 spDefense, +5% universal → 58/68 (round), +10 flat each → 68/78
    expect(computeStats(palossandUnit).defense).toBe(68)
    expect(computeStats(palossandUnit).spDefense).toBe(78)

    // Self-only — the ally gets neither the shield nor the stat buffs (unlike
    // Kingler/A-Raichu's team-wide reach).
    expect(allyUnit.shields.length).toBe(0)
    expect(computeStats(allyUnit).defense).toBe(50)
    expect(computeStats(allyUnit).spDefense).toBe(50)
  })

  it('(b) non-shiny control — Palossand present but not shiny: no shield, no buff', () => {
    const palossand = makeUnit('palossand', 'player', 1)
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([palossand], [enemy])
    const palossandUnit = state.units.get(palossand.id)!

    expect(palossandUnit.shields.length).toBe(0)
    expect(computeStats(palossandUnit).defense).toBe(55)
    expect(computeStats(palossandUnit).spDefense).toBe(65)
  })
})

// ─── Blastoise — self-only +30% attack speed ───────────────────────────────────

describe('shiny Blastoise — self: +30% attack speed', () => {
  it('(a) shiny Blastoise gains +30% attack speed on top of the universal +5%; a non-shiny ally is unaffected', () => {
    const blastoise = makeUnit('blastoise', 'player', 1)
    blastoise.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)   // base attackSpeed 0.50
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([blastoise, ally], [enemy])
    const blastoiseUnit = state.units.get(blastoise.id)!
    const allyUnit = state.units.get(ally.id)!

    // Blastoise base attackSpeed 0.70 → universal shiny 0.70*1.05 = 0.735 (unrounded,
    // baked into unit.attackSpeed) → computeStats' atkSpd_buff then adds 30% of THAT
    // current value: 0.735 * 1.30 = 0.9555
    expect(blastoiseUnit.attackSpeed).toBeCloseTo(0.735, 10)
    expect(computeStats(blastoiseUnit).attackSpeed).toBeCloseTo(0.9555, 10)

    // Self-only — ally's attack speed is untouched.
    expect(computeStats(allyUnit).attackSpeed).toBeCloseTo(0.50, 10)
  })

  it('(b) non-shiny control — Blastoise present but not shiny: base attack speed only', () => {
    const blastoise = makeUnit('blastoise', 'player', 1)
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([blastoise], [enemy])
    const blastoiseUnit = state.units.get(blastoise.id)!

    expect(blastoiseUnit.attackSpeed).toBeCloseTo(0.70, 10)
    expect(computeStats(blastoiseUnit).attackSpeed).toBeCloseTo(0.70, 10)
  })
})
