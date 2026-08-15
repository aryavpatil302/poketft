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

describe('Gogoat - Grass Pelt', () => {
  let caster: Unit
  let ally: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('gogoat', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.currentHp = Math.floor(caster.maxHp / 2)  // damaged so heals are visible
    ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    ally.currentHp = Math.floor(ally.maxHp / 2)
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

  it('adds exactly 3 attack modifiers after cast', () => {
    cast(caster, state, 20)
    expect(caster.attackModifiers).toHaveLength(3)
  })

  it('each modifier has 1 charge, physical bonus damage of 50 (tier 1), and an onHit callback', () => {
    cast(caster, state, 20)
    for (const mod of caster.attackModifiers) {
      expect(mod.remainingCharges).toBe(1)
      expect(mod.bonusDamage).toBe(50)
      expect(mod.bonusDamageType).toBe('physical')
      expect(typeof mod.onHit).toBe('function')
    }
  })

  it('triggering the first modifier onHit heals the caster (self heal = 50)', () => {
    cast(caster, state, 20)
    const hpBefore = caster.currentHp
    const mod = caster.attackModifiers[0]
    if (mod.onHit) mod.onHit(caster, enemy, state)
    expect(caster.currentHp).toBeGreaterThan(hpBefore)
  })

  it('triggering modifier onHit adds the lunge animation status', () => {
    cast(caster, state, 20)
    const mod = caster.attackModifiers[0]
    if (mod.onHit) mod.onHit(caster, enemy, state)
    expect(caster.statusEffects.some(e => e.stackId === 'gogoat_lunge')).toBe(true)
  })

  it('all 3 modifier onHit callbacks heal the caster each time', () => {
    cast(caster, state, 20)
    const hpAfterCast = caster.currentHp
    let lastHp = hpAfterCast
    for (const mod of caster.attackModifiers) {
      if (mod.onHit) mod.onHit(caster, enemy, state)
      expect(caster.currentHp).toBeGreaterThanOrEqual(lastHp)
      lastHp = caster.currentHp
    }
  })

  it('bonus damage is 80 at tier 2 and 120 at tier 3', () => {
    for (const [tier, expectedDmg] of [[2, 80], [3, 120]] as const) {
      const g = makeUnit('gogoat', 'player', tier as 1 | 2 | 3)
      g.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 2 }
      const s = createCombatState([g], [e])
      cast(g, s, 20)
      expect(g.attackModifiers[0].bonusDamage).toBe(expectedDmg)
    }
  })
})
