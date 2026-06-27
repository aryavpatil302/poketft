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

describe('Klawf - Anger Shell', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('klawf', 'player', 1)
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

  it('grants a permanent shield of 150 at tier 1', () => {
    cast(caster, state, 20)
    const shield = caster.shields.find(s => s.sourceAbility === 'klawf_anger_shell')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(150)
    expect(shield!.maxValue).toBe(150)
    expect(shield!.durationTicks).toBe(-1)
  })

  it('shield values are 150 / 225 / 350 at tiers 1 / 2 / 3', () => {
    for (const [tier, expected] of [[1, 150], [2, 225], [3, 350]] as const) {
      const k = makeUnit('klawf', 'player', tier as 1 | 2 | 3)
      k.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const s = createCombatState([k], [e])
      cast(k, s, 20)
      const shield = k.shields.find(sh => sh.sourceAbility === 'klawf_anger_shell')
      expect(shield!.value).toBe(expected)
    }
  })

  it('applies decaying atkSpd_buff status effect at tier 1 (magnitude 0.30, 4 sec)', () => {
    cast(caster, state, 20)
    const buff = caster.statusEffects.find(e => e.id === 'atkSpd_buff' && e.stackId === 'klawf_speed')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBeCloseTo(0.30)
    expect(buff!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('applies permanent flat attack (dmg_buff) of 20 at tier 1', () => {
    cast(caster, state, 20)
    const buff = caster.statusEffects.find(e => e.id === 'dmg_buff' && e.stackId === 'klawf_atkbuff')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBe(20)
    expect(buff!.durationTicks).toBe(-1)
  })

  it('leaps (state becomes leaping) when enemy is within 2 hexes', () => {
    cast(caster, state, 20)
    // After leap is started, caster state should be leaping (startLeap sets it)
    expect(caster.state).toBe('leaping')
  })

  it('emits a shield event with correct amount', () => {
    cast(caster, state, 20)
    const shieldEvt = state.events.find(e => e.type === 'shield' && e.unitId === caster.id)
    expect(shieldEvt).toBeDefined()
    if (shieldEvt?.type === 'shield') {
      expect(shieldEvt.amount).toBe(150)
    }
  })
})
