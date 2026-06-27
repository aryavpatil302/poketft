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

describe('Excadrill - Drill Run', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('excadrill', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // Place enemy within 3 hexes
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 3 }
    state = createCombatState([caster], [enemy])
  })

  it('sets unit state to leaping after cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('applies knockUp status to the enemy immediately', () => {
    cast(caster, state)
    const hasKnockUp = enemy.statusEffects.some(e => e.id === 'knockUp')
    expect(hasKnockUp).toBe(true)
  })

  it('knockUp duration is 1.5 seconds at tier 1', () => {
    cast(caster, state)
    const ku = enemy.statusEffects.find(e => e.id === 'knockUp')
    expect(ku).toBeDefined()
    expect(ku!.durationTicks).toBe(Math.round(1.5 * TICK_RATE))
  })

  it('knockUp duration is 2 seconds at tier 2', () => {
    const t2 = makeUnit('excadrill', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 3 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const ku = e2.statusEffects.find(e => e.id === 'knockUp')
    expect(ku!.durationTicks).toBe(Math.round(2 * TICK_RATE))
  })

  it('knockUp duration is 3 seconds at tier 3', () => {
    const t3 = makeUnit('excadrill', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 3 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const ku = e3.statusEffects.find(e => e.id === 'knockUp')
    expect(ku!.durationTicks).toBe(Math.round(3 * TICK_RATE))
  })

  it('deals physical damage to the enemy on cast', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('adds exactly 3 attack modifiers after cast', () => {
    cast(caster, state)
    expect(caster.attackModifiers).toHaveLength(3)
  })

  it('each attack modifier has 1 remaining charge and correct bonus damage (tier 1 = 50)', () => {
    cast(caster, state)
    for (const mod of caster.attackModifiers) {
      expect(mod.id).toBe('excadrill_drill')
      expect(mod.remainingCharges).toBe(1)
      expect(mod.bonusDamage).toBe(50)
      expect(mod.bonusDamageType).toBe('physical')
      expect(mod.aoeRadius).toBe(1)
    }
  })

  it('attack modifiers have bonus damage of 75 at tier 2', () => {
    const t2 = makeUnit('excadrill', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 3 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    expect(t2.attackModifiers[0].bonusDamage).toBe(75)
  })

  it('attack modifiers have bonus damage of 120 at tier 3', () => {
    const t3 = makeUnit('excadrill', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 3 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    expect(t3.attackModifiers[0].bonusDamage).toBe(120)
  })

  it('target is set to the enemy after cast', () => {
    cast(caster, state)
    expect(caster.targetId).toBe(enemy.id)
  })
})
