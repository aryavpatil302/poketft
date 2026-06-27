import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 25  // bellibolt castTimeTicks = 25

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Bellibolt - Electrophoresis', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('bellibolt', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(25)
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

  it('does no damage when attackCount is 0 (no charges)', () => {
    caster.attackCount = 0
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('deals damage proportional to attack charge count (tier 1 = 15 per charge, after mitigation)', () => {
    caster.attackCount = 3
    cast(caster, state)
    // 3 charges * 15 = 45 raw, then 45 * 100/130 (dummy spDefense=30) = 35
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    if (dmgEvents[0].type === 'damage') {
      expect(dmgEvents[0].amount).toBe(35)
    }
  })

  it('tier 2 - 20 damage per charge after mitigation', () => {
    const t2 = makeUnit('bellibolt', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.attackCount = 3
    cast(t2, s)
    const dmgEvents = s.events.filter(ev => ev.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    if (dmgEvents[0].type === 'damage') {
      // 3 * 20 = 60 raw, * 100/130 = 46
      expect(dmgEvents[0].amount).toBe(46)
    }
  })

  it('tier 3 - 30 damage per charge after mitigation', () => {
    const t3 = makeUnit('bellibolt', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.attackCount = 4
    cast(t3, s)
    const dmgEvents = s.events.filter(ev => ev.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    if (dmgEvents[0].type === 'damage') {
      // 4 * 30 = 120 raw, * 100/130 = 92
      expect(dmgEvents[0].amount).toBe(92)
    }
  })

  it('damage is split across multiple enemies', () => {
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 1 }
    state = createCombatState([caster], [enemy, e2])
    caster.attackCount = 4  // 4 * 15 = 60 total, split to 30 per enemy
    cast(caster, state)
    // 30 raw each, * 100/130 = 23
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBe(2)
    if (dmgEvents[0].type === 'damage') {
      expect(dmgEvents[0].amount).toBe(23)
    }
  })

  it('resets attackCount to 0 after discharge', () => {
    caster.attackCount = 5
    cast(caster, state)
    expect(caster.attackCount).toBe(0)
  })

  it('damage type is magic', () => {
    caster.attackCount = 2
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('magic')
    }
  })
})
