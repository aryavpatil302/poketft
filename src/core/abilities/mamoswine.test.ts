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

describe('Mamoswine - Thick Fat', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('mamoswine', 'player', 1)
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

  it('applies armorBuff status effect on self (tier 1 = 40)', () => {
    cast(caster, state)
    const armor = caster.statusEffects.find(fx => fx.id === 'armorBuff' && fx.stackId === 'mamo_armor')
    expect(armor).toBeDefined()
    expect(armor?.magnitude).toBe(40)
  })

  it('armorBuff lasts 5 seconds (5 * TICK_RATE)', () => {
    cast(caster, state)
    const armor = caster.statusEffects.find(fx => fx.id === 'armorBuff' && fx.stackId === 'mamo_armor')
    expect(armor?.durationTicks).toBe(5 * TICK_RATE)
  })

  it('applies spDefBuff status effect on self (tier 1 = 40)', () => {
    cast(caster, state)
    const spDef = caster.statusEffects.find(fx => fx.id === 'spDefBuff' && fx.stackId === 'mamo_spdef')
    expect(spDef).toBeDefined()
    expect(spDef?.magnitude).toBe(40)
  })

  it('spDefBuff lasts 5 seconds (5 * TICK_RATE)', () => {
    cast(caster, state)
    const spDef = caster.statusEffects.find(fx => fx.id === 'spDefBuff' && fx.stackId === 'mamo_spdef')
    expect(spDef?.durationTicks).toBe(5 * TICK_RATE)
  })

  it('tier 2 - armorBuff has magnitude 60', () => {
    const t2 = makeUnit('mamoswine', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const armor = t2.statusEffects.find(fx => fx.id === 'armorBuff' && fx.stackId === 'mamo_armor')
    expect(armor?.magnitude).toBe(60)
  })

  it('tier 3 - armorBuff has magnitude 100', () => {
    const t3 = makeUnit('mamoswine', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const armor = t3.statusEffects.find(fx => fx.id === 'armorBuff' && fx.stackId === 'mamo_armor')
    expect(armor?.magnitude).toBe(100)
  })

  it('adds a passive attack handler after cast', () => {
    cast(caster, state)
    const handlerCount = caster.passiveAttackHandlers.length
    expect(handlerCount).toBeGreaterThan(0)
  })

  it('passive handler deals magic damage equal to defense+spDefense while buff is active', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers[caster.passiveAttackHandlers.length - 1]
    expect(handler).toBeDefined()

    // Set computed stats so damage can be calculated
    caster._computedStats = {
      maxHp: caster.maxHp,
      attack: caster.attack,
      special: caster.special,
      defense: 50,
      spDefense: 30,
      attackSpeed: caster.attackSpeed,
      critChance: caster.critChance,
      critDamage: caster.critDamage,
      range: caster.range,
      moveSpeed: caster.moveSpeed,
    }

    state.events = []
    handler.onAttack(caster, enemy, state)

    // 80 raw (50 defense + 30 spDefense), then mitigated by dummy spDefense=30: 80 * 100/130 = 62
    const dmgEvent = state.events.find(e => e.type === 'damage')
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('magic')
      expect(dmgEvent.amount).toBe(62)
    }
  })

  it('passive handler self-removes when armorBuff expires', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers[caster.passiveAttackHandlers.length - 1]

    // Remove the armor buff to simulate expiry
    caster.statusEffects = caster.statusEffects.filter(fx => fx.stackId !== 'mamo_armor')

    handler.onAttack(caster, enemy, state)

    // Handler should be removed from the list
    expect(caster.passiveAttackHandlers).not.toContain(handler)
  })
})
