import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 20
const MARK_ID = 'charizard_flame_mark'

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Charizard - Blast Burn', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('charizard', 'player', 1)
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

  it('emits a cast event on first cast', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('first cast - does not deal damage immediately', () => {
    cast(caster, state)
    // First cast should only apply marks, not damage
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('tier 1 - first cast marks 2 enemies', () => {
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 5, row: 2 }
    state = createCombatState([caster], [e1, e2, e3])

    cast(caster, state)

    const markedCount = [e1, e2, e3].filter(e => e.marks.some(m => m.id === MARK_ID)).length
    expect(markedCount).toBe(2)
  })

  it('tier 2 - first cast marks 3 enemies', () => {
    const t2 = makeUnit('charizard', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 5, row: 2 }
    const s = createCombatState([t2], [e1, e2, e3])

    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)

    const markedCount = [e1, e2, e3].filter(e => e.marks.some(m => m.id === MARK_ID)).length
    expect(markedCount).toBe(3)
  })

  it('tier 3 - first cast marks 4 enemies', () => {
    const t3 = makeUnit('charizard', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const enemies = Array.from({ length: 4 }, (_, i) => {
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: i + 1, row: 2 }
      return e
    })
    const s = createCombatState([t3], enemies)

    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)

    const markedCount = enemies.filter(e => e.marks.some(m => m.id === MARK_ID)).length
    expect(markedCount).toBe(4)
  })

  it('second cast - deals execute (true) damage to the highest-HP marked enemy', () => {
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [e1, e2])

    // First cast: mark both enemies
    cast(caster, state)

    // Confirm both marked
    expect(e1.marks.some(m => m.id === MARK_ID)).toBe(true)
    expect(e2.marks.some(m => m.id === MARK_ID)).toBe(true)

    // Adjust HP so e1 has more
    e1.currentHp = e1.maxHp
    e2.currentHp = Math.floor(e2.maxHp * 0.5)

    state.events = []

    // Second cast: execute
    cast(caster, state)

    const damageEvents = state.events.filter(e => e.type === 'damage')
    expect(damageEvents.length).toBeGreaterThan(0)

    // Primary target (e1 - highest HP) should take true damage
    const trueDmgEvent = damageEvents.find(
      e => e.type === 'damage' && (e as any).damageType === 'true' && e.targetId === e1.id
    )
    expect(trueDmgEvent).toBeDefined()
  })

  it('second cast - deals magic AoE damage to non-primary marked enemies', () => {
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [e1, e2])

    cast(caster, state)
    e1.currentHp = e1.maxHp
    e2.currentHp = Math.floor(e2.maxHp * 0.5)
    state.events = []
    cast(caster, state)

    const magicDmgOnE2 = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'magic' && e.targetId === e2.id
    )
    expect(magicDmgOnE2).toBeDefined()
  })

  it('second cast - removes marks from all enemies', () => {
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [e1, e2])

    cast(caster, state)
    cast(caster, state)

    expect(e1.marks.some(m => m.id === MARK_ID)).toBe(false)
    expect(e2.marks.some(m => m.id === MARK_ID)).toBe(false)
  })

  it('tier 1 - execute damage is 600', () => {
    // Give enemy enough HP to survive
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    state = createCombatState([caster], [enemy])

    // First cast: mark
    cast(caster, state)
    state.events = []

    // Second cast: execute
    cast(caster, state)

    const trueDmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'true'
    )
    expect(trueDmgEvent).toBeDefined()
    if (trueDmgEvent?.type === 'damage') {
      expect(trueDmgEvent.amount).toBe(600)
    }
  })

  it('third cast after second resets to marking phase', () => {
    // After second cast (execute), marks should be cleared
    // So a third cast should start marking again (no damage events)
    cast(caster, state)  // first: mark
    cast(caster, state)  // second: execute
    state.events = []
    cast(caster, state)  // third: should mark again
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
