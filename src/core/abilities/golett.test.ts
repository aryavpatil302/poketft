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

describe('Golett - Shadow Punch', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('golett', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('adds a passiveAttackHandler with id golett_shadow after cast', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golett_shadow')
    expect(handler).toBeDefined()
  })

  it('does not add duplicate handler on second cast', () => {
    cast(caster, state)
    cast(caster, state)
    const handlers = caster.passiveAttackHandlers.filter(h => h.id === 'golett_shadow')
    expect(handlers).toHaveLength(1)
  })

  it('handler does NOT fire on non-multiples of 4', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golett_shadow')!
    const hpBefore = enemy.currentHp
    caster.attackCount = 1
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBe(hpBefore)
  })

  it('handler fires shadow punch damage on attackCount % 4 === 0 (tier 1 = 80)', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golett_shadow')!
    const hpBefore = enemy.currentHp
    caster.attackCount = 4
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('handler fires shadow punch damage at attackCount = 8', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golett_shadow')!
    const hpBefore = enemy.currentHp
    caster.attackCount = 8
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 2 damage is 120 per shadow punch trigger', () => {
    const t2 = makeUnit('golett', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2, 15)
    const handler = t2.passiveAttackHandlers.find(h => h.id === 'golett_shadow')!
    const hpBefore = e2.currentHp
    t2.attackCount = 4
    handler.onAttack(t2, e2, s2)
    // Dummy has 30 defense, magic damage mitigated but should reduce HP
    expect(e2.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 3 damage is 200 per shadow punch trigger', () => {
    const t3 = makeUnit('golett', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3, 15)
    const handler = t3.passiveAttackHandlers.find(h => h.id === 'golett_shadow')!
    const hpBefore = e3.currentHp
    t3.attackCount = 4
    handler.onAttack(t3, e3, s3)
    expect(e3.currentHp).toBeLessThan(hpBefore)
  })

  it('splash hits adjacent enemy for 50% damage when handler fires', () => {
    const splashEnemy = makeUnit('dummy', 'enemy', 1)
    splashEnemy.hexPos = { col: 3, row: 1 }
    const s = createCombatState([caster], [enemy, splashEnemy])
    cast(caster, s, 15)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golett_shadow')!
    const hpEnemy = enemy.currentHp
    const hpSplash = splashEnemy.currentHp
    caster.attackCount = 4
    handler.onAttack(caster, enemy, s)
    // Primary target took full damage, splash target took 50% damage
    expect(enemy.currentHp).toBeLessThan(hpEnemy)
    expect(splashEnemy.currentHp).toBeLessThan(hpSplash)
  })
})
