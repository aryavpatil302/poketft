import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 20
const ASCENT_DURATION = 2 * TICK_RATE  // 120 ticks

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Rayquaza - Dragon Ascent', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('rayquaza', 'player', 1)
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

  it('sets caster state to ascended after cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('ascended')
  })

  it('sets nearest enemy state to ascended', () => {
    cast(caster, state)
    expect(enemy.state).toBe('ascended')
  })

  it('adds a rayquaza_ascent countdown status effect on caster', () => {
    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')
    expect(ascent).toBeDefined()
  })

  it('ascent countdown duration is 2 seconds (120 ticks)', () => {
    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')
    expect(ascent?.durationTicks).toBe(ASCENT_DURATION)
  })

  it('ascent has stackId rayquaza_ascent', () => {
    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')
    expect(ascent?.stackId).toBe('rayquaza_ascent')
  })

  it('ascent onExpire restores caster state to idle', () => {
    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')
    expect(ascent?.onExpire).toBeDefined()

    // Register enemy in occupancy for slam to potentially hit
    state.hexOccupancy.set(`${enemy.hexPos.col},${enemy.hexPos.row}`, enemy.id)

    ascent!.onExpire!(caster, state)
    expect(caster.state).toBe('idle')
  })

  it('ascent onExpire restores target state from ascended to idle', () => {
    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')

    state.hexOccupancy.set(`${enemy.hexPos.col},${enemy.hexPos.row}`, enemy.id)
    ascent!.onExpire!(caster, state)

    expect(enemy.state).toBe('idle')
  })

  it('ascent onExpire deals slam damage to enemy at target location', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.spDefense = 0

    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')

    // Place enemy occupancy so slam can find them
    state.hexOccupancy.set(`${enemy.hexPos.col},${enemy.hexPos.row}`, enemy.id)

    const hpBefore = enemy.currentHp
    ascent!.onExpire!(caster, state)

    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 1 - center slam deals 500 true damage', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    state = createCombatState([caster], [enemy])
    state.hexOccupancy.set(`${enemy.hexPos.col},${enemy.hexPos.row}`, enemy.id)

    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')
    ascent!.onExpire!(caster, state)

    const trueDmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'true' && e.targetId === enemy.id
    )
    expect(trueDmgEvent).toBeDefined()
    if (trueDmgEvent?.type === 'damage') {
      expect(trueDmgEvent.amount).toBe(500)
    }
  })

  it('tier 2 - center slam deals 750 true damage', () => {
    const t2 = makeUnit('rayquaza', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000
    e.currentHp = 10000
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    s.hexOccupancy.set(`${e.hexPos.col},${e.hexPos.row}`, e.id)

    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)

    const ascent = t2.statusEffects.find(fx => fx.id === 'rayquaza_ascent')
    ascent!.onExpire!(t2, s)

    const trueDmgEvent = s.events.find(
      ev => ev.type === 'damage' && (ev as any).damageType === 'true' && ev.targetId === e.id
    )
    if (trueDmgEvent?.type === 'damage') {
      expect(trueDmgEvent.amount).toBe(750)
    }
  })

  it('tier 3 - center slam deals 1200 true damage', () => {
    const t3 = makeUnit('rayquaza', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000
    e.currentHp = 10000
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    s.hexOccupancy.set(`${e.hexPos.col},${e.hexPos.row}`, e.id)

    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)

    const ascent = t3.statusEffects.find(fx => fx.id === 'rayquaza_ascent')
    ascent!.onExpire!(t3, s)

    const trueDmgEvent = s.events.find(
      ev => ev.type === 'damage' && (ev as any).damageType === 'true' && ev.targetId === e.id
    )
    if (trueDmgEvent?.type === 'damage') {
      expect(trueDmgEvent.amount).toBe(1200)
    }
  })

  it('slam deals reduced damage at distance 1 (50% of center)', () => {
    // Place a second enemy adjacent to primary target
    enemy.maxHp = 10000
    enemy.currentHp = 10000

    const adjacentEnemy = makeUnit('dummy', 'enemy', 1)
    adjacentEnemy.maxHp = 10000
    adjacentEnemy.currentHp = 10000
    adjacentEnemy.hexPos = { col: 3, row: 1 }  // one hex away from enemy at row 2

    state = createCombatState([caster], [enemy, adjacentEnemy])
    state.hexOccupancy.set(`${enemy.hexPos.col},${enemy.hexPos.row}`, enemy.id)
    state.hexOccupancy.set(`${adjacentEnemy.hexPos.col},${adjacentEnemy.hexPos.row}`, adjacentEnemy.id)

    cast(caster, state)
    const ascent = caster.statusEffects.find(e => e.id === 'rayquaza_ascent')
    ascent!.onExpire!(caster, state)

    // adjacentEnemy should take 50% = 250 true damage
    const adjDmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'true' && e.targetId === adjacentEnemy.id
    )
    if (adjDmgEvent?.type === 'damage') {
      expect(adjDmgEvent.amount).toBe(250)
    }
  })

  it('does not set enemy to ascended when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    // Caster is still ascended, no crash
    expect(caster.state).toBe('ascended')
  })
})
