import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  tickAbilityCast(caster, state)
}

function gravelerShield(unit: Unit) {
  return unit.shields.find(s => s.sourceAbility === 'graveler_iron_defense')
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

  it('applies a shield of base + 10% max HP at tier 1', () => {
    cast(caster, state)
    const shield = gravelerShield(caster)
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(200 + Math.round(caster.maxHp * 0.10))
  })

  it('tier 2 shield is 350 + 20% max HP', () => {
    const t2 = makeUnit('graveler', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const shield = gravelerShield(t2)
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(350 + Math.round(t2.maxHp * 0.20))
  })

  it('tier 3 shield is 500 + 30% max HP', () => {
    const t3 = makeUnit('graveler', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const shield = gravelerShield(t3)
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(500 + Math.round(t3.maxHp * 0.30))
  })

  it('shield has no expiry timer (lasts until broken)', () => {
    cast(caster, state)
    expect(gravelerShield(caster)!.durationTicks).toBe(-1)
  })

  it('does not stack a second shield on re-cast', () => {
    cast(caster, state)
    cast(caster, state)
    const shields = caster.shields.filter(s => s.sourceAbility === 'graveler_iron_defense')
    expect(shields).toHaveLength(1)
  })

  it('onExpire permanently increases caster armor by 10 at tier 1', () => {
    cast(caster, state)
    const defBefore = caster.defense
    const shield = gravelerShield(caster)!
    shield.onExpire!(caster, shield)
    expect(caster.defense).toBe(defBefore + 10)
  })

  it('onExpire grants 20 armor at tier 2', () => {
    const t2 = makeUnit('graveler', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const defBefore = t2.defense
    const shield = gravelerShield(t2)!
    shield.onExpire!(t2, shield)
    expect(t2.defense).toBe(defBefore + 20)
  })

  it('onExpire grants 50 armor at tier 3', () => {
    const t3 = makeUnit('graveler', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const defBefore = t3.defense
    const shield = gravelerShield(t3)!
    shield.onExpire!(t3, shield)
    expect(t3.defense).toBe(defBefore + 50)
  })
})
