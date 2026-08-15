import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Drednaw - Razor Shell', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('drednaw', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // adjacent — melee empowered autos
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('adds a passive attack handler after cast', () => {
    cast(caster, state)
    expect(caster.passiveAttackHandlers).toHaveLength(1)
    expect(caster.passiveAttackHandlers[0].id).toContain('drednaw_slash')
    expect(caster.passiveAttackHandlers[0].suppressBaseAttack).toBe(true)
  })

  it('adds a razor shell active status effect lasting 5 seconds', () => {
    cast(caster, state)
    const active = caster.statusEffects.find(e => e.stackId === 'drednaw_razor_shell_active')
    expect(active).toBeDefined()
    expect(active!.durationTicks).toBe(5 * TICK_RATE)
    expect(active!.suppressManaGain).toBe(true)
  })

  it('grants an attack buff and fixed attack speed for the duration', () => {
    cast(caster, state)
    const dmgBuff = caster.statusEffects.find(e => e.stackId === 'drednaw_atk_buff')
    const spdSet  = caster.statusEffects.find(e => e.stackId === 'drednaw_atkspd_set')
    expect(dmgBuff).toBeDefined()
    expect(dmgBuff!.magnitude).toBe(20)  // tier 1
    expect(spdSet).toBeDefined()
    expect(spdSet!.magnitude).toBe(1)
  })

  it('handler deals piercing damage to the primary target', () => {
    cast(caster, state)
    const hpBefore = enemy.currentHp
    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('handler pierces through to the unit directly behind the target', () => {
    cast(caster, state)

    // caster (3,5) → enemy (3,4): the hex behind the target is (2,3)
    const behindEnemy = makeUnit('dummy', 'enemy', 1)
    behindEnemy.hexPos = { col: 2, row: 3 }
    state.units.set(behindEnemy.id, behindEnemy)
    state.hexOccupancy.set('2,3', behindEnemy.id)

    const hpBefore = behindEnemy.currentHp
    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)
    expect(behindEnemy.currentHp).toBeLessThan(hpBefore)
  })

  it('pierce does not hit allies behind the target', () => {
    cast(caster, state)

    const allyBehind = makeUnit('drednaw', 'player', 1)
    allyBehind.hexPos = { col: 2, row: 3 }
    state.units.set(allyBehind.id, allyBehind)
    state.hexOccupancy.set('2,3', allyBehind.id)

    const hpBefore = allyBehind.currentHp
    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)
    expect(allyBehind.currentHp).toBe(hpBefore)
  })

  it('handler removes itself when the active status expires', () => {
    cast(caster, state)
    const active = caster.statusEffects.find(e => e.stackId === 'drednaw_razor_shell_active')!

    // Fire onExpire manually
    if (active.onExpire) active.onExpire(caster, state)

    expect(caster.passiveAttackHandlers).toHaveLength(0)
  })

  it('handler self-removes if the active status is absent when it fires', () => {
    cast(caster, state)
    // Remove the status manually before calling the handler
    caster.statusEffects = caster.statusEffects.filter(e => e.stackId !== 'drednaw_razor_shell_active')

    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)

    expect(caster.passiveAttackHandlers).toHaveLength(0)
  })
})
