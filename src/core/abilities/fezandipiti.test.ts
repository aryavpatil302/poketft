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

describe('Fezandipiti - Toxic Chain', () => {
  let caster: Unit
  let enemy1: Unit
  let enemy2: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('fezandipiti', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy1 = makeUnit('dummy', 'enemy', 1)
    enemy1.hexPos = { col: 3, row: 2 }
    enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 3 }
    state = createCombatState([caster], [enemy1, enemy2])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('applies poison status to each of the 2 nearest enemies (tier 1)', () => {
    cast(caster, state, 20)
    expect(enemy1.statusEffects.some(fx => fx.id === 'poison')).toBe(true)
    expect(enemy2.statusEffects.some(fx => fx.id === 'poison')).toBe(true)
  })

  it('poison status lasts 4 seconds (240 ticks)', () => {
    cast(caster, state, 20)
    const poison = enemy1.statusEffects.find(fx => fx.id === 'poison')!
    expect(poison.durationTicks).toBe(4 * TICK_RATE)
  })

  it('poison tickEffect deals damage and doubles each tick', () => {
    cast(caster, state, 20)
    const poison = enemy1.statusEffects.find(fx => fx.id === 'poison')!
    const hpBefore = enemy1.currentHp

    // First tick: 50 damage
    if (poison.tickEffect) poison.tickEffect(enemy1, state)
    const hpAfterFirst = enemy1.currentHp
    expect(hpAfterFirst).toBeLessThan(hpBefore)

    // Second tick: 100 damage (doubled)
    if (poison.tickEffect) poison.tickEffect(enemy1, state)
    const hpAfterSecond = enemy1.currentHp
    // The second tick should remove more HP than the first
    expect(hpBefore - hpAfterFirst).toBeLessThan(hpAfterFirst - hpAfterSecond)
  })

  it('poison onExpire stuns the target for 1.5 seconds', () => {
    cast(caster, state, 20)
    const poison = enemy1.statusEffects.find(fx => fx.id === 'poison')!
    if (poison.onExpire) poison.onExpire(enemy1, state)
    const stun = enemy1.statusEffects.find(fx => fx.id === 'stun')
    expect(stun).toBeDefined()
    expect(stun!.durationTicks).toBe(Math.round(1.5 * TICK_RATE))
  })

  it('increases caster maxHp and currentHp by hpBonus (150 at tier 1)', () => {
    const maxHpBefore = caster.maxHp
    const currentHpBefore = caster.currentHp
    cast(caster, state, 20)
    expect(caster.maxHp).toBe(maxHpBefore + 150)
    expect(caster.currentHp).toBe(currentHpBefore + 150)
  })

  it('adds armorBuff status to caster after cast', () => {
    cast(caster, state, 20)
    const buff = caster.statusEffects.find(fx => fx.id === 'armorBuff' && fx.stackId === 'fez_armorBuff')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBeCloseTo(150 / 10)  // 15
    expect(buff!.durationTicks).toBe(4 * TICK_RATE)
  })
})
