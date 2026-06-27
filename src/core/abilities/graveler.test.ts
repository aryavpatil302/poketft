import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Graveler - Iron Defense', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('graveler', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('transitions to casting state and fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('applies a shield at full HP equal to the base value (tier 1 = 150)', () => {
    cast(caster, state)
    expect(caster.shields).toHaveLength(1)
    // At full HP, missingHp = 0, so shieldAmount = round(150 * (1 + 0.20 * 0)) = 150
    expect(caster.shields[0].value).toBe(150)
  })

  it('tier 2 shield at full HP equals 225', () => {
    const t2 = makeUnit('graveler', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    expect(t2.shields[0].value).toBe(225)
  })

  it('tier 3 shield at full HP equals 350', () => {
    const t3 = makeUnit('graveler', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    expect(t3.shields[0].value).toBe(350)
  })

  it('shield scales larger when caster is at 50% HP', () => {
    // Damage caster to 50% HP first
    caster.currentHp = Math.floor(caster.maxHp * 0.5)
    cast(caster, state)
    // missingHp = maxHp * 0.5, so shieldAmount = round(150 * (1 + 0.20 * 0.5)) = round(150 * 1.10) = 165
    const missingRatio = 0.5
    const expected = Math.round(150 * (1 + 0.20 * missingRatio))
    expect(caster.shields[0].value).toBe(expected)
  })

  it('onExpire permanently increases caster armor by tier 1 value (15)', () => {
    cast(caster, state)
    const defenseBefore = caster.defense
    const shield = caster.shields[0]
    expect(shield.onExpire).toBeDefined()
    shield.onExpire!(caster, shield)
    expect(caster.defense).toBe(defenseBefore + 15)
  })

  it('onExpire grants 25 armor at tier 2', () => {
    const t2 = makeUnit('graveler', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const defBefore = t2.defense
    const shield = t2.shields[0]
    shield.onExpire!(t2, shield)
    expect(t2.defense).toBe(defBefore + 25)
  })

  it('onExpire grants 40 armor at tier 3', () => {
    const t3 = makeUnit('graveler', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const defBefore = t3.defense
    const shield = t3.shields[0]
    shield.onExpire!(t3, shield)
    expect(t3.defense).toBe(defBefore + 40)
  })

  it('emits a shield event after cast', () => {
    cast(caster, state)
    const shieldEvt = state.events.find(e => e.type === 'shield')
    expect(shieldEvt).toBeDefined()
  })

  it('shield has no duration timer (durationTicks = -1)', () => {
    cast(caster, state)
    expect(caster.shields[0].durationTicks).toBe(-1)
  })
})
