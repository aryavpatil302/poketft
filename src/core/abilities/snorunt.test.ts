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

describe('Snorunt - Ice Body', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('snorunt', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // within 2 hexes
    state = createCombatState([caster], [enemy])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('applies a shield to caster after cast (tier 1 = 120)', () => {
    cast(caster, state)
    expect(caster.shields).toHaveLength(1)
    expect(caster.shields[0].value).toBe(120)
  })

  it('shield duration is 6 * TICK_RATE', () => {
    cast(caster, state)
    expect(caster.shields[0].durationTicks).toBe(6 * TICK_RATE)
  })

  it('tier 2 shield value is 180', () => {
    const t2 = makeUnit('snorunt', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 4 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    expect(t2.shields[0].value).toBe(180)
  })

  it('tier 3 shield value is 280', () => {
    const t3 = makeUnit('snorunt', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 4 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    expect(t3.shields[0].value).toBe(280)
  })

  it('onExpire deals AoE damage to enemies within 2 hexes', () => {
    cast(caster, state)
    const shield = caster.shields[0]
    expect(shield.onExpire).toBeDefined()
    const hpBefore = enemy.currentHp
    shield.onExpire!(caster, shield)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('onExpire does NOT damage enemies farther than 2 hexes', () => {
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 0 }  // far from caster at row 5
    const s = createCombatState([caster], [enemy, farEnemy])
    cast(caster, s)
    const shield = caster.shields[0]
    const hpBefore = farEnemy.currentHp
    shield.onExpire!(caster, shield)
    expect(farEnemy.currentHp).toBe(hpBefore)
  })

  it('onExpire applies chill status to hit enemies', () => {
    cast(caster, state)
    const shield = caster.shields[0]
    shield.onExpire!(caster, shield)
    const chill = enemy.statusEffects.find(e => e.id === 'chill')
    expect(chill).toBeDefined()
    expect(chill!.magnitude).toBe(0.25)
  })

  it('emits a shield event after cast', () => {
    cast(caster, state)
    const shieldEvt = state.events.find(e => e.type === 'shield')
    expect(shieldEvt).toBeDefined()
  })
})
