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

describe('Stonjourner - Power Spot', () => {
  let caster: Unit
  let ally: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('stonjourner', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    ally = makeUnit('graveler', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster, ally], [enemy])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('heals caster when below max HP (tier 1 = 150)', () => {
    caster.currentHp = caster.maxHp - 300
    const hpBefore = caster.currentHp
    cast(caster, state)
    expect(caster.currentHp).toBeGreaterThan(hpBefore)
    expect(caster.currentHp).toBeLessThanOrEqual(caster.maxHp)
  })

  it('heal does not exceed max HP', () => {
    caster.currentHp = caster.maxHp  // full HP
    cast(caster, state)
    expect(caster.currentHp).toBeLessThanOrEqual(caster.maxHp)
  })

  it('steals 10% of nearest ally defense at tier 1', () => {
    const allyDefBefore = ally.defense
    const stolenExpected = Math.floor(allyDefBefore * 0.10)
    const casterDefBefore = caster.defense
    cast(caster, state)
    expect(ally.defense).toBe(allyDefBefore - stolenExpected)
    expect(caster.defense).toBe(casterDefBefore + stolenExpected)
  })

  it('steals 10% of nearest ally spDefense at tier 1', () => {
    const allySpDefBefore = ally.spDefense
    const stolenExpected = Math.floor(allySpDefBefore * 0.10)
    const casterSpDefBefore = caster.spDefense
    cast(caster, state)
    expect(ally.spDefense).toBe(allySpDefBefore - stolenExpected)
    expect(caster.spDefense).toBe(casterSpDefBefore + stolenExpected)
  })

  it('steals 15% at tier 2', () => {
    const t2 = makeUnit('stonjourner', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const a2 = makeUnit('graveler', 'player', 1)
    a2.hexPos = { col: 4, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2, a2], [e2])
    const allyDefBefore = a2.defense
    cast(t2, s2)
    const stolenExpected = Math.floor(allyDefBefore * 0.15)
    expect(a2.defense).toBe(allyDefBefore - stolenExpected)
  })

  it('steals 25% at tier 3', () => {
    const t3 = makeUnit('stonjourner', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const a3 = makeUnit('graveler', 'player', 1)
    a3.hexPos = { col: 4, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3, a3], [e3])
    const allyDefBefore = a3.defense
    cast(t3, s3)
    const stolenExpected = Math.floor(allyDefBefore * 0.25)
    expect(a3.defense).toBe(allyDefBefore - stolenExpected)
  })

  it('does not crash when no ally is present', () => {
    const soloState = createCombatState([caster], [enemy])
    expect(() => cast(caster, soloState)).not.toThrow()
  })

  it('ally defense never goes below 0', () => {
    ally.defense = 1
    cast(caster, state)
    expect(ally.defense).toBeGreaterThanOrEqual(0)
  })
})
