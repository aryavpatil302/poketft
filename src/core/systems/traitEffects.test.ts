import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { applyHeal } from './heal'
import { addShield } from './shield'
import { triggerAbility, tickAbilityCast } from './ability'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered (required by createCombatState → initAbilityPassives)
import '../systems/ability'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Place units on the board and create combat state.
// After createCombatState, initTraitEffects has run and added status effects —
// but _computedStats is stale. We call computeStats on every unit so that
// healShieldPower is immediately readable in tests.
function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

function hsp(unit: Unit): number {
  return unit._computedStats?.healShieldPower ?? 0
}

// Jungle unit IDs (8 unique species total)
const ALL_JUNGLE = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt', 'toucannon', 'tropius', 'tapu_bulu'] as const

// ─── initTraitEffects: healShieldPower values ─────────────────────────────────

describe('Jungle trait — healShieldPower stat', () => {

  describe('below threshold (2 jungle species)', () => {
    it('applies no bonus to any unit', () => {
      const j1 = makeUnit('tangela',  'player', 1)
      const j2 = makeUnit('ribombee', 'player', 1)
      const enemy = makeUnit('dummy', 'enemy', 1)
      const state = makeState([j1, j2], [enemy])
      expect(hsp(state.units.get(j1.id)!)).toBe(0)
      expect(hsp(state.units.get(j2.id)!)).toBe(0)
    })
  })

  describe('threshold 3 — 5% team / +10% extra for jungle (15% total)', () => {
    let jungle: Unit[]
    let nonJungle: Unit
    let state: CombatState

    beforeEach(() => {
      jungle    = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
      nonJungle = makeUnit('graveler', 'player', 1)
      const enemy = makeUnit('dummy', 'enemy', 1)
      state = makeState([...jungle, nonJungle], [enemy])
    })

    it('each jungle unit has healShieldPower = 0.15', () => {
      for (const u of jungle) {
        expect(hsp(state.units.get(u.id)!)).toBeCloseTo(0.15, 10)
      }
    })

    it('non-jungle ally has healShieldPower = 0.05', () => {
      expect(hsp(state.units.get(nonJungle.id)!)).toBeCloseTo(0.05, 10)
    })

    it('enemy team with no jungle gets no bonus', () => {
      const enemy = [...state.units.values()].find(u => u.team === 'enemy')!
      expect(hsp(enemy)).toBe(0)
    })
  })

  describe('threshold 5 — 8% team / +15% extra for jungle (23% total)', () => {
    let jungle: Unit[]
    let nonJungle: Unit
    let state: CombatState

    beforeEach(() => {
      jungle    = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt'].map(id => makeUnit(id, 'player', 1))
      nonJungle = makeUnit('graveler', 'player', 1)
      const enemy = makeUnit('dummy', 'enemy', 1)
      state = makeState([...jungle, nonJungle], [enemy])
    })

    it('each jungle unit has healShieldPower = 0.23', () => {
      for (const u of jungle) {
        expect(hsp(state.units.get(u.id)!)).toBeCloseTo(0.23, 10)
      }
    })

    it('non-jungle ally has healShieldPower = 0.08', () => {
      expect(hsp(state.units.get(nonJungle.id)!)).toBeCloseTo(0.08, 10)
    })
  })

  describe('threshold 7 — 10% team / +25% extra for jungle (35% total)', () => {
    let jungle: Unit[]
    let nonJungle: Unit
    let state: CombatState

    beforeEach(() => {
      jungle    = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt', 'toucannon', 'tropius'].map(id => makeUnit(id, 'player', 1))
      nonJungle = makeUnit('graveler', 'player', 1)
      const enemy = makeUnit('dummy', 'enemy', 1)
      state = makeState([...jungle, nonJungle], [enemy])
    })

    it('each jungle unit has healShieldPower = 0.35', () => {
      for (const u of jungle) {
        expect(hsp(state.units.get(u.id)!)).toBeCloseTo(0.35, 10)
      }
    })

    it('non-jungle ally has healShieldPower = 0.10', () => {
      expect(hsp(state.units.get(nonJungle.id)!)).toBeCloseTo(0.10, 10)
    })
  })

  describe('each team counted independently', () => {
    it('enemy jungle team gets their own bonus, player team unaffected by it', () => {
      // Player: 3 jungle units → threshold 1
      const pJungle = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
      // Enemy: 3 different jungle units
      const eJungle = ['vigoroth', 'vikavolt', 'toucannon'].map(id => makeUnit(id, 'enemy', 1))
      const state = makeState(pJungle, eJungle)

      for (const u of pJungle) expect(hsp(state.units.get(u.id)!)).toBeCloseTo(0.15, 10)
      for (const u of eJungle) expect(hsp(state.units.get(u.id)!)).toBeCloseTo(0.15, 10)
    })
  })

})

// ─── applyHeal scaling ────────────────────────────────────────────────────────

describe('Jungle trait — applyHeal scaling', () => {

  it('no bonus: heal returned unchanged', () => {
    // Single non-jungle unit — no jungle threshold active
    const unit = makeUnit('graveler', 'player', 1)
    unit.hexPos = { col: 0, row: 4 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 0 }
    const state = createCombatState([unit], [enemy])
    computeStats(unit)

    unit.currentHp = 1
    expect(applyHeal(unit, 100, unit.id, state)).toBe(100)
  })

  it('jungle unit at threshold 3: heal ×1.15', () => {
    const jungle  = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
    const enemy   = makeUnit('dummy', 'enemy', 1)
    const state   = makeState(jungle, [enemy])

    const unit = state.units.get(jungle[0].id)!
    unit.currentHp = 1
    expect(applyHeal(unit, 100, unit.id, state)).toBe(Math.round(100 * 1.15))
  })

  it('non-jungle ally at threshold 3: heal ×1.05', () => {
    const jungle    = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
    const nonJungle = makeUnit('graveler', 'player', 1)
    const enemy     = makeUnit('dummy',    'enemy',  1)
    const state     = makeState([...jungle, nonJungle], [enemy])

    const unit = state.units.get(nonJungle.id)!
    unit.currentHp = 1
    expect(applyHeal(unit, 100, unit.id, state)).toBe(Math.round(100 * 1.05))
  })

  it('jungle unit at threshold 5: heal ×1.23', () => {
    const jungle = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt'].map(id => makeUnit(id, 'player', 1))
    const enemy  = makeUnit('dummy', 'enemy', 1)
    const state  = makeState(jungle, [enemy])

    const unit = state.units.get(jungle[0].id)!
    unit.currentHp = 1
    expect(applyHeal(unit, 100, unit.id, state)).toBe(Math.round(100 * 1.23))
  })

  it('non-jungle ally at threshold 5: heal ×1.08', () => {
    const jungle    = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt'].map(id => makeUnit(id, 'player', 1))
    const nonJungle = makeUnit('graveler', 'player', 1)
    const enemy     = makeUnit('dummy',    'enemy',  1)
    const state     = makeState([...jungle, nonJungle], [enemy])

    const unit = state.units.get(nonJungle.id)!
    unit.currentHp = 1
    expect(applyHeal(unit, 100, unit.id, state)).toBe(Math.round(100 * 1.08))
  })

  it('jungle unit at threshold 7: heal ×1.35', () => {
    const jungle = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt', 'toucannon', 'tropius'].map(id => makeUnit(id, 'player', 1))
    const enemy  = makeUnit('dummy', 'enemy', 1)
    const state  = makeState(jungle, [enemy])

    const unit = state.units.get(jungle[0].id)!
    unit.currentHp = 1
    expect(applyHeal(unit, 100, unit.id, state)).toBe(Math.round(100 * 1.35))
  })

  it('non-jungle ally at threshold 7: heal ×1.10', () => {
    const jungle    = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt', 'toucannon', 'tropius'].map(id => makeUnit(id, 'player', 1))
    const nonJungle = makeUnit('graveler', 'player', 1)
    const enemy     = makeUnit('dummy',    'enemy',  1)
    const state     = makeState([...jungle, nonJungle], [enemy])

    const unit = state.units.get(nonJungle.id)!
    unit.currentHp = 1
    expect(applyHeal(unit, 100, unit.id, state)).toBe(Math.round(100 * 1.10))
  })

})

// ─── addShield scaling ────────────────────────────────────────────────────────

describe('Jungle trait — addShield scaling', () => {

  function baseShield(value = 200) {
    return { id: 'test_shield', sourceAbility: 'test', value, maxValue: value, durationTicks: -1 as const }
  }

  it('no bonus: shield value unchanged', () => {
    const unit = makeUnit('graveler', 'player', 1)
    unit.hexPos = { col: 0, row: 4 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 0 }
    const state = createCombatState([unit], [enemy])
    computeStats(unit)

    addShield(unit, baseShield(), state)
    expect(unit.shields[0].value).toBe(200)
    expect(unit.shields[0].maxValue).toBe(200)
  })

  it('jungle unit at threshold 3: shield ×1.15', () => {
    const jungle = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
    const enemy  = makeUnit('dummy', 'enemy', 1)
    const state  = makeState(jungle, [enemy])

    const unit = state.units.get(jungle[0].id)!
    addShield(unit, baseShield(), state)
    expect(unit.shields[0].value).toBe(Math.round(200 * 1.15))
    expect(unit.shields[0].maxValue).toBe(Math.round(200 * 1.15))
  })

  it('non-jungle ally at threshold 3: shield ×1.05', () => {
    const jungle    = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
    const nonJungle = makeUnit('graveler', 'player', 1)
    const enemy     = makeUnit('dummy',    'enemy',  1)
    const state     = makeState([...jungle, nonJungle], [enemy])

    const unit = state.units.get(nonJungle.id)!
    addShield(unit, baseShield(), state)
    expect(unit.shields[0].value).toBe(Math.round(200 * 1.05))
    expect(unit.shields[0].maxValue).toBe(Math.round(200 * 1.05))
  })

  it('jungle unit at threshold 5: shield ×1.23', () => {
    const jungle = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt'].map(id => makeUnit(id, 'player', 1))
    const enemy  = makeUnit('dummy', 'enemy', 1)
    const state  = makeState(jungle, [enemy])

    const unit = state.units.get(jungle[0].id)!
    addShield(unit, baseShield(), state)
    const sh = unit.shields.find(x => x.id === 'test_shield')!
    expect(sh.value).toBe(Math.round(200 * 1.23))
    expect(sh.maxValue).toBe(Math.round(200 * 1.23))
  })

  it('non-jungle ally at threshold 5: shield ×1.08', () => {
    const jungle    = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt'].map(id => makeUnit(id, 'player', 1))
    const nonJungle = makeUnit('graveler', 'player', 1)
    const enemy     = makeUnit('dummy',    'enemy',  1)
    const state     = makeState([...jungle, nonJungle], [enemy])

    const unit = state.units.get(nonJungle.id)!
    addShield(unit, baseShield(), state)
    const sh = unit.shields.find(x => x.id === 'test_shield')!
    expect(sh.value).toBe(Math.round(200 * 1.08))
    expect(sh.maxValue).toBe(Math.round(200 * 1.08))
  })

  it('jungle unit at threshold 7: shield ×1.35', () => {
    const jungle = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt', 'toucannon', 'tropius'].map(id => makeUnit(id, 'player', 1))
    const enemy  = makeUnit('dummy', 'enemy', 1)
    const state  = makeState(jungle, [enemy])

    const unit = state.units.get(jungle[0].id)!
    addShield(unit, baseShield(), state)
    const sh = unit.shields.find(x => x.id === 'test_shield')!
    expect(sh.value).toBe(Math.round(200 * 1.35))
    expect(sh.maxValue).toBe(Math.round(200 * 1.35))
  })

  it('non-jungle ally at threshold 7: shield ×1.10', () => {
    const jungle    = ['tangela', 'ribombee', 'venusaur', 'vigoroth', 'vikavolt', 'toucannon', 'tropius'].map(id => makeUnit(id, 'player', 1))
    const nonJungle = makeUnit('graveler', 'player', 1)
    const enemy     = makeUnit('dummy',    'enemy',  1)
    const state     = makeState([...jungle, nonJungle], [enemy])

    const unit = state.units.get(nonJungle.id)!
    addShield(unit, baseShield(), state)
    const sh = unit.shields.find(x => x.id === 'test_shield')!
    expect(sh.value).toBe(Math.round(200 * 1.10))
    expect(sh.maxValue).toBe(Math.round(200 * 1.10))
  })

  it('effectiveMaxHp is scaled correctly when provided', () => {
    const jungle = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
    const enemy  = makeUnit('dummy', 'enemy', 1)
    const state  = makeState(jungle, [enemy])

    const unit = state.units.get(jungle[0].id)!
    const shield = { ...baseShield(200), effectiveMaxHp: unit.currentHp + 200 }
    addShield(unit, shield, state)
    const scaledMax = Math.round(200 * 1.15)
    expect(unit.shields[0].effectiveMaxHp).toBe(unit.currentHp + scaledMax)
  })

  it('shield event emitted with the scaled amount', () => {
    const jungle = ['tangela', 'ribombee', 'venusaur'].map(id => makeUnit(id, 'player', 1))
    const enemy  = makeUnit('dummy', 'enemy', 1)
    const state  = makeState(jungle, [enemy])
    state.events = []

    const unit = state.units.get(jungle[0].id)!
    addShield(unit, baseShield(200), state)
    const evt = state.events.find(e => e.type === 'shield')
    expect(evt).toBeDefined()
    if (evt?.type === 'shield') expect(evt.amount).toBe(Math.round(200 * 1.15))
  })

})

// ─── Spellweaver — per-cast stacking adaptive ─────────────────────────────────

describe('Spellweaver trait — stacking adaptive on ally casts', () => {

  function castUnit(unit: Unit, state: CombatState, ticks = 40): void {
    unit.currentMana = unit.maxMana
    triggerAbility(unit, state)
    for (let i = 0; i < ticks && unit.state === 'casting'; i++) tickAbilityCast(unit, state)
  }

  function castStacks(unit: Unit): number {
    return unit.statusEffects.find(e => e.stackId === 'spellweaver_cast_stacks')?.magnitude ?? 0
  }

  it('spellweaver cast grants +1 stack to all spellweavers at threshold 2', () => {
    const sw1 = makeUnit('typhlosion', 'player', 1)
    const sw2 = makeUnit('zubat',      'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([sw1, sw2], [enemy])

    const u1 = state.units.get(sw1.id)!
    const u2 = state.units.get(sw2.id)!
    castUnit(u1, state)
    expect(castStacks(u1)).toBe(1)
    expect(castStacks(u2)).toBe(1)
  })

  it('NON-spellweaver ally cast also grants stacks to spellweavers', () => {
    const sw1 = makeUnit('typhlosion', 'player', 1)
    const sw2 = makeUnit('zubat',      'player', 1)
    const ally = makeUnit('tangela',   'player', 1)  // not a spellweaver
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([sw1, sw2, ally], [enemy])

    const allyU = state.units.get(ally.id)!
    castUnit(allyU, state)

    expect(castStacks(state.units.get(sw1.id)!)).toBe(1)
    expect(castStacks(state.units.get(sw2.id)!)).toBe(1)
    // The non-spellweaver caster itself gains no stacks
    expect(castStacks(allyU)).toBe(0)
  })

  it('stacks accumulate across multiple ally casts', () => {
    const sw1 = makeUnit('typhlosion', 'player', 1)
    const sw2 = makeUnit('zubat',      'player', 1)
    const ally = makeUnit('tangela',   'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([sw1, sw2, ally], [enemy])

    const allyU = state.units.get(ally.id)!
    const swU   = state.units.get(sw1.id)!
    castUnit(allyU, state)
    castUnit(swU, state)
    castUnit(allyU, state)

    expect(castStacks(swU)).toBe(3)
    expect(castStacks(state.units.get(sw2.id)!)).toBe(3)
  })

  it('no stacking below threshold (fewer than 2 spellweaver species)', () => {
    const sw1 = makeUnit('typhlosion', 'player', 1)
    const ally = makeUnit('tangela',   'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([sw1, ally], [enemy])

    castUnit(state.units.get(ally.id)!, state)
    expect(castStacks(state.units.get(sw1.id)!)).toBe(0)
  })
})
