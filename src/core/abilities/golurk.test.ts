import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 15): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Golurk - Poltergeist', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('golurk', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('adds a passiveAttackHandler with id golurk_shadow after cast', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')
    expect(handler).toBeDefined()
  })

  it('does not add duplicate handler on second cast', () => {
    cast(caster, state)
    cast(caster, state)
    const handlers = caster.passiveAttackHandlers.filter(h => h.id === 'golurk_shadow')
    expect(handlers).toHaveLength(1)
  })

  it('handler does NOT fire on attackCount not divisible by 3', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    const hpBefore = enemy.currentHp
    caster.attackCount = 1
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBe(hpBefore)
    expect(caster.shields).toHaveLength(0)
  })

  it('handler fires on attackCount divisible by 3 — deals damage to enemy', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    const hpBefore = enemy.currentHp
    caster.attackCount = 3
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('handler grants a shield on fire (tier 1 = 200)', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    caster.attackCount = 3
    handler.onAttack(caster, enemy, state)
    expect(caster.shields.length).toBeGreaterThan(0)
    expect(caster.shields[0].value).toBe(200)
  })

  it('shield value is 300 at tier 2', () => {
    const t2 = makeUnit('golurk', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const handler = t2.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    t2.attackCount = 3
    handler.onAttack(t2, e2, s2)
    expect(t2.shields[0].value).toBe(300)
  })

  it('shield value is 500 at tier 3', () => {
    const t3 = makeUnit('golurk', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const handler = t3.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    t3.attackCount = 3
    handler.onAttack(t3, e3, s3)
    expect(t3.shields[0].value).toBe(500)
  })

  it('shield has no duration (-1 = permanent until broken)', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    caster.attackCount = 3
    handler.onAttack(caster, enemy, state)
    expect(caster.shields[0].durationTicks).toBe(-1)
  })

  it('splash hits adjacent enemy for 50% damage when handler fires', () => {
    const splashEnemy = makeUnit('dummy', 'enemy', 1)
    splashEnemy.hexPos = { col: 3, row: 1 }
    const s = createCombatState([caster], [enemy, splashEnemy])
    cast(caster, s)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    const hpSplash = splashEnemy.currentHp
    caster.attackCount = 3
    handler.onAttack(caster, enemy, s)
    expect(splashEnemy.currentHp).toBeLessThan(hpSplash)
  })

  it('emits a shield event when handler fires', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golurk_shadow')!
    caster.attackCount = 3
    handler.onAttack(caster, enemy, state)
    const shieldEvt = state.events.find(e => e.type === 'shield')
    expect(shieldEvt).toBeDefined()
  })
})
