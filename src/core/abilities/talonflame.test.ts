import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Talonflame - Brave Bird', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('talonflame', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast animation', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('deals physical damage to the nearest enemy', () => {
    // Give enemy enough HP to survive
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(10000)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'physical' && e.targetId === enemy.id
    )
    expect(dmgEvent).toBeDefined()
  })

  it('tier 1 - base damage is 300 (physical, before mitigation)', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.defense = 0
    enemy._computedStats = null  // force recompute with 0 defense
    caster.critChance = 0  // prevent crit for deterministic test
    caster._computedStats = null
    cast(caster, state)

    const dmgEvent = state.events.find(
      e => e.type === 'damage' && e.targetId === enemy.id
    )
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(300)
    }
  })

  it('tier 2 - base damage is 450 (before mitigation)', () => {
    const t2 = makeUnit('talonflame', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.critChance = 0
    t2._computedStats = null
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000
    e.currentHp = 10000
    e.defense = 0
    e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(450)
    }
  })

  it('tier 3 - base damage is 700 (before mitigation)', () => {
    const t3 = makeUnit('talonflame', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    t3.critChance = 0
    t3._computedStats = null
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000
    e.currentHp = 10000
    e.defense = 0
    e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(700)
    }
  })

  it('does nothing when no enemies are present', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('fires a second damage event (recast) if the first target dies', () => {
    // First enemy with very low HP to guarantee death
    const weakEnemy = makeUnit('dummy', 'enemy', 1)
    weakEnemy.maxHp = 1
    weakEnemy.currentHp = 1
    weakEnemy.defense = 0
    weakEnemy.hexPos = { col: 3, row: 2 }

    // Second enemy as bounce target
    const strongEnemy = makeUnit('dummy', 'enemy', 1)
    strongEnemy.maxHp = 10000
    strongEnemy.currentHp = 10000
    strongEnemy.hexPos = { col: 4, row: 2 }

    state = createCombatState([caster], [weakEnemy, strongEnemy])
    cast(caster, state)

    const dmgEvents = state.events.filter(e => e.type === 'damage')
    // At least 2 damage events: one that kills weakEnemy, one recast bounce
    expect(dmgEvents.length).toBeGreaterThanOrEqual(2)
  })

  it('recast damage is 75% of original (300 * 0.75 = 225) when bouncing', () => {
    const weakEnemy = makeUnit('dummy', 'enemy', 1)
    weakEnemy.maxHp = 1
    weakEnemy.currentHp = 1
    weakEnemy.defense = 0
    weakEnemy._computedStats = null
    weakEnemy.hexPos = { col: 3, row: 2 }

    const strongEnemy = makeUnit('dummy', 'enemy', 1)
    strongEnemy.maxHp = 10000
    strongEnemy.currentHp = 10000
    strongEnemy.defense = 0
    strongEnemy._computedStats = null
    strongEnemy.hexPos = { col: 4, row: 2 }

    caster.critChance = 0
    caster._computedStats = null
    state = createCombatState([caster], [weakEnemy, strongEnemy])
    cast(caster, state)

    // Find damage event on strongEnemy
    const bounceDmg = state.events.find(
      e => e.type === 'damage' && e.targetId === strongEnemy.id
    )
    expect(bounceDmg).toBeDefined()
    if (bounceDmg?.type === 'damage') {
      expect(bounceDmg.amount).toBe(Math.round(300 * 0.75))
    }
  })

  it('does not infinitely recast (stops when multiplier falls below 0.3)', () => {
    // Chain of very weak enemies
    const weakEnemies = Array.from({ length: 10 }, (_, i) => {
      const e = makeUnit('dummy', 'enemy', 1)
      e.maxHp = 1
      e.currentHp = 1
      e.defense = 0
      e.hexPos = { col: i, row: 2 }
      return e
    })
    state = createCombatState([caster], weakEnemies)
    // Should not throw or loop forever
    expect(() => cast(caster, state)).not.toThrow()

    // Verify damage events are finite (300 * 0.75^n stops when < 0.3 * 300 = 90)
    // 300 * 0.75^0 = 300, 0.75^1=225, 0.75^2=168.75, 0.75^3=126.5, 0.75^4=94.9, 0.75^5=71.2 -> stops
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBeLessThan(10)
  })
})
