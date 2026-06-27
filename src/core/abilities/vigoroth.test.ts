import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { hexDistance } from '../hexGrid'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

function makeTestState(player: Unit, enemy: Unit): CombatState {
  player.hexPos = { col: 0, row: 3 }
  enemy.hexPos  = { col: 6, row: 0 }
  return createCombatState([player], [enemy])
}

describe('Vigoroth - Fury Swipes', () => {
  let vigoroth: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    vigoroth = makeUnit('vigoroth', 'player', 1)
    enemy    = makeUnit('tangela', 'enemy', 1)
    state    = makeTestState(vigoroth, enemy)
    vigoroth.currentMana = vigoroth.maxMana
    vigoroth.targetId = enemy.id
  })

  it('triggers ability cast animation', () => {
    triggerAbility(vigoroth, state)
    expect(vigoroth.state).toBe('casting')
    expect(vigoroth.abilityCastTimer).toBe(15)  // VigorothAbility.castTimeTicks
  })

  it('resets mana to 0 after cast', () => {
    triggerAbility(vigoroth, state)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, state)
    expect(vigoroth.currentMana).toBe(0)
  })

  it('applies a shield on cast (tier 1 = 75)', () => {
    triggerAbility(vigoroth, state)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, state)
    expect(vigoroth.shields).toHaveLength(1)
    expect(vigoroth.shields[0].value).toBe(75)
    expect(vigoroth.shields[0].durationTicks).toBe(-1)  // lasts until broken
  })

  it('shield values: tier 1=75, tier 2=100, tier 3=150', () => {
    for (const [tier, expected] of [[1, 75], [2, 100], [3, 150]] as const) {
      const v = makeUnit('vigoroth', 'player', tier as 1 | 2 | 3)
      const e = makeUnit('tangela', 'enemy', 1)
      const s = makeTestState(v, e)
      v.currentMana = v.maxMana
      v.targetId = e.id
      triggerAbility(v, s)
      for (let i = 0; i < 15; i++) tickAbilityCast(v, s)
      expect(v.shields[0].value).toBe(expected)
    }
  })

  it('applies atkSpd_buff status effect', () => {
    triggerAbility(vigoroth, state)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, state)
    const buff = vigoroth.statusEffects.find(e => e.id === 'atkSpd_buff')
    expect(buff).toBeDefined()
    expect(buff?.magnitude).toBeCloseTo(0.20)  // tier 1 = 20%
    expect(buff?.durationTicks).toBe(-1)        // permanent until shield breaks
  })

  it('applies dmg_buff status effect (tier 1 = +50 flat attack)', () => {
    triggerAbility(vigoroth, state)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, state)
    const buff = vigoroth.statusEffects.find(e => e.id === 'dmg_buff')
    expect(buff).toBeDefined()
    expect(buff?.magnitude).toBe(50)
  })

  it('atkSpd buff reflects in computeStats', () => {
    const baseAs = vigoroth.attackSpeed
    triggerAbility(vigoroth, state)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, state)
    computeStats(vigoroth)
    expect(vigoroth._computedStats!.attackSpeed).toBeCloseTo(baseAs + baseAs * 0.20)
  })

  it('dmg_buff reflects in computeStats', () => {
    const baseAtk = vigoroth.attack
    triggerAbility(vigoroth, state)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, state)
    computeStats(vigoroth)
    expect(vigoroth._computedStats!.attack).toBe(baseAtk + 50)
  })

  it('removing the shield via onExpire removes both buffs', () => {
    triggerAbility(vigoroth, state)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, state)

    const shield = vigoroth.shields[0]
    if (shield.onExpire) shield.onExpire(vigoroth, shield)

    expect(vigoroth.statusEffects.find(e => e.id === 'atkSpd_buff')).toBeUndefined()
    expect(vigoroth.statusEffects.find(e => e.id === 'dmg_buff')).toBeUndefined()
  })

  it('enters leaping state when enemy is within 4 hexes', () => {
    // Place Vigoroth within leap range of enemy
    vigoroth.hexPos = { col: 3, row: 3 }
    enemy.hexPos    = { col: 3, row: 1 }
    const s = createCombatState([vigoroth], [enemy])
    vigoroth.currentMana = vigoroth.maxMana
    vigoroth.targetId = enemy.id
    triggerAbility(vigoroth, s)
    for (let i = 0; i < 15; i++) tickAbilityCast(vigoroth, s)

    // hexPos updates only after tickLeapPixel completes in the combat loop;
    // right after cast we just confirm the leap was initiated
    expect(vigoroth.state).toBe('leaping')
    expect(vigoroth.targetId).toBe(enemy.id)
  })
})
