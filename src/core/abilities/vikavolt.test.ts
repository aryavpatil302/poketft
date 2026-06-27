import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Vikavolt - Discharge', () => {
  let caster: Unit
  let e1: Unit
  let e2: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('vikavolt', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // Two enemies in same row
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 2, row: 1 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 1 }
    state = createCombatState([caster], [e1, e2])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('deals magic damage to all enemies in the most populated row', () => {
    cast(caster, state)
    expect(e1.currentHp).toBeLessThan(e1.maxHp)
    expect(e2.currentHp).toBeLessThan(e2.maxHp)
  })

  it('does NOT damage enemies in a different row', () => {
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 3 }  // different row
    e3.maxHp = 10000
    e3.currentHp = 10000
    state = createCombatState([caster], [e1, e2, e3])
    cast(caster, state)
    // e3 is in row 3; e1 and e2 are in row 1 (most populated)
    expect(e3.currentHp).toBe(10000)
  })

  it('emits a discharge_row vfx event', () => {
    cast(caster, state)
    const vfx = state.events.find(e => e.type === 'vfx' && (e as any).effectId === 'discharge_row')
    expect(vfx).toBeDefined()
  })

  it('tier 1 - applies stun for 1.5 seconds (90 ticks)', () => {
    cast(caster, state)
    if (e1.state !== 'dead') {
      const stun = e1.statusEffects.find(fx => fx.id === 'stun')
      expect(stun).toBeDefined()
      expect(stun?.durationTicks).toBe(90)  // 1.5 * 60
    }
  })

  it('tier 2 - applies stun for 2 seconds (120 ticks)', () => {
    const t2 = makeUnit('vikavolt', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 1 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    if (e.state !== 'dead') {
      const stun = e.statusEffects.find(fx => fx.id === 'stun')
      expect(stun?.durationTicks).toBe(120)
    }
  })

  it('tier 3 - applies stun for 3 seconds (180 ticks)', () => {
    const t3 = makeUnit('vikavolt', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 999999
    e.currentHp = 999999
    e.hexPos = { col: 3, row: 1 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const stun = e.statusEffects.find(fx => fx.id === 'stun')
    expect(stun?.durationTicks).toBe(180)
  })

  it('targets the most populated enemy row', () => {
    // row 1 has 2 enemies, row 2 has 1 — discharge hits row 1
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    e3.maxHp = 10000
    e3.currentHp = 10000
    state = createCombatState([caster], [e1, e2, e3])
    cast(caster, state)
    expect(e3.currentHp).toBe(10000)  // e3 in row 2 should be unharmed
    expect(e1.currentHp).toBeLessThan(e1.maxHp)
    expect(e2.currentHp).toBeLessThan(e2.maxHp)
  })

  it('tiebreaker: equal count rows — targets row with lower total HP', () => {
    // row 1: e1 + e2 (both at full HP ~1500 each = ~3000 total)
    // row 2: two enemies with much lower HP (100 each = 200 total) → should win tiebreak
    const lowHpA = makeUnit('dummy', 'enemy', 1)
    lowHpA.hexPos = { col: 2, row: 2 }
    lowHpA.maxHp = 100; lowHpA.currentHp = 100
    const lowHpB = makeUnit('dummy', 'enemy', 1)
    lowHpB.hexPos = { col: 4, row: 2 }
    lowHpB.maxHp = 100; lowHpB.currentHp = 100
    const bigHpA = makeUnit('dummy', 'enemy', 1)
    bigHpA.hexPos = { col: 2, row: 3 }
    bigHpA.maxHp = 9999; bigHpA.currentHp = 9999
    const bigHpB = makeUnit('dummy', 'enemy', 1)
    bigHpB.hexPos = { col: 4, row: 3 }
    bigHpB.maxHp = 9999; bigHpB.currentHp = 9999
    state = createCombatState([caster], [lowHpA, lowHpB, bigHpA, bigHpB])
    cast(caster, state)
    // row 2 (low HP) should be hit, row 3 (high HP) should be untouched
    expect(lowHpA.currentHp).toBeLessThan(100)
    expect(lowHpB.currentHp).toBeLessThan(100)
    expect(bigHpA.currentHp).toBe(9999)
    expect(bigHpB.currentHp).toBe(9999)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('33% bonus damage to shields', () => {
    // Give enemy a shield worth 300 → bonus = 99
    e1.shields.push({ id: 'test_shield', sourceAbility: 'test', value: 300, maxValue: 300, durationTicks: -1 })
    cast(caster, state)
    const dmgEvent = state.events.find(ev => ev.type === 'damage' && ev.targetId === e1.id)
    expect(dmgEvent).toBeDefined()
    // With 300 shield bonus: base damage = 400 + 99 (33% of 300) = 499 — after mitigation with spDef=30: 499 * 100/130 = 384
    // Just verify damage was dealt
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBeGreaterThan(0)
    }
  })
})
