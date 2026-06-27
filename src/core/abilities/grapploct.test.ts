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

describe('Grapploct - Octolock', () => {
  let caster: Unit
  let enemy1: Unit
  let enemy2: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('grapploct', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy1 = makeUnit('dummy', 'enemy', 1)
    enemy1.hexPos = { col: 3, row: 2 }
    enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 3 }
    state = createCombatState([caster], [enemy1, enemy2])
  })

  it('enters casting state with 25-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(25)
  })

  it('applies stun status to nearest enemies (tier 1 hits 2 targets)', () => {
    cast(caster, state, 25)
    const stunnedTargets = [enemy1, enemy2].filter(e =>
      e.statusEffects.some(fx => fx.id === 'stun')
    )
    expect(stunnedTargets).toHaveLength(2)
  })

  it('stun duration is 1.5 seconds (90 ticks) at tier 1', () => {
    cast(caster, state, 25)
    const stun = enemy1.statusEffects.find(fx => fx.id === 'stun') ??
                 enemy2.statusEffects.find(fx => fx.id === 'stun')
    expect(stun).toBeDefined()
    expect(stun!.durationTicks).toBe(Math.round(1.5 * TICK_RATE))
  })

  it('deals physical damage to each target (HP decreases)', () => {
    const hp1Before = enemy1.currentHp
    const hp2Before = enemy2.currentHp
    cast(caster, state, 25)
    expect(enemy1.currentHp).toBeLessThan(hp1Before)
    expect(enemy2.currentHp).toBeLessThan(hp2Before)
  })

  it('adds a permanent dmg_buff (attack gain) to caster with no SpellBuff', () => {
    // atkGain at tier1, no spellBuff: round(attack * 0.05 * 1) = some positive value
    const attackBefore = caster.attack
    cast(caster, state, 25)
    // A dmg_buff status with permanent duration should be present
    const buff = caster.statusEffects.find(fx => fx.id === 'dmg_buff' && fx.durationTicks === -1)
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBeGreaterThan(0)
  })

  it('incrementSpellBuff runs and updates spellBuffCounters for beachy caster', () => {
    cast(caster, state, 25)
    // Grapploct is 'beachy'; counter should be 1 after one cast
    expect(state.spellBuffCounters.get(caster.id)).toBe(1)
  })

  it('attack gain scales with SpellBuff stacks', () => {
    // Pre-seed 10 stacks for larger observable difference
    state.spellBuffCounters.set(caster.id, 10)
    cast(caster, state, 25)
    const buff = caster.statusEffects.find(fx => fx.id === 'dmg_buff' && fx.durationTicks === -1)
    expect(buff).toBeDefined()
    // With 10 stacks: atkGain = round(attack * 0.05 * (1 + 10 * 0.05)) = round(attack * 0.075)
    const expectedGain = Math.round(caster.attack * 0.05 * (1 + 10 * 0.05))
    expect(buff!.magnitude).toBe(expectedGain)
  })
})
