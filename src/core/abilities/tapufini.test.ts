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

describe("Tapu Fini - Nature's Madness", () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tapu_fini', 'player', 1)
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

  it('creates exactly one persistent AoE zone on a normal cast', () => {
    cast(caster, state, 20)
    expect(state.persistentAoEZones).toHaveLength(1)
  })

  it('zone has correct properties at tier 1', () => {
    cast(caster, state, 20)
    const zone = state.persistentAoEZones[0]
    expect(zone.damagePerInterval).toBe(60)
    expect(zone.radius).toBe(1)
    expect(zone.durationTicks).toBe(5 * TICK_RATE)
    expect(zone.intervalTicks).toBe(TICK_RATE)
    expect(zone.damageType).toBe('magic')
    expect(zone.targetTeam).toBe('enemy')
    expect(zone.armorReduction).toBe(20)
    expect(zone.spDefReduction).toBe(20)
  })

  it('zone duration is 6s at tier 2 and 7s at tier 3', () => {
    for (const [tier, expectedSec] of [[2, 6], [3, 7]] as const) {
      const tf = makeUnit('tapu_fini', 'player', tier as 1 | 2 | 3)
      tf.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 2 }
      const s = createCombatState([tf], [e])
      cast(tf, s, 20)
      expect(s.persistentAoEZones[0].durationTicks).toBe(expectedSec * TICK_RATE)
    }
  })

  it('creates TWO zones when misty terrain is active before cast', () => {
    state.terrain.misty = true
    cast(caster, state, 20)
    expect(state.persistentAoEZones).toHaveLength(2)
  })

  it('sets misty terrain to true after cast', () => {
    expect(state.terrain.misty).toBe(false)
    cast(caster, state, 20)
    expect(state.terrain.misty).toBe(true)
  })

  it('zone is centered on the nearest enemy (not on caster)', () => {
    cast(caster, state, 20)
    const zone = state.persistentAoEZones[0]
    // Zone center should match the enemy hex position
    expect(zone.center).toEqual(enemy.hexPos)
  })
})
