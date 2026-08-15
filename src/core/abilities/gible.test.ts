import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Mirrors combatEngine tickLeapMovement — advances the leap until landing.
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !(unit as any)._leap) unit.state = 'idle'
  }
}

describe('Gible - Bite', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('gible', 'player', 1)
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

  it('sets caster state to leaping after cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('sets caster targetId to the leap target', () => {
    cast(caster, state)
    expect(caster.targetId).toBe(enemy.id)
  })

  it('applies stun status to the target on landing', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    const stun = enemy.statusEffects.find(e => e.id === 'stun')
    expect(stun).toBeDefined()
  })

  it('tier 1 - stun duration is 1.5 seconds', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    const stun = enemy.statusEffects.find(e => e.id === 'stun')
    expect(stun?.durationTicks).toBe(Math.round(1.5 * TICK_RATE))
  })

  it('tier 2 - stun duration is 2 seconds', () => {
    const t2 = makeUnit('gible', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    advanceLeaps(t2, s)
    const stun = e.statusEffects.find(fx => fx.id === 'stun')
    expect(stun?.durationTicks).toBe(Math.round(2 * TICK_RATE))
  })

  it('tier 3 - stun duration is 2.5 seconds', () => {
    const t3 = makeUnit('gible', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    advanceLeaps(t3, s)
    const stun = e.statusEffects.find(fx => fx.id === 'stun')
    expect(stun?.durationTicks).toBe(Math.round(2.5 * TICK_RATE))
  })

  it('deals physical damage to the target on landing', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(enemy.currentHp).toBeLessThan(10000)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'physical' && e.targetId === enemy.id
    )
    expect(dmgEvent).toBeDefined()
  })

  it('tier 1 - deals 150 physical damage (before mitigation)', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.defense = 0
    enemy._computedStats = null  // force recompute with 0 defense
    caster.critChance = 0
    caster._computedStats = null
    cast(caster, state)
    advanceLeaps(caster, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(150)
    }
  })

  it('tier 2 - deals 300 physical damage (before mitigation)', () => {
    const t2 = makeUnit('gible', 'player', 2)
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
    cast(t2, s)
    advanceLeaps(t2, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(300)
    }
  })

  it('tier 3 - deals 622 physical damage (before mitigation)', () => {
    const t3 = makeUnit('gible', 'player', 3)
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
    cast(t3, s)
    advanceLeaps(t3, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(622)
    }
  })

  it('does nothing when no enemies are in range', () => {
    // Place enemy very far away (beyond 4 hex Manhattan distance)
    enemy.hexPos = { col: 0, row: 0 }  // distance = |3-0| + |5-0| = 8, out of range
    state = createCombatState([caster], [enemy])
    // Since enemy is out of range and no targetId, nothing should happen
    cast(caster, state)
    advanceLeaps(caster, state)
    // No damage events (no valid target)
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents).toHaveLength(0)
  })

  it('falls back to targetId if no enemy in range', () => {
    // Enemy far away but caster has targetId set
    enemy.hexPos = { col: 0, row: 0 }
    state = createCombatState([caster], [enemy])
    caster.targetId = enemy.id

    cast(caster, state)
    // Should leap toward the target set in targetId
    expect(caster.state).toBe('leaping')
    expect(caster.targetId).toBe(enemy.id)
  })

  it('selects enemy within 4 hex manhattan distance', () => {
    // Enemy exactly 4 manhattan distance away
    const nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 1 }  // |3-3| + |5-1| = 4, on boundary
    state = createCombatState([caster], [nearEnemy])

    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })
})
