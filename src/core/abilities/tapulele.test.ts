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

describe("Tapu Lele - Nature's Madness", () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tapu_lele', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    // Place enemy within 4 hexes
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 120-tick timer (2-second charge-up)', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(120)
  })

  it('does NOT fire until cast is complete (enemy HP unchanged mid-cast)', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    const hpBefore = enemy.currentHp
    // Tick halfway through cast
    for (let i = 0; i < 60; i++) tickAbilityCast(caster, state)
    expect(enemy.currentHp).toBe(hpBefore)
  })

  it('deals magic damage to enemies within 4 hexes after full cast (enemy HP decreases)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state, 120)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('does not damage allies', () => {
    const ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 3, row: 4 }
    state.units.set(ally.id, ally)
    state.hexOccupancy.set('3,4', ally.id)
    const allyHpBefore = ally.currentHp
    cast(caster, state, 120)
    expect(ally.currentHp).toBe(allyHpBefore)
  })

  it('sets psychic terrain to true after cast', () => {
    expect(state.terrain.psychic).toBe(false)
    cast(caster, state, 120)
    expect(state.terrain.psychic).toBe(true)
  })

  it('with psychic terrain active, applies true damage (bypasses MR)', () => {
    // Give enemy high spDefense so the difference between magic and true is measurable
    enemy.spDefense = 100
    const hpBeforeNormal = enemy.currentHp

    // Cast once without terrain - magic damage
    cast(caster, state, 120)
    const hpAfterMagic = enemy.currentHp
    const magicDamage = hpBeforeNormal - hpAfterMagic

    // Now reset and cast with psychic terrain
    const caster2 = makeUnit('tapu_lele', 'player', 1)
    caster2.hexPos = { col: 3, row: 5 }
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 3, row: 2 }
    enemy2.spDefense = 100
    const state2 = createCombatState([caster2], [enemy2])
    state2.terrain.psychic = true
    const hpBefore2 = enemy2.currentHp
    cast(caster2, state2, 120)
    const trueDamage = hpBefore2 - enemy2.currentHp

    // True damage should be >= magic damage because it ignores MR
    expect(trueDamage).toBeGreaterThanOrEqual(magicDamage)
  })

  it('resets caster mana to 0 and applies mana lock after full cast', () => {
    cast(caster, state, 120)
    expect(caster.currentMana).toBe(0)
    expect(caster.manaLockTimer).toBe(TICK_RATE)
  })
})
