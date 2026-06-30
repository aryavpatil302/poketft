import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 25

function addCharges(unit: Unit, count: number): void {
  unit.statusEffects.push({
    id: 'bellibolt_charge',
    sourceUnitId: unit.id,
    durationTicks: -1,
    magnitude: count,
    stackId: 'bellibolt_charge',
  })
  unit._computedStats = null
}

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
    // Place enemy adjacent (1 hex away) so it's in AoE range
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }
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

  it('does no damage when no charges are stacked', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('deals magic damage in 1-hex radius (tier 1, 50% of def+spdef)', () => {
    // Bellibolt base def=50 spdef=50, +5 each per charge
    // 5 charges → def=75, spdef=75, total=150 → 150 * 0.50 = 75 raw
    // dummy spDefense=30 → 75 * (100/130) = 57
    addCharges(caster, 5)
    cast(caster, state)
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    if (dmgEvents[0].type === 'damage') {
      expect(dmgEvents[0].damageType).toBe('magic')
      expect(dmgEvents[0].amount).toBe(58)
    }
  })

  it('tier 2 scales at 90%', () => {
    const t2 = makeUnit('bellibolt', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 4 }
    const s = createCombatState([t2], [e])
    // 5 charges → def=75, spdef=75 → 150 * 0.90 = 135 → 135 * (100/130) = 103
    addCharges(t2, 5)
    cast(t2, s)
    const dmgEvents = s.events.filter(ev => ev.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    if (dmgEvents[0].type === 'damage') {
      expect(dmgEvents[0].amount).toBe(104)
    }
  })

  it('tier 3 scales at 120%', () => {
    const t3 = makeUnit('bellibolt', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 4 }
    const s = createCombatState([t3], [e])
    // 5 charges → def=75, spdef=75 → 150 * 1.20 = 180 → 180 * (100/130) = 138
    addCharges(t3, 5)
    cast(t3, s)
    const dmgEvents = s.events.filter(ev => ev.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    if (dmgEvents[0].type === 'damage') {
      expect(dmgEvents[0].amount).toBe(138)
    }
  })

  it('removes bellibolt_charge status after discharge', () => {
    addCharges(caster, 7)
    cast(caster, state)
    expect(caster.statusEffects.some(fx => fx.stackId === 'bellibolt_charge')).toBe(false)
  })

  it('does not hit allies', () => {
    const ally = makeUnit('quagsire', 'player', 1)
    ally.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster, ally], [])
    addCharges(caster, 5)
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('emits bellibolt_discharge vfx event on cast', () => {
    cast(caster, state)
    const vfxEv = state.events.find(e => e.type === 'vfx' && e.effectId === 'bellibolt_discharge')
    expect(vfxEv).toBeDefined()
  })
})
