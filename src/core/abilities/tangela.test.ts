import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

function makeTestState(player: Unit, enemy: Unit): CombatState {
  player.hexPos = { col: 0, row: 3 }
  enemy.hexPos  = { col: 6, row: 0 }
  return createCombatState([player], [enemy])
}

describe('Tangela - Leaf Guard', () => {
  let tangela: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    tangela = makeUnit('tangela', 'player', 1)
    enemy   = makeUnit('vigoroth', 'enemy', 1)
    state   = makeTestState(tangela, enemy)
    tangela.currentMana = tangela.maxMana  // prime for cast
  })

  it('triggers ability when mana is full', () => {
    triggerAbility(tangela, state)
    expect(tangela.state).toBe('casting')
    expect(tangela.abilityCastTimer).toBe(1)  // TangelaAbility.castTimeTicks
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 and applies mana lock after cast animation completes', () => {
    triggerAbility(tangela, state)
    // Advance through cast animation
    for (let i = 0; i < 20 && tangela.state === 'casting'; i++) tickAbilityCast(tangela, state)
    expect(tangela.currentMana).toBe(0)
    expect(tangela.manaLockTimer).toBe(TICK_RATE)
    expect(tangela.state).toBe('idle')
  })

  it('applies shield on cast (tier 1 = 400)', () => {
    triggerAbility(tangela, state)
    for (let i = 0; i < 20 && tangela.state === 'casting'; i++) tickAbilityCast(tangela, state)
    expect(tangela.shields).toHaveLength(1)
    expect(tangela.shields[0].value).toBe(400)
    expect(tangela.shields[0].maxValue).toBe(400)
    expect(tangela.shields[0].durationTicks).toBe(4 * TICK_RATE)
  })

  it('applies shield value 525 at tier 2', () => {
    const t2 = makeUnit('tangela', 'player', 2)
    const s2 = makeTestState(t2, makeUnit('vigoroth', 'enemy', 1))
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s2)
    for (let i = 0; i < 20 && t2.state === 'casting'; i++) tickAbilityCast(t2, s2)
    expect(t2.shields[0].value).toBe(525)
  })

  it('applies shield value 685 at tier 3', () => {
    const t3 = makeUnit('tangela', 'player', 3)
    const s3 = makeTestState(t3, makeUnit('vigoroth', 'enemy', 1))
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s3)
    for (let i = 0; i < 20 && t3.state === 'casting'; i++) tickAbilityCast(t3, s3)
    expect(t3.shields[0].value).toBe(685)
  })

  it('emits a shield event with correct amount', () => {
    triggerAbility(tangela, state)
    for (let i = 0; i < 20 && tangela.state === 'casting'; i++) tickAbilityCast(tangela, state)
    const shieldEvt = state.events.find(e => e.type === 'shield')
    expect(shieldEvt).toBeDefined()
    if (shieldEvt?.type === 'shield') {
      expect(shieldEvt.amount).toBe(400)
    }
  })

  it('heals for 50% of remaining shield value when shield expires', () => {
    triggerAbility(tangela, state)
    for (let i = 0; i < 20 && tangela.state === 'casting'; i++) tickAbilityCast(tangela, state)

    const shield = tangela.shields[0]
    // Partially damage the shield
    shield.value = 200  // 200 remaining out of 400

    const hpBefore = tangela.currentHp
    // Fire the onExpire callback manually
    shield.durationTicks = 0
    if (shield.onExpire) shield.onExpire(tangela, shield)

    const expectedHeal = Math.floor(200 * 0.5)  // 100
    expect(tangela.currentHp).toBe(Math.min(tangela.maxHp, hpBefore + expectedHeal))
  })

  it('does not heal if shield was fully depleted on expire', () => {
    triggerAbility(tangela, state)
    for (let i = 0; i < 20 && tangela.state === 'casting'; i++) tickAbilityCast(tangela, state)

    const shield = tangela.shields[0]
    shield.value = 0  // fully broken

    const hpBefore = tangela.currentHp
    if (shield.onExpire) shield.onExpire(tangela, shield)
    expect(tangela.currentHp).toBe(hpBefore)  // no heal
  })
})
