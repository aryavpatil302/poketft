import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
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
  let nearEnemy: Unit
  let farEnemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('runerigus', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 4 }
    farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 0, row: 0 }
    state = createCombatState([caster], [nearEnemy, farEnemy])
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

  it('marks the nearest enemy with a permanent wandering spirit status effect', () => {
    cast(caster, state)
    const fx = nearEnemy.statusEffects.find(f => f.stackId === 'runerigus_wandering_spirit')
    expect(fx).toBeDefined()
    expect(fx!.durationTicks).toBe(-1)
    expect(farEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(false)
  })

  it('silences the marked target', () => {
    cast(caster, state)
    expect(nearEnemy.silenced).toBe(true)
  })

  it('damage magnitude scales per tier (550/875/7000)', () => {
    const expected = [550, 875, 7000] as const
    for (const tier of [1, 2, 3] as const) {
      const c = makeUnit('runerigus', 'player', tier)
      c.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const st = createCombatState([c], [e])
      cast(c, st)
      const fx = e.statusEffects.find(f => f.stackId === 'runerigus_wandering_spirit')!
      expect(fx.magnitude).toBe(expected[tier - 1])
    }
  })

  it('does not mark an enemy that already carries the mark — picks the next nearest instead', () => {
    cast(caster, state)
    expect(nearEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(true)

    cast(caster, state)
    expect(farEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(true)
    // nearEnemy keeps its original mark — recast does not refresh/replace it
    expect(nearEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(true)
  })

  it('does nothing when all enemies are already marked', () => {
    state = createCombatState([caster], [nearEnemy])
    cast(caster, state)
    expect(nearEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(true)
    const eventsBefore = state.events.length
    cast(caster, state)
    expect(state.events.slice(eventsBefore).some(e => e.type === 'vfx' && (e as any).effectId === 'wandering_spirit_mark_apply')).toBe(false)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'wandering_spirit_mark_apply')).toBe(false)
  })

  it('emits wandering_spirit_mark_apply VFX when marking', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'wandering_spirit_mark_apply')).toBe(true)
  })

  it('marked unit takes damage instead of casting when it would next cast', () => {
    cast(caster, state)
    nearEnemy.spDefense = 0; nearEnemy._computedStats = null
    const hpBefore = nearEnemy.currentHp
    nearEnemy.currentMana = nearEnemy.maxMana
    triggerAbility(nearEnemy, state)
    expect(nearEnemy.state).not.toBe('casting')
    expect(hpBefore - nearEnemy.currentHp).toBeCloseTo(550, -1)
  })

  it('consumes the mark and un-silences the unit when it attempts to cast', () => {
    cast(caster, state)
    nearEnemy.currentMana = nearEnemy.maxMana
    triggerAbility(nearEnemy, state)
    expect(nearEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(false)
    expect(nearEnemy.silenced).toBe(false)
  })

  it('resets mana and applies mana lock on the marked unit when the mark is consumed', () => {
    cast(caster, state)
    nearEnemy.currentMana = nearEnemy.maxMana
    triggerAbility(nearEnemy, state)
    expect(nearEnemy.currentMana).toBe(0)
    expect(nearEnemy.manaLockTimer).toBeGreaterThan(0)
  })

  it('emits wandering_spirit_consume VFX when the mark is consumed', () => {
    cast(caster, state)
    nearEnemy.currentMana = nearEnemy.maxMana
    triggerAbility(nearEnemy, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'wandering_spirit_consume')).toBe(true)
  })

  it('after being consumed, the unit can be marked again on a later cast', () => {
    cast(caster, state)
    nearEnemy.currentMana = nearEnemy.maxMana
    triggerAbility(nearEnemy, state)
    expect(nearEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(false)

    cast(caster, state)
    // nearEnemy is unmarked again and nearest — eligible to be re-marked
    expect(nearEnemy.statusEffects.some(f => f.stackId === 'runerigus_wandering_spirit')).toBe(true)
  })
})
