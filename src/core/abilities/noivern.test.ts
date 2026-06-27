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

describe('Noivern - Boomburst', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('noivern', 'player', 1)
    caster.hexPos = { col: 3, row: 4 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }  // row distance 2, within range
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

  it('deals magic damage to enemy within 4 rows', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(10000)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'magic' && e.targetId === enemy.id
    )
    expect(dmgEvent).toBeDefined()
  })

  it('tier 1 - damage is 250 (before mitigation)', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.spDefense = 0
    enemy._computedStats = null  // force recompute with 0 spDefense
    cast(caster, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(250)
    }
  })

  it('tier 2 - damage is 375 (before mitigation)', () => {
    const t2 = makeUnit('noivern', 'player', 2)
    t2.hexPos = { col: 3, row: 4 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000
    e.currentHp = 10000
    e.spDefense = 0
    e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(375)
    }
  })

  it('tier 3 - damage is 600 (before mitigation)', () => {
    const t3 = makeUnit('noivern', 'player', 3)
    t3.hexPos = { col: 3, row: 4 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000
    e.currentHp = 10000
    e.spDefense = 0
    e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(600)
    }
  })

  it('hits all enemies within 4 rows', () => {
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 1, row: 2 }  // row distance 2 from caster (row 4)
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 5, row: 7 }  // row distance 3
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 0 }  // row distance 4
    state = createCombatState([caster], [e1, e2, e3])
    cast(caster, state)

    expect(e1.currentHp).toBeLessThan(e1.maxHp)
    expect(e2.currentHp).toBeLessThan(e2.maxHp)
    expect(e3.currentHp).toBeLessThan(e3.maxHp)
  })

  it('does NOT hit enemies more than 4 rows away', () => {
    const nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 1 }  // row distance 3, within range
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 9 }  // row distance 5, out of range

    state = createCombatState([caster], [nearEnemy, farEnemy])
    cast(caster, state)

    expect(nearEnemy.currentHp).toBeLessThan(nearEnemy.maxHp)
    expect(farEnemy.currentHp).toBe(farEnemy.maxHp)  // not hit
  })

  it('applies silence status to hit enemies', () => {
    cast(caster, state)
    const silence = enemy.statusEffects.find(e => e.id === 'silence')
    expect(silence).toBeDefined()
  })

  it('tier 1 - silence duration is 2 seconds', () => {
    cast(caster, state)
    const silence = enemy.statusEffects.find(e => e.id === 'silence')
    expect(silence?.durationTicks).toBe(Math.round(2 * TICK_RATE))
  })

  it('tier 2 - silence duration is 2.5 seconds', () => {
    const t2 = makeUnit('noivern', 'player', 2)
    t2.hexPos = { col: 3, row: 4 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)
    const silence = e.statusEffects.find(fx => fx.id === 'silence')
    expect(silence?.durationTicks).toBe(Math.round(2.5 * TICK_RATE))
  })

  it('tier 3 - silence duration is 3 seconds', () => {
    const t3 = makeUnit('noivern', 'player', 3)
    t3.hexPos = { col: 3, row: 4 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)
    const silence = e.statusEffects.find(fx => fx.id === 'silence')
    expect(silence?.durationTicks).toBe(Math.round(3 * TICK_RATE))
  })

  it('silence stackId includes the target id', () => {
    cast(caster, state)
    const silence = enemy.statusEffects.find(e => e.id === 'silence')
    expect(silence?.stackId).toBe(`noivern_silence_${enemy.id}`)
  })

  it('does nothing when no enemies are in range', () => {
    // Place enemy far beyond 4 rows
    enemy.hexPos = { col: 3, row: 9 }
    state = createCombatState([caster], [enemy])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
