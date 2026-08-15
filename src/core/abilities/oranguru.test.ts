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

  it('adds a permanent oranguru_stored_power status (suppresses mana gain)', () => {
    cast(caster, state, 20)
    const status = caster.statusEffects.find(e => e.id === 'oranguru_stored_power')
    expect(status).toBeDefined()
    expect(status!.durationTicks).toBe(-1)
    expect(status!.stackId).toBe('oranguru_stored_power')
    expect(status!.suppressManaGain).toBe(true)
  })

  it('handler fires a magic wave projectile at the target on each call', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'oranguru_stored_power')
    expect(proj).toBeDefined()
    expect(proj!.damagePayload?.damageType).toBe('magic')
    // tier 1: 80% of special (100) = 80 base damage
    expect(proj!.damagePayload?.baseAmount).toBe(80)
  })

  it('every 3rd wave grants permanent bonus special (tier 1 = +1) and empowered damage', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    for (let i = 0; i < 3; i++) handler.onAttack(caster, enemy, state)
    const buff = caster.statusEffects.find(e => e.stackId === 'oranguru_sp_buff')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBe(1)
    // 3rd wave is empowered: base 80 + 100 bonus (plus any special growth)
    const empProj = [...state.projectiles.values()].find(p => p.abilityId === 'oranguru_stored_power_emp')
    expect(empProj).toBeDefined()
    expect(empProj!.damagePayload!.baseAmount).toBeGreaterThanOrEqual(180)
  })

  it('does not grant the special buff before the 3rd wave', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    for (let i = 0; i < 2; i++) handler.onAttack(caster, enemy, state)
    expect(caster.statusEffects.some(e => e.stackId === 'oranguru_sp_buff')).toBe(false)
  })

  it('the stored power status is permanent (never expires)', () => {
    cast(caster, state, 20)
    const status = caster.statusEffects.find(e => e.id === 'oranguru_stored_power')!
    expect(status.durationTicks).toBe(-1)
    expect(status.onExpire).toBeUndefined()
  })

  it('every 3rd wave grants a 2-second attack speed buff scaled by special (tier 1: 20% at 100 special)', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    for (let i = 0; i < 3; i++) handler.onAttack(caster, enemy, state)
    const buff = caster.statusEffects.find(e => e.stackId === 'oranguru_wave_atkspd')
    expect(buff).toBeDefined()
    expect(buff!.id).toBe('atkSpd_buff')
    expect(buff!.durationTicks).toBe(2 * TICK_RATE)
    // special is 100 at this point (pre-gain snapshot from computeStats at the 3rd wave) → full 20%
    expect(buff!.magnitude).toBeCloseTo(0.20, 5)
  })

  it('does not grant the attack speed buff before the 3rd wave', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    for (let i = 0; i < 2; i++) handler.onAttack(caster, enemy, state)
    expect(caster.statusEffects.some(e => e.stackId === 'oranguru_wave_atkspd')).toBe(false)
  })

  it('a later empowered wave scales the attack speed bonus up with the special gained from earlier procs', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    for (let i = 0; i < 3; i++) handler.onAttack(caster, enemy, state)
    const first = caster.statusEffects.find(e => e.stackId === 'oranguru_wave_atkspd')!.magnitude!
    for (let i = 0; i < 3; i++) handler.onAttack(caster, enemy, state)   // waves 4-6, 6th is empowered again
    const second = caster.statusEffects.find(e => e.stackId === 'oranguru_wave_atkspd')!.magnitude!
    expect(second).toBeGreaterThan(first)
  })

  it('refreshes (does not stack) on repeated empowered waves — one entry, duration reset', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    for (let i = 0; i < 9; i++) handler.onAttack(caster, enemy, state)
    const buffs = caster.statusEffects.filter(e => e.stackId === 'oranguru_wave_atkspd')
    expect(buffs).toHaveLength(1)
    expect(buffs[0].durationTicks).toBe(2 * TICK_RATE)
  })
})
