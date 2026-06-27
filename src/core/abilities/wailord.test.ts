import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 5

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Wailord - Bounce', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('wailord', 'player', 1)
    caster.hexPos = { col: 0, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 6, row: 2 }
    state = createCombatState([caster], [enemy])
    caster.targetId = enemy.id
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

  it('sets unit state to leaping after cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('tier 1 - adds a flat shield of 400', () => {
    cast(caster, state)
    expect(caster.shields.length).toBeGreaterThan(0)
    expect(caster.shields[0].value).toBe(400)
    expect(caster.shields[0].maxValue).toBe(400)
  })

  it('tier 2 - adds a flat shield of 475', () => {
    const t2 = makeUnit('wailord', 'player', 2)
    t2.hexPos = { col: 0, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 6, row: 2 }
    const s = createCombatState([t2], [e])
    t2.targetId = e.id
    cast(t2, s)
    expect(t2.shields[0].value).toBe(475)
  })

  it('tier 3 - adds a flat shield of 575', () => {
    const t3 = makeUnit('wailord', 'player', 3)
    t3.hexPos = { col: 0, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 6, row: 2 }
    const s = createCombatState([t3], [e])
    t3.targetId = e.id
    cast(t3, s)
    expect(t3.shields[0].value).toBe(575)
  })

  it('shield sourceAbility is wailord_bounce', () => {
    cast(caster, state)
    expect(caster.shields[0].sourceAbility).toBe('wailord_bounce')
  })

  it('shield lasts 3 seconds (not permanent)', () => {
    cast(caster, state)
    expect(caster.shields[0].durationTicks).toBe(3 * TICK_RATE)
  })

  it('casting again replaces the existing shield instead of stacking', () => {
    cast(caster, state)
    expect(caster.shields).toHaveLength(1)
    // Cast a second time
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
    expect(caster.shields).toHaveLength(1)
  })

  it('emits a shield event with correct amount', () => {
    cast(caster, state)
    const shieldEvent = state.events.find(e => e.type === 'shield')
    expect(shieldEvent).toBeDefined()
    if (shieldEvent?.type === 'shield') {
      expect(shieldEvent.amount).toBe(400)
    }
  })

  it('target takes damage on landing', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    // Simulate leap completion by ticking movement until leaping ends
    // The onLand callback fires when the unit arrives — trigger it manually via _leap
    if ((caster as any)._leap?.onLand) {
      (caster as any)._leap.onLand(caster, state)
    }
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('target receives stun on landing', () => {
    cast(caster, state)
    if ((caster as any)._leap?.onLand) {
      (caster as any)._leap.onLand(caster, state)
    }
    const stun = enemy.statusEffects.find(e => e.id === 'stun')
    expect(stun).toBeDefined()
  })

  it('tier 1 - stun duration is 1 second', () => {
    cast(caster, state)
    if ((caster as any)._leap?.onLand) {
      (caster as any)._leap.onLand(caster, state)
    }
    const stun = enemy.statusEffects.find(e => e.id === 'stun')
    expect(stun?.durationTicks).toBe(Math.round(1 * TICK_RATE))
  })

  it('tier 3 - stun duration is 1.5 seconds', () => {
    const t3 = makeUnit('wailord', 'player', 3)
    t3.hexPos = { col: 0, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 6, row: 2 }
    const s = createCombatState([t3], [e])
    t3.targetId = e.id
    cast(t3, s)
    if ((t3 as any)._leap?.onLand) {
      (t3 as any)._leap.onLand(t3, s)
    }
    const stun = e.statusEffects.find(fx => fx.id === 'stun')
    expect(stun?.durationTicks).toBe(Math.round(1.5 * TICK_RATE))
  })
})
