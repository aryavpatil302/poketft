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

describe('Morgrem - Spirit Break', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('morgrem', 'player', 1)
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

  it('grants caster a shield of 120 at tier 1', () => {
    cast(caster, state, 20)
    const shield = caster.shields.find(s => s.sourceAbility === 'morgrem_spirit_break')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(120)
    expect(shield!.maxValue).toBe(120)
  })

  it('shield values are 120 / 180 / 280 at tiers 1 / 2 / 3', () => {
    for (const [tier, expected] of [[1, 120], [2, 180], [3, 280]] as const) {
      const m = makeUnit('morgrem', 'player', tier as 1 | 2 | 3)
      m.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 2 }
      const s = createCombatState([m], [e])
      cast(m, s, 20)
      const sh = m.shields.find(sh => sh.sourceAbility === 'morgrem_spirit_break')
      expect(sh!.value).toBe(expected)
    }
  })

  it('applies taunt status to nearest enemy lasting 4 seconds', () => {
    cast(caster, state, 20)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')
    expect(taunt).toBeDefined()
    expect(taunt!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('taunt tickEffect drains 5 mana per interval from the enemy', () => {
    enemy.currentMana = 50
    cast(caster, state, 20)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')!
    if (taunt.tickEffect) taunt.tickEffect(enemy, state)
    expect(enemy.currentMana).toBe(45)
  })

  it('mana does not drop below 0 from drain', () => {
    enemy.currentMana = 3
    cast(caster, state, 20)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')!
    if (taunt.tickEffect) taunt.tickEffect(enemy, state)
    expect(enemy.currentMana).toBe(0)
  })

  it('taunt onExpire deals burst magic damage to the nearest enemy of the caster', () => {
    cast(caster, state, 20)
    const taunt = enemy.statusEffects.find(fx => fx.id === 'taunt')!
    const hpBefore = enemy.currentHp
    if (taunt.onExpire) taunt.onExpire(enemy, state)
    // 150 magic damage (tier 1) should reduce enemy HP
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('emits a shield event with correct amount', () => {
    cast(caster, state, 20)
    const shieldEvt = state.events.find(e => e.type === 'shield' && e.unitId === caster.id)
    expect(shieldEvt).toBeDefined()
    if (shieldEvt?.type === 'shield') {
      expect(shieldEvt.amount).toBe(120)
    }
  })
})
