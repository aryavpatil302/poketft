import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks: number): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Barraskewda - Fishous Rend', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('barraskewda', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // within 2 hexes
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 15-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(15)
  })

  it('deals physical damage to the target (enemy HP decreases)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state, 15)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('reduces target maxMana by 10 on first cast', () => {
    const manaBefore = enemy.maxMana
    cast(caster, state, 15)
    expect(enemy.maxMana).toBe(manaBefore - 10)
  })

  it('leaps to adjacent hex (state becomes leaping)', () => {
    cast(caster, state, 15)
    expect(caster.state).toBe('leaping')
  })

  it('reduces maxMana again on second cast (cumulative)', () => {
    const manaBefore = enemy.maxMana
    cast(caster, state, 15)
    cast(caster, state, 15)
    expect(enemy.maxMana).toBe(manaBefore - 20)
  })

  it('does not reduce maxMana below 30 (floor)', () => {
    enemy.maxMana = 35
    cast(caster, state, 15)
    expect(enemy.maxMana).toBe(30)
    // Second cast must not push below floor
    cast(caster, state, 15)
    expect(enemy.maxMana).toBe(30)
  })

  it('clamps currentMana to new maxMana after reduction', () => {
    enemy.maxMana = 50
    enemy.currentMana = 50
    cast(caster, state, 15)
    // maxMana becomes 40; currentMana should be clamped
    expect(enemy.currentMana).toBeLessThanOrEqual(enemy.maxMana)
  })

  it('resets caster mana to 0 and applies mana lock', () => {
    cast(caster, state, 15)
    expect(caster.currentMana).toBe(0)
    expect(caster.manaLockTimer).toBe(TICK_RATE)
  })
})
