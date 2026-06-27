import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Pidgeotto - Wing Slap', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('pidgeotto', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast animation', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('adds exactly 2 attack modifiers (one per wing slap)', () => {
    cast(caster, state)
    expect(caster.attackModifiers).toHaveLength(2)
  })

  it('both modifiers have id pidgeotto_wing_slap', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].id).toBe('pidgeotto_wing_slap')
    expect(caster.attackModifiers[1].id).toBe('pidgeotto_wing_slap')
  })

  it('each modifier has 1 charge', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].remainingCharges).toBe(1)
    expect(caster.attackModifiers[1].remainingCharges).toBe(1)
  })

  it('first modifier swings CW (swingDir=1)', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].swingDir).toBe(1)
  })

  it('second modifier swings CCW (swingDir=-1)', () => {
    cast(caster, state)
    expect(caster.attackModifiers[1].swingDir).toBe(-1)
  })

  it('second modifier has instantFollowUp=true so it fires without cooldown', () => {
    cast(caster, state)
    expect(caster.attackModifiers[1].instantFollowUp).toBe(true)
  })

  it('first modifier does NOT have instantFollowUp', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].instantFollowUp).toBeFalsy()
  })

  it('onHit bonus adds physical damage when target is alive', () => {
    cast(caster, state)
    const hpBefore = enemy.currentHp
    caster.attackModifiers[0].onHit!(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('both modifiers have an onHit callback', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].onHit).toBeDefined()
    expect(caster.attackModifiers[1].onHit).toBeDefined()
  })

  it('tier 2 - pushes 2 modifiers after cast', () => {
    const t2 = makeUnit('pidgeotto', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    expect(t2.attackModifiers).toHaveLength(2)
  })

  it('tier 3 - pushes 2 modifiers after cast', () => {
    const t3 = makeUnit('pidgeotto', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    expect(t3.attackModifiers).toHaveLength(2)
  })
})
