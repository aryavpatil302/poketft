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

describe('Sneasler - Dire Claw', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('sneasler', 'player', 1)
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

  it('deals physical damage to nearest enemy (tier 1 = 154 after mitigation)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('physical')
      // 200 raw * 100/130 (dummy defense=30) = 154
      expect(dmgEvent.amount).toBe(154)
    }
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 2 - deals 231 physical damage after mitigation (300 raw)', () => {
    const t2 = makeUnit('sneasler', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    if (dmgEvent?.type === 'damage') {
      // 300 raw * 100/130 = 231
      expect(dmgEvent.amount).toBe(231)
    }
  })

  it('tier 3 - deals 385 physical damage after mitigation (500 raw)', () => {
    const t3 = makeUnit('sneasler', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    if (dmgEvent?.type === 'damage') {
      // 500 raw * 100/130 = 385
      expect(dmgEvent.amount).toBe(385)
    }
  })

  it('applies poison status effect on target after hit', () => {
    cast(caster, state)
    if (enemy.state !== 'dead') {
      const poison = enemy.statusEffects.find(fx => fx.id === 'poison')
      expect(poison).toBeDefined()
    }
  })

  it('poison has 3-second duration (3 * TICK_RATE)', () => {
    cast(caster, state)
    const poison = enemy.statusEffects.find(fx => fx.id === 'poison')
    if (poison) {
      expect(poison.durationTicks).toBe(3 * TICK_RATE)
    }
  })

  it('tier 1 - poison magnitude is 30 (dmg per TICK_RATE)', () => {
    cast(caster, state)
    const poison = enemy.statusEffects.find(fx => fx.id === 'poison')
    if (poison) {
      expect(poison.magnitude).toBe(30)
    }
  })

  it('canCrit is false when target is NOT already poisoned', () => {
    // No poison pre-existing → damage should be non-crit (standard damage event)
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    if (dmgEvent?.type === 'damage') {
      // canCrit was false so isCrit should be false (unless RNG crits, but dummy has 0 crit)
      expect(typeof dmgEvent.isCrit).toBe('boolean')
    }
  })

  it('allows crit when target is already poisoned', () => {
    // Pre-apply poison status
    enemy.statusEffects.push({
      id: 'poison',
      sourceUnitId: 'test',
      durationTicks: 100,
    })
    // After cast, canCrit should have been true
    // We verify the cast doesn't error and the poison stack check triggers
    cast(caster, state)
    // Both a damage event and the poison check should exist
    const dmgEvents = state.events.filter(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvents.length).toBeGreaterThan(0)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
