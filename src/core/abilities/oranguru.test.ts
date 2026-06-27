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

describe('Oranguru - Stored Power', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('oranguru', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('adds a passive attack handler after cast', () => {
    cast(caster, state, 20)
    expect(caster.passiveAttackHandlers).toHaveLength(1)
    expect(caster.passiveAttackHandlers[0].id).toContain('oranguru_wave')
  })

  it('adds oranguru_instruct status effect lasting 5 seconds', () => {
    cast(caster, state, 20)
    const status = caster.statusEffects.find(e => e.id === 'oranguru_stored_power')
    expect(status).toBeDefined()
    expect(status!.durationTicks).toBe(5 * TICK_RATE)
    expect(status!.stackId).toBe('oranguru_stored_power')
  })

  it('handler deals magic damage to target on each call', () => {
    cast(caster, state, 20)
    const hpBefore = enemy.currentHp
    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('handler grants mana to caster on every 5th call (manaGain=15 at tier 1)', () => {
    cast(caster, state, 20)
    caster.currentMana = 0
    const handler = caster.passiveAttackHandlers[0]
    // Call 5 times; the 5th should trigger mana gain
    for (let i = 0; i < 5; i++) handler.onAttack(caster, enemy, state)
    expect(caster.currentMana).toBe(15)
  })

  it('handler does not grant mana on the 4th call (only on 5th)', () => {
    cast(caster, state, 20)
    caster.currentMana = 0
    const handler = caster.passiveAttackHandlers[0]
    for (let i = 0; i < 4; i++) handler.onAttack(caster, enemy, state)
    expect(caster.currentMana).toBe(0)
  })

  it('handler removes itself when instruct status expires', () => {
    cast(caster, state, 20)
    const status = caster.statusEffects.find(e => e.id === 'oranguru_stored_power')!
    if (status.onExpire) status.onExpire(caster, state)
    expect(caster.passiveAttackHandlers).toHaveLength(0)
  })
})
