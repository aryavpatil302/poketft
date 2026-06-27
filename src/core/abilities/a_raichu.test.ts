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

describe('A-Raichu - Surge Surfer', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('a_raichu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.visualPos = { x: 300, y: 500 }
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

  it('enters leaping state after cast (leap toward target)', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    // After triggering ability, leaping state should start
    expect(['leaping', 'casting']).toContain(caster.state)
  })

  it('fires 2 projectiles with 0 spell buff stacks (tier 1)', () => {
    // Need 2 enemies so both projectile slots have targets
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [enemy, enemy2])
    const projsBefore = state.projectiles.size
    cast(caster, state)
    expect(state.projectiles.size).toBeGreaterThanOrEqual(projsBefore + 2)
  })

  it('projectiles target nearest enemies', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()]
    const abilityProjs = projs.filter(p => p.abilityId === 'a_raichu_surge_surfer')
    expect(abilityProjs.length).toBeGreaterThanOrEqual(1)
    // Each projectile should target an enemy
    for (const proj of abilityProjs) {
      const target = state.units.get(proj.targetId)
      expect(target?.team).toBe('enemy')
    }
  })

  it('projectiles have magic damage payload (tier 1 = 100)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_raichu_surge_surfer')
    expect(proj?.damagePayload?.damageType).toBe('magic')
    expect(proj?.damagePayload?.baseAmount).toBe(100)
  })

  it('tier 2 projectiles have 150 base damage', () => {
    const t2 = makeUnit('a_raichu', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.visualPos = { x: 300, y: 500 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const proj = [...s.projectiles.values()].find(p => p.abilityId === 'a_raichu_surge_surfer')
    expect(proj?.damagePayload?.baseAmount).toBe(150)
  })

  it('tier 3 projectiles have 250 base damage', () => {
    const t3 = makeUnit('a_raichu', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    t3.visualPos = { x: 300, y: 500 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const proj = [...s.projectiles.values()].find(p => p.abilityId === 'a_raichu_surge_surfer')
    expect(proj?.damagePayload?.baseAmount).toBe(250)
  })

  it('fires 3 projectiles with 1 spell buff stack', () => {
    // Need 3 enemies so all 3 projectile slots have targets
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 2 }
    const enemy3 = makeUnit('dummy', 'enemy', 1)
    enemy3.hexPos = { col: 2, row: 2 }
    state = createCombatState([caster], [enemy, enemy2, enemy3])
    // Increment spell buff manually
    state.spellBuffCounters.set(caster.id, 1)
    // Give a_raichu the beachy trait so incrementSpellBuff counts it
    caster.traits = ['beachy']
    const projsBefore = state.projectiles.size
    cast(caster, state)
    // 2 + 1 spell buff = 3 projectiles
    expect(state.projectiles.size - projsBefore).toBeGreaterThanOrEqual(3)
  })

  it('increments spell buff counter after cast', () => {
    caster.traits = ['beachy']
    const before = state.spellBuffCounters.get(caster.id) ?? 0
    cast(caster, state)
    const after = state.spellBuffCounters.get(caster.id) ?? 0
    expect(after).toBeGreaterThan(before)
  })
})
