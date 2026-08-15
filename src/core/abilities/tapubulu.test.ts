import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 30

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Tapu Bulu - Nature\'s Madness', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tapu_bulu','player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(30)
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

  it('doubles maxHp on cast', () => {
    const originalMax = caster.maxHp
    cast(caster, state)
    expect(caster.maxHp).toBe(originalMax * 2)
  })

  it('doubles currentHp on cast', () => {
    const originalHp = caster.currentHp
    cast(caster, state)
    expect(caster.currentHp).toBe(originalHp * 2)
  })

  it('applies permanent armorBuff (tier 1 = 30)', () => {
    cast(caster, state)
    const armor = caster.statusEffects.find(fx => fx.id === 'armorBuff' && fx.stackId === 'tapubulu_armor')
    expect(armor).toBeDefined()
    expect(armor?.magnitude).toBe(30)
    expect(armor?.durationTicks).toBe(-1)
  })

  it('applies permanent spDefBuff (tier 1 = 30)', () => {
    cast(caster, state)
    const spDef = caster.statusEffects.find(fx => fx.id === 'spDefBuff' && fx.stackId === 'tapubulu_spdef')
    expect(spDef).toBeDefined()
    expect(spDef?.magnitude).toBe(30)
    expect(spDef?.durationTicks).toBe(-1)
  })

  it('applies atkSpd_cap at 0.5', () => {
    cast(caster, state)
    const cap = caster.statusEffects.find(fx => fx.id === 'atkSpd_cap' && fx.stackId === 'tapubulu_atkspd_cap')
    expect(cap).toBeDefined()
    expect(cap?.magnitude).toBeCloseTo(0.5)
  })

  it('applies tapubulu_madness status carrying the 50% chunk magnitude', () => {
    cast(caster, state)
    const madness = caster.statusEffects.find(fx => fx.id === 'tapubulu_madness')
    expect(madness).toBeDefined()
    expect(madness?.magnitude).toBeCloseTo(0.5)
    expect(madness?.durationTicks).toBe(-1)
  })

  it('tier 2 - armorBuff and spDefBuff magnitude is 50', () => {
    const t2 = makeUnit('tapu_bulu','player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const armor = t2.statusEffects.find(fx => fx.id === 'armorBuff' && fx.stackId === 'tapubulu_armor')
    expect(armor?.magnitude).toBe(50)
  })

  it('only every 3rd strike chunks 50% of the target current HP (strikes 1 & 2 deal no bonus)', () => {
    cast(caster, state)
    enemy.maxHp = 1000
    enemy.currentHp = 1000
    const h = caster.passiveAttackHandlers.find(hh => hh.id === 'tapubulu_madness')!
    caster.attackCount = 1
    h.onAttack(caster, enemy, state)
    caster.attackCount = 2
    h.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBe(1000)   // no chunk on strikes 1 & 2
    caster.attackCount = 3
    h.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBe(500)    // 3rd strike removes 50% of current HP
  })

  it('3rd strike executes a target at or below 5% HP', () => {
    cast(caster, state)
    enemy.maxHp = 1000
    enemy.currentHp = 50   // exactly 5%
    const h = caster.passiveAttackHandlers.find(hh => hh.id === 'tapubulu_madness')!
    caster.attackCount = 3
    h.onAttack(caster, enemy, state)
    expect(enemy.state).toBe('dead')
  })

  it('emits a shield event (for the HP gain visual)', () => {
    cast(caster, state)
    const shieldEvent = state.events.find(e => e.type === 'shield' && e.unitId === caster.id)
    expect(shieldEvent).toBeDefined()
  })

  it('armor buffs reflect in computeStats', () => {
    const baseDef = caster.defense
    cast(caster, state)
    computeStats(caster)
    expect(caster._computedStats!.defense).toBeGreaterThan(baseDef)
  })
})
