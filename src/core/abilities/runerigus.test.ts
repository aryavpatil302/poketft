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

describe('Runerigus - Wandering Spirit', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('runerigus', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
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

  it('applies wandering_spirit mark on nearest enemy', () => {
    cast(caster, state)
    const mark = enemy.marks.find(m => m.id === 'wandering_spirit')
    expect(mark).toBeDefined()
  })

  it('mark has 4-second duration (4 * TICK_RATE)', () => {
    cast(caster, state)
    const mark = enemy.marks.find(m => m.id === 'wandering_spirit')
    expect(mark?.durationTicks).toBe(4 * TICK_RATE)
  })

  it('tier 1 - mark has magnitude of 250 (silence damage)', () => {
    cast(caster, state)
    const mark = enemy.marks.find(m => m.id === 'wandering_spirit')
    expect(mark?.magnitude).toBe(250)
  })

  it('tier 2 - mark has magnitude of 375', () => {
    const t2 = makeUnit('runerigus', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const mark = e.marks.find(m => m.id === 'wandering_spirit')
    expect(mark?.magnitude).toBe(375)
  })

  it('tier 3 - mark has magnitude of 600', () => {
    const t3 = makeUnit('runerigus', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const mark = e.marks.find(m => m.id === 'wandering_spirit')
    expect(mark?.magnitude).toBe(600)
  })

  it('silences the target immediately on cast', () => {
    cast(caster, state)
    expect(enemy.silenced).toBe(true)
  })

  it('applies silence status effect on target', () => {
    cast(caster, state)
    const silence = enemy.statusEffects.find(fx => fx.id === 'silence')
    expect(silence).toBeDefined()
    expect(silence?.durationTicks).toBe(4 * TICK_RATE)
  })

  it('mark onDetonate un-silences the target', () => {
    cast(caster, state)
    enemy.silenced = true
    const mark = enemy.marks.find(m => m.id === 'wandering_spirit')
    expect(mark?.onDetonate).toBeDefined()
    mark!.onDetonate!(enemy, caster, state)
    expect(enemy.silenced).toBe(false)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
