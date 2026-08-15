import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 12

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Klawf - Anger Shell', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('klawf', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 12-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('applies an attack speed buff lasting 4 seconds (tier 1 = +0.50)', () => {
    cast(caster, state)
    const buff = caster.statusEffects.find(e => e.stackId === 'klawf_speed')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBe(0.50)
    expect(buff!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('attack speed buff scales by tier (0.50 / 0.75 / 1.00)', () => {
    const expected = [0.50, 0.75, 1.00] as const
    for (const tier of [1, 2, 3] as const) {
      const u = makeUnit('klawf', 'player', tier)
      u.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const s = createCombatState([u], [e])
      cast(u, s)
      const buff = u.statusEffects.find(fx => fx.stackId === 'klawf_speed')
      expect(buff?.magnitude).toBe(expected[tier - 1])
    }
  })

  it('applies a +50% crit chance buff lasting 4 seconds', () => {
    cast(caster, state)
    const buff = caster.statusEffects.find(e => e.stackId === 'klawf_crit')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBe(0.50)
    expect(buff!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })
})
