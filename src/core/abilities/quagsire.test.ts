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

describe('Quagsire - Unaware', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('quagsire', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // adjacent — within both 1-hex and 2-hex range
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('grants 100 shield per enemy at tier 1 (1 enemy = 100)', () => {
    cast(caster, state)
    const shield = caster.shields.find(s => s.sourceAbility === 'quagsire_unaware')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(100)
  })

  it('shield scales with number of enemies within 2 hexes', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 5 }
    state.units.set(enemy2.id, enemy2)
    state.hexOccupancy.set('4,5', enemy2.id)

    cast(caster, state)
    const shield = caster.shields.find(s => s.sourceAbility === 'quagsire_unaware')
    expect(shield!.value).toBe(200)  // 2 enemies × 100
  })

  it('applies taunt for 4 seconds to enemies within 1 hex', () => {
    cast(caster, state)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')
    expect(taunt).toBeDefined()
    expect(taunt!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('does NOT apply taunt to enemy at distance > 1', () => {
    state.hexOccupancy.delete('3,4')
    enemy.hexPos = { col: 3, row: 2 }
    state.hexOccupancy.set('3,2', enemy.id)

    cast(caster, state)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')
    expect(taunt).toBeUndefined()
  })

  it('shield onExpire deals damage and chills enemies in 1-hex radius', () => {
    cast(caster, state)
    const shield = caster.shields.find(s => s.sourceAbility === 'quagsire_unaware')!
    const hpBefore = enemy.currentHp

    shield.onExpire!(caster, shield)

    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const chill = enemy.statusEffects.find(fx => fx.id === 'chill')
    expect(chill).toBeDefined()
    expect(chill!.magnitude).toBe(0.30)
  })

  it('emits a shield event and a pop vfx on expire', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'shield' && e.unitId === caster.id)).toBe(true)

    const shield = caster.shields.find(s => s.sourceAbility === 'quagsire_unaware')!
    shield.onExpire!(caster, shield)
    const popEv = state.events.find(e => e.type === 'vfx' && e.effectId === 'quagsire_shield_pop')
    expect(popEv).toBeDefined()
  })
})
