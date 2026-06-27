import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Weavile - Triple Axel', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('weavile', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('adds exactly 3 attack modifiers', () => {
    cast(caster, state)
    const weavileMods = caster.attackModifiers.filter(m =>
      m.id === 'weavile_1' || m.id === 'weavile_2' || m.id === 'weavile_3'
    )
    expect(weavileMods).toHaveLength(3)
  })

  it('modifier 1 (weavile_1) - physical bonus damage (tier 1 = 100)', () => {
    cast(caster, state)
    const mod1 = caster.attackModifiers.find(m => m.id === 'weavile_1')
    expect(mod1).toBeDefined()
    expect(mod1?.bonusDamage).toBe(100)
    expect(mod1?.bonusDamageType).toBe('physical')
    expect(mod1?.remainingCharges).toBe(1)
  })

  it('modifier 2 (weavile_2) - AoE magic spin with onHit', () => {
    cast(caster, state)
    const mod2 = caster.attackModifiers.find(m => m.id === 'weavile_2')
    expect(mod2).toBeDefined()
    expect(mod2?.aoeRadius).toBe(1)
    expect(mod2?.bonusDamageType).toBe('magic')
    expect(mod2?.onHit).toBeDefined()
    expect(mod2?.remainingCharges).toBe(1)
  })

  it('modifier 2 onHit deals magic AoE damage (62 after mitigation, 80 raw)', () => {
    cast(caster, state)
    const mod2 = caster.attackModifiers.find(m => m.id === 'weavile_2')
    state.events = []
    mod2!.onHit!(caster, enemy, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 80 raw * 100/130 (dummy spDefense=30) = 62
      expect(dmgEvent.amount).toBe(62)
      expect(dmgEvent.damageType).toBe('magic')
    }
  })

  it('modifier 3 (weavile_3) - maxHP% damage + knockUp', () => {
    cast(caster, state)
    const mod3 = caster.attackModifiers.find(m => m.id === 'weavile_3')
    expect(mod3).toBeDefined()
    expect(mod3?.maxHealthPercent).toBeCloseTo(0.06)
    expect(mod3?.knockUp).toBe(true)
    expect(mod3?.remainingCharges).toBe(1)
  })

  it('tier 2 - modifier 1 has 150 bonus damage', () => {
    const t2 = makeUnit('weavile', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const mod1 = t2.attackModifiers.find(m => m.id === 'weavile_1')
    expect(mod1?.bonusDamage).toBe(150)
  })

  it('tier 3 - modifier 1 has 250 bonus damage', () => {
    const t3 = makeUnit('weavile', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const mod1 = t3.attackModifiers.find(m => m.id === 'weavile_1')
    expect(mod1?.bonusDamage).toBe(250)
  })

  it('tier 3 - modifier 3 has maxHealthPercent 0.12', () => {
    const t3 = makeUnit('weavile', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const mod3 = t3.attackModifiers.find(m => m.id === 'weavile_3')
    expect(mod3?.maxHealthPercent).toBeCloseTo(0.12)
  })

  it('all modifiers have exactly 1 remaining charge', () => {
    cast(caster, state)
    const mods = caster.attackModifiers.filter(m =>
      ['weavile_1', 'weavile_2', 'weavile_3'].includes(m.id)
    )
    for (const mod of mods) {
      expect(mod.remainingCharges).toBe(1)
    }
  })
})
