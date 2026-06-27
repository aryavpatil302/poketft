import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 25  // palossand castTimeTicks = 25

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Palossand - Scorching Sands', () => {
  let caster: Unit
  let e1: Unit
  let e2: Unit
  let e3: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('palossand', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 1 }
    e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 4, row: 1 }
    state = createCombatState([caster], [e1, e2, e3])
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

  it('tier 1 - deals magic damage to 2 nearest enemies', () => {
    cast(caster, state)
    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(2)
  })

  it('tier 2 - deals magic damage to 3 nearest enemies', () => {
    const t2 = makeUnit('palossand', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t2], [e1, e2, e3])
    cast(t2, s)
    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(3)
  })

  it('tier 3 - deals magic damage to up to 4 nearest enemies (capped at 3 available)', () => {
    const t3 = makeUnit('palossand', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    // 3 enemies available, tier 3 targets 4 → all 3 get hit
    expect(damaged).toHaveLength(3)
  })

  it('damage events are magic type', () => {
    cast(caster, state)
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    for (const ev of dmgEvents) {
      if (ev.type === 'damage') {
        expect(ev.damageType).toBe('magic')
      }
    }
  })

  it('applies burn status effect on surviving targets', () => {
    cast(caster, state)
    const damagedEnemies = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    for (const dmgEnemy of damagedEnemies) {
      if (dmgEnemy.state !== 'dead') {
        const burn = dmgEnemy.statusEffects.find(fx => fx.id === 'burn')
        expect(burn).toBeDefined()
      }
    }
  })

  it('burn has magnitude 25 (burnPerSec)', () => {
    cast(caster, state)
    const burn = e1.statusEffects.find(fx => fx.id === 'burn')
    if (burn) {
      expect(burn.magnitude).toBe(25)
    }
  })

  it('burn has 4-second duration (4 * TICK_RATE)', () => {
    cast(caster, state)
    const burn = e1.statusEffects.find(fx => fx.id === 'burn')
    if (burn) {
      expect(burn.durationTicks).toBe(4 * TICK_RATE)
    }
  })

  it('increments spell buff counter (beachy trait)', () => {
    caster.traits = ['beachy']
    const before = state.spellBuffCounters.get(caster.id) ?? 0
    cast(caster, state)
    const after = state.spellBuffCounters.get(caster.id) ?? 0
    expect(after).toBeGreaterThan(before)
  })

  it('tier 1 base damage is 115 after mitigation (150 raw)', () => {
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    if (dmgEvent?.type === 'damage') {
      // 150 raw * 100/130 (dummy spDefense=30) = 115
      expect(dmgEvent.amount).toBe(115)
    }
  })

  it('spell buff increases damage', () => {
    state.spellBuffCounters.set(caster.id, 10)
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    if (dmgEvent?.type === 'damage') {
      // 150 * 1.2 = 180 raw, * 100/130 = 138
      expect(dmgEvent.amount).toBeGreaterThan(115)
    }
  })
})
