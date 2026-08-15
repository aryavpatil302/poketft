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

  it('applies iron_barbs retaliation status to caster (tier 1)', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs).toBeDefined()
  })

  it('iron_barbs retaliation damage is 75 at tier 1', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs!.magnitude).toBe(75)
  })

  it('iron_barbs duration is 4 seconds', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.id === 'iron_barbs')
    expect(barbs!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('applies a durability buff (tier 1 = 25% defense and sp. defense)', () => {
    cast(caster, state)
    const dura = caster.statusEffects.find(e => e.id === 'iron_barbs_durability')
    expect(dura).toBeDefined()
    expect(dura!.magnitude).toBeCloseTo(0.25)
    expect(dura!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('tier 2: retaliation 150, durability 30%', () => {
    const t2 = makeUnit('ferrothorn', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    expect(t2.statusEffects.find(e => e.id === 'iron_barbs')!.magnitude).toBe(150)
    expect(t2.statusEffects.find(e => e.id === 'iron_barbs_durability')!.magnitude).toBeCloseTo(0.30)
  })

  it('tier 3: retaliation 225, durability 40%', () => {
    const t3 = makeUnit('ferrothorn', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    expect(t3.statusEffects.find(e => e.id === 'iron_barbs')!.magnitude).toBe(225)
    expect(t3.statusEffects.find(e => e.id === 'iron_barbs_durability')!.magnitude).toBeCloseTo(0.40)
  })

  it('iron_barbs stackId is "iron_barbs"', () => {
    cast(caster, state)
    const barbs = caster.statusEffects.find(e => e.stackId === 'iron_barbs')
    expect(barbs).toBeDefined()
  })

  it('adds a brief rumble animation on cast', () => {
    cast(caster, state)
    expect(caster.statusEffects.some(e => e.stackId === 'ferrothorn_rumble')).toBe(true)
  })
})
