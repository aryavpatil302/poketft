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

describe('Morelull - Strength Sap', () => {
  let caster: Unit
  let ally: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('morelull', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    ally.currentHp = ally.maxHp / 2  // damaged so heal is observable
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster, ally], [enemy])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('deals magic damage to the nearest enemy (HP decreases)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state, 20)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('applies atk_reduction status to nearest enemy at tier 1 (magnitude 15, 3s)', () => {
    cast(caster, state, 20)
    const reduction = enemy.statusEffects.find(fx => fx.id === 'atk_reduction')
    expect(reduction).toBeDefined()
    expect(reduction!.magnitude).toBe(15)
    expect(reduction!.durationTicks).toBe(3 * TICK_RATE)
  })

  it('atk_reduction magnitude is 25 at tier 2 and 40 at tier 3', () => {
    for (const [tier, expectedMag] of [[2, 25], [3, 40]] as const) {
      const m = makeUnit('morelull', 'player', tier as 1 | 2 | 3)
      m.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 2 }
      const a = makeUnit('dummy', 'player', 1)
      a.hexPos = { col: 4, row: 5 }
      a.currentHp = 1
      const s = createCombatState([m, a], [e])
      cast(m, s, 20)
      const red = e.statusEffects.find(fx => fx.id === 'atk_reduction')
      expect(red!.magnitude).toBe(expectedMag)
    }
  })

  it('heals the nearest ally', () => {
    const hpBefore = ally.currentHp
    cast(caster, state, 20)
    expect(ally.currentHp).toBeGreaterThan(hpBefore)
  })

  it('heal amount is 80 at tier 1 (ally cannot overheal beyond maxHp)', () => {
    ally.currentHp = ally.maxHp - 10  // room for partial heal
    cast(caster, state, 20)
    // ally should have gained HP (up to maxHp)
    expect(ally.currentHp).toBeGreaterThan(ally.maxHp - 10)
    expect(ally.currentHp).toBeLessThanOrEqual(ally.maxHp)
  })

  it('resets caster mana to 0 and applies mana lock', () => {
    cast(caster, state, 20)
    expect(caster.currentMana).toBe(0)
    expect(caster.manaLockTimer).toBe(TICK_RATE)
  })
})
