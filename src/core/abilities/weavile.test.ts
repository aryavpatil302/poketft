import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
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

  it('sets attackTimer to 0 so attacks start immediately', () => {
    cast(caster, state)
    expect(caster.attackTimer).toBe(0)
  })

  it('applies suppressManaGain status effect to block mana gain', () => {
    cast(caster, state)
    const manaLock = caster.statusEffects.find(fx => fx.stackId === 'triple_axel_mana_lock')
    expect(manaLock).toBeDefined()
    expect(manaLock?.suppressManaGain).toBe(true)
  })

  it('modifier 1 (weavile_1) - physical bonus damage (tier 1 = 101)', () => {
    cast(caster, state)
    const mod1 = caster.attackModifiers.find(m => m.id === 'weavile_1')
    expect(mod1).toBeDefined()
    expect(mod1?.bonusDamage).toBe(101)
    expect(mod1?.bonusDamageType).toBe('physical')
    expect(mod1?.remainingCharges).toBe(1)
  })

  it('modifier 2 (weavile_2) - has onHit and followUpDelayTicks, no aoeRadius', () => {
    cast(caster, state)
    const mod2 = caster.attackModifiers.find(m => m.id === 'weavile_2')
    expect(mod2).toBeDefined()
    expect(mod2?.onHit).toBeDefined()
    expect(mod2?.followUpDelayTicks).toBeDefined()
    expect(mod2?.aoeRadius).toBeUndefined()
    expect(mod2?.remainingCharges).toBe(1)
  })

  it('modifier 2 onHit deals magic damage to enemies adjacent to Weavile', () => {
    // Place an enemy adjacent to caster (col=3,row=4 is hexDistance 1 from col=3,row=5)
    const adjEnemy = makeUnit('dummy', 'enemy', 1)
    adjEnemy.hexPos = { col: 3, row: 4 }
    const testState = createCombatState([caster], [adjEnemy])
    cast(caster, testState)
    const mod2 = caster.attackModifiers.find(m => m.id === 'weavile_2')
    testState.events = []
    mod2!.onHit!(caster, adjEnemy, testState)
    const dmgEvent = testState.events.find(e => e.type === 'damage')
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 150 raw magic * 100/(100+30) dummy spDefense = ~115
      expect(dmgEvent.amount).toBeGreaterThan(0)
      expect(dmgEvent.damageType).toBe('magic')
    }
  })

  it('modifier 2 onHit does NOT deal damage to enemies far from Weavile', () => {
    // enemy is at col=3,row=2 — 3+ hexes from caster at col=3,row=5
    cast(caster, state)
    const mod2 = caster.attackModifiers.find(m => m.id === 'weavile_2')
    state.events = []
    mod2!.onHit!(caster, enemy, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    expect(dmgEvent).toBeUndefined()
  })

  it('modifier 3 (weavile_3) - maxHP% true damage + knockUp', () => {
    cast(caster, state)
    const mod3 = caster.attackModifiers.find(m => m.id === 'weavile_3')
    expect(mod3).toBeDefined()
    expect(mod3?.maxHealthPercent).toBeCloseTo(0.10)
    expect(mod3?.knockUp).toBe(true)
    expect(mod3?.remainingCharges).toBe(1)
  })

  it('modifier 3 onHit removes the mana lock status effect', () => {
    cast(caster, state)
    expect(caster.statusEffects.some(fx => fx.stackId === 'triple_axel_mana_lock')).toBe(true)
    const mod3 = caster.attackModifiers.find(m => m.id === 'weavile_3')
    mod3!.onHit!(caster, enemy, state)
    expect(caster.statusEffects.some(fx => fx.stackId === 'triple_axel_mana_lock')).toBe(false)
  })

  it('tier 2 - modifier 1 has 226 bonus damage', () => {
    const t2 = makeUnit('weavile', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const mod1 = t2.attackModifiers.find(m => m.id === 'weavile_1')
    expect(mod1?.bonusDamage).toBe(226)
  })

  it('tier 3 - modifier 1 has 570 bonus damage', () => {
    const t3 = makeUnit('weavile', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const mod1 = t3.attackModifiers.find(m => m.id === 'weavile_1')
    expect(mod1?.bonusDamage).toBe(570)
  })

  it('tier 3 - modifier 3 has maxHealthPercent 0.15', () => {
    const t3 = makeUnit('weavile', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const mod3 = t3.attackModifiers.find(m => m.id === 'weavile_3')
    expect(mod3?.maxHealthPercent).toBeCloseTo(0.15)
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
