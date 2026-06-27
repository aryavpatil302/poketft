import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from './unitFactory'

// ─── makeUnit basics ──────────────────────────────────────────────────────────

describe('makeUnit', () => {
  it('throws for unknown definition ID', () => {
    expect(() => makeUnit('not_a_pokemon', 'player')).toThrow()
  })

  it('creates a tangela unit with correct shape', () => {
    const u = makeUnit('tangela', 'player', 1)
    expect(u.definitionId).toBe('tangela')
    expect(u.name).toBe('Tangela')
    expect(u.team).toBe('player')
    expect(u.tier).toBe(1)
    expect(u.state).toBe('idle')
    expect(u.targetId).toBeNull()
    expect(u._computedStats).not.toBeNull()
  })

  it('generates unique IDs for each call', () => {
    const a = makeUnit('tangela', 'player', 1)
    const b = makeUnit('tangela', 'player', 1)
    expect(a.id).not.toBe(b.id)
  })

  it('starts with currentHp === maxHp', () => {
    const u = makeUnit('tangela', 'player', 1)
    expect(u.currentHp).toBe(u.maxHp)
  })

  it('clamps startMana to maxMana', () => {
    // tangela has startMana 65, maxMana 110 — should start at 65
    const u = makeUnit('tangela', 'player', 1)
    expect(u.currentMana).toBe(65)
    expect(u.maxMana).toBe(110)
  })

  it('vigoroth starts at startMana (85)', () => {
    const u = makeUnit('vigoroth', 'player', 1)
    expect(u.currentMana).toBe(85)
  })

  it('copies traits from definition', () => {
    const u = makeUnit('tangela', 'player', 1)
    expect(u.traits).toContain('jungle')
  })

  it('starts with empty items and status effects', () => {
    const u = makeUnit('tangela', 'player', 1)
    expect(u.items).toHaveLength(0)
    expect(u.statusEffects).toHaveLength(0)
    expect(u.shields).toHaveLength(0)
  })
})

// ─── Star scaling ─────────────────────────────────────────────────────────────

describe('star scaling', () => {
  it('1-star tangela has base HP = 600', () => {
    const u = makeUnit('tangela', 'player', 1)
    expect(u.maxHp).toBe(600)
  })

  it('2-star tangela HP = 600 × 1.8 = 1080', () => {
    const u = makeUnit('tangela', 'player', 2)
    expect(u.maxHp).toBe(Math.round(600 * 1.8))  // 1080
  })

  it('3-star tangela HP = 1080 × 1.8 = 1944', () => {
    const u = makeUnit('tangela', 'player', 3)
    expect(u.maxHp).toBe(Math.round(Math.round(600 * 1.8) * 1.8))  // 1944
  })

  it('1-star vigoroth has base attack = 45', () => {
    const u = makeUnit('vigoroth', 'player', 1)
    expect(u.attack).toBe(45)
  })

  it('2-star vigoroth attack = 45 × 1.5 = 68', () => {
    const u = makeUnit('vigoroth', 'player', 2)
    expect(u.attack).toBe(Math.round(45 * 1.5))  // 68 (rounded)
  })

  it('3-star vigoroth attack = 68 × 1.5 = 101 (rounded)', () => {
    const u = makeUnit('vigoroth', 'player', 3)
    expect(u.attack).toBe(Math.round(Math.round(45 * 1.5) * 1.5))
  })
})

// ─── computeStats ─────────────────────────────────────────────────────────────

describe('computeStats', () => {
  it('applies item stat bonus correctly', () => {
    const u = makeUnit('tangela', 'player', 1)
    const baseAtk = u.attack  // 35
    u.items = ['bf_sword']
    computeStats(u)
    expect(u._computedStats!.attack).toBe(baseAtk + 20)
  })

  it('applies multiple items cumulatively', () => {
    const u = makeUnit('tangela', 'player', 1)
    const baseAtk = u.attack
    u.items = ['bf_sword', 'bf_sword']  // two swords (testing, not real gameplay)
    computeStats(u)
    expect(u._computedStats!.attack).toBe(baseAtk + 40)
  })

  it('applies attackSpeed buff status effect as fractional bonus', () => {
    const u = makeUnit('vigoroth', 'player', 1)
    const baseAs = u.attackSpeed  // 0.80
    u.statusEffects = [{
      id: 'atkSpd_buff', sourceUnitId: u.id, durationTicks: -1, magnitude: 0.30,
    }]
    computeStats(u)
    expect(u._computedStats!.attackSpeed).toBeCloseTo(baseAs + baseAs * 0.30)
  })

  it('applies flat dmg_buff status effect', () => {
    const u = makeUnit('vigoroth', 'player', 1)
    const baseAtk = u.attack  // 45
    u.statusEffects = [{
      id: 'dmg_buff', sourceUnitId: u.id, durationTicks: -1, magnitude: 50,
    }]
    computeStats(u)
    expect(u._computedStats!.attack).toBe(baseAtk + 50)
  })

  it('applies trait bonus passed as argument', () => {
    const u = makeUnit('tangela', 'player', 1)
    const baseDef = u.defense  // 40
    computeStats(u, { defense: 10 })
    expect(u._computedStats!.defense).toBe(baseDef + 10)
  })

  it('defense cannot go below -300', () => {
    const u = makeUnit('tangela', 'player', 1)
    u.statusEffects = [{
      id: 'armorShred', sourceUnitId: 'test', durationTicks: -1, magnitude: 9999,
    }]
    computeStats(u)
    expect(u._computedStats!.defense).toBe(-300)
  })

  it('attack cannot go below 0', () => {
    const u = makeUnit('tangela', 'player', 1)
    u.statusEffects = [{
      id: 'dmg_buff', sourceUnitId: 'test', durationTicks: -1, magnitude: -9999,
    }]
    computeStats(u)
    expect(u._computedStats!.attack).toBeGreaterThanOrEqual(0)
  })

  it('critChance is clamped to [0, 1]', () => {
    const u = makeUnit('tangela', 'player', 1)
    // Add many items to push crit over 100%
    u.items = ['infinity_edge', 'infinity_edge', 'infinity_edge']
    computeStats(u)
    expect(u._computedStats!.critChance).toBeLessThanOrEqual(1)
  })
})
