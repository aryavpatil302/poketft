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

describe('Ferrothorn - Iron Barbs', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('ferrothorn', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('applies iron_barbs status to caster (tier 1)', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs).toBeDefined()
  })

  it('iron_barbs magnitude equals totalShield / 4 at tier 1 (300/4 = 75)', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs!.magnitude).toBe(300 / 4)
  })

  it('iron_barbs duration is 4 * TICK_RATE at tier 1', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('applies a shield to caster equal to totalShield value (tier 1 = 300)', () => {
    cast(caster, state)
    const shield = caster.shields.find(s => s.sourceAbility === 'ferrothorn_iron_barbs')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(300)
  })

  it('shield duration matches barbs duration (4 * TICK_RATE at tier 1)', () => {
    cast(caster, state)
    const shield = caster.shields.find(s => s.sourceAbility === 'ferrothorn_iron_barbs')
    expect(shield!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('tier 2: iron_barbs magnitude is 400/4 = 100', () => {
    const t2 = makeUnit('ferrothorn', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const barbs = t2.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs!.magnitude).toBe(400 / 4)
    const shield = t2.shields.find(s => s.sourceAbility === 'ferrothorn_iron_barbs')
    expect(shield!.value).toBe(400)
    expect(barbs!.durationTicks).toBe(5 * TICK_RATE)
  })

  it('tier 3: iron_barbs magnitude is 600/4 = 150, duration = 6 * TICK_RATE', () => {
    const t3 = makeUnit('ferrothorn', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const barbs = t3.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs!.magnitude).toBe(600 / 4)
    const shield = t3.shields.find(s => s.sourceAbility === 'ferrothorn_iron_barbs')
    expect(shield!.value).toBe(600)
    expect(barbs!.durationTicks).toBe(6 * TICK_RATE)
  })

  it('emits a shield event after cast', () => {
    cast(caster, state)
    const shieldEvt = state.events.find(e => e.type === 'shield')
    expect(shieldEvt).toBeDefined()
    if (shieldEvt?.type === 'shield') {
      expect(shieldEvt.amount).toBe(300)
    }
  })

  it('iron_barbs stackId is "iron_barbs"', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.stackId === 'iron_barbs')
    expect(barbs).toBeDefined()
  })
})
