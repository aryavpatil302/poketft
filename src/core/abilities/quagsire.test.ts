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

describe('Quagsire - Unaware', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('quagsire', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // within 2 hexes
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('grants a shield equal to shieldPer * enemyCount (1 enemy = 100 at tier 1)', () => {
    cast(caster, state, 20)
    const shield = caster.shields.find(s => s.sourceAbility === 'quagsire_unaware')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(100)
  })

  it('shield scales with number of enemies within 2 hexes', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 5 }  // within 2 hexes
    state.units.set(enemy2.id, enemy2)
    state.hexOccupancy.set('4,5', enemy2.id)

    cast(caster, state, 20)
    const shield = caster.shields.find(s => s.sourceAbility === 'quagsire_unaware')
    // 2 enemies × 100 = 200
    expect(shield!.value).toBe(200)
  })

  it('applies taunt to enemies within 1 hex', () => {
    // Move enemy to be within 1 hex of caster
    state.hexOccupancy.delete('3,4')
    enemy.hexPos = { col: 3, row: 4 }
    state.hexOccupancy.set('3,4', enemy.id)

    cast(caster, state, 20)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')
    expect(taunt).toBeDefined()
    expect(taunt!.durationTicks).toBe(2 * TICK_RATE)
  })

  it('does NOT apply taunt to enemy at distance > 1', () => {
    // Enemy is at col=3, row=4 which is distance 1 from caster at col=3, row=5
    // Move enemy further away
    state.hexOccupancy.delete('3,4')
    enemy.hexPos = { col: 3, row: 2 }
    state.hexOccupancy.set('3,2', enemy.id)

    cast(caster, state, 20)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')
    expect(taunt).toBeUndefined()
  })

  it('shield onExpire deals AoE damage to nearby enemies', () => {
    cast(caster, state, 20)
    const shield = caster.shields.find(s => s.sourceAbility === 'quagsire_unaware')!
    const hpBefore = enemy.currentHp

    if (shield.onExpire) shield.onExpire(caster)
    // enemy within 2 hexes should have taken AoE damage (150 tier 1 magic, may be reduced by defense)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('emits a shield event after cast', () => {
    cast(caster, state, 20)
    const shieldEvt = state.events.find(e => e.type === 'shield' && e.unitId === caster.id)
    expect(shieldEvt).toBeDefined()
  })
})
