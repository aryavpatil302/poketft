import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Torkoal - White Smoke', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('torkoal', 'player', 1)
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

  it('tier 1 - heals caster for 200 HP', () => {
    caster.currentHp = Math.floor(caster.maxHp * 0.5)  // bring to half HP
    const hpBefore = caster.currentHp
    cast(caster, state)
    expect(caster.currentHp).toBe(Math.min(caster.maxHp, hpBefore + 200))
  })

  it('tier 2 - heals caster for 300 HP', () => {
    const t2 = makeUnit('torkoal', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentHp = Math.floor(t2.maxHp * 0.5)
    const hpBefore = t2.currentHp
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)
    expect(t2.currentHp).toBe(Math.min(t2.maxHp, hpBefore + 300))
  })

  it('tier 3 - heals caster for 450 HP', () => {
    const t3 = makeUnit('torkoal', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentHp = Math.floor(t3.maxHp * 0.5)
    const hpBefore = t3.currentHp
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)
    expect(t3.currentHp).toBe(Math.min(t3.maxHp, hpBefore + 450))
  })

  it('heal emits a heal event', () => {
    caster.currentHp = 1
    cast(caster, state)
    expect(state.events.some(e => e.type === 'heal')).toBe(true)
  })

  it('does not overheal beyond maxHp', () => {
    // caster starts at full HP
    cast(caster, state)
    expect(caster.currentHp).toBe(caster.maxHp)
  })

  it('tier 1 - applies blind to the highest attack enemy (magnitude 0.80)', () => {
    cast(caster, state)
    const blind = enemy.statusEffects.find(e => e.id === 'blind')
    expect(blind).toBeDefined()
    expect(blind?.magnitude).toBeCloseTo(0.80)
  })

  it('tier 1 - blind duration is 3 seconds', () => {
    cast(caster, state)
    const blind = enemy.statusEffects.find(e => e.id === 'blind')
    expect(blind?.durationTicks).toBe(3 * TICK_RATE)
  })

  it('tier 2 - blind duration is 4 seconds', () => {
    const t2 = makeUnit('torkoal', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)
    const blind = e.statusEffects.find(fx => fx.id === 'blind')
    expect(blind?.durationTicks).toBe(4 * TICK_RATE)
  })

  it('tier 3 - blind duration is 5 seconds', () => {
    const t3 = makeUnit('torkoal', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)
    const blind = e.statusEffects.find(fx => fx.id === 'blind')
    expect(blind?.durationTicks).toBe(5 * TICK_RATE)
  })

  it('blind has stackId torkoal_blind', () => {
    cast(caster, state)
    const blind = enemy.statusEffects.find(e => e.id === 'blind')
    expect(blind?.stackId).toBe('torkoal_blind')
  })

  it('does not crash with no enemies present', () => {
    state = createCombatState([caster], [])
    expect(() => cast(caster, state)).not.toThrow()
  })

  it('heals even when no enemy to blind', () => {
    caster.currentHp = 1
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(caster.currentHp).toBeGreaterThan(1)
  })
})
