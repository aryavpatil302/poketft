import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Wheezing - Poison Gas', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('wheezing', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast animation', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('tier 1 - creates a persistent AoE zone', () => {
    cast(caster, state)
    expect(state.persistentAoEZones.length).toBeGreaterThan(0)
  })

  it('tier 1 - zone has correct damage per interval (40)', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.damagePerInterval).toBe(40)
  })

  it('tier 2 - zone has correct damage per interval (60)', () => {
    const t2 = makeUnit('wheezing', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)
    expect(s.persistentAoEZones[0].damagePerInterval).toBe(60)
  })

  it('tier 3 - zone has correct damage per interval (100)', () => {
    const t3 = makeUnit('wheezing', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)
    expect(s.persistentAoEZones[0].damagePerInterval).toBe(100)
  })

  it('zone is centered on the caster hex', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.center).toEqual(caster.hexPos)
  })

  it('zone has radius 2', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.radius).toBe(2)
  })

  it('zone targets the enemy team', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.targetTeam).toBe('enemy')
  })

  it('zone has magic damage type', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.damageType).toBe('magic')
  })

  it('tier 1 - zone duration is 6 seconds', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.durationTicks).toBe(6 * TICK_RATE)
  })

  it('tier 2 - zone duration is 7 seconds', () => {
    const t2 = makeUnit('wheezing', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)
    expect(s.persistentAoEZones[0].durationTicks).toBe(7 * TICK_RATE)
  })

  it('tier 3 - zone duration is 8 seconds', () => {
    const t3 = makeUnit('wheezing', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)
    expect(s.persistentAoEZones[0].durationTicks).toBe(8 * TICK_RATE)
  })

  it('zone applies armor and sp defense reduction', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.armorReduction).toBe(10)
    expect(zone.spDefReduction).toBe(10)
  })

  it('zone fires every 30 ticks', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.intervalTicks).toBe(30)
  })

  it('wheezing gains wheezing_stack status effect for self-buff', () => {
    cast(caster, state)
    const stack = caster.statusEffects.find(e => e.id === 'wheezing_stack')
    expect(stack).toBeDefined()
  })

  it('tier 1 - wheezing_stack tick effect increases defense and spDefense by 8', () => {
    cast(caster, state)
    const stack = caster.statusEffects.find(e => e.id === 'wheezing_stack')
    expect(stack?.tickEffect).toBeDefined()

    const defenseBefore = caster.defense
    const spDefBefore = caster.spDefense
    stack!.tickEffect!(caster, state)

    expect(caster.defense).toBe(defenseBefore + 8)
    expect(caster.spDefense).toBe(spDefBefore + 8)
  })

  it('tier 2 - wheezing_stack tick effect increases defense by 12', () => {
    const t2 = makeUnit('wheezing', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)

    const stack = t2.statusEffects.find(fx => fx.id === 'wheezing_stack')
    const defBefore = t2.defense
    stack!.tickEffect!(t2, s)
    expect(t2.defense).toBe(defBefore + 12)
  })

  it('tier 3 - wheezing_stack tick effect increases defense by 20', () => {
    const t3 = makeUnit('wheezing', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)

    const stack = t3.statusEffects.find(fx => fx.id === 'wheezing_stack')
    const defBefore = t3.defense
    stack!.tickEffect!(t3, s)
    expect(t3.defense).toBe(defBefore + 20)
  })

  it('invalidates computed stats after tick effect fires', () => {
    cast(caster, state)
    const stack = caster.statusEffects.find(e => e.id === 'wheezing_stack')
    caster._computedStats = { maxHp: 100, attack: 10, special: 10, defense: 10, spDefense: 10, attackSpeed: 1, critChance: 0.1, critDamage: 1.4, range: 1, moveSpeed: 1.5, omnivamp: 0 }
    stack!.tickEffect!(caster, state)
    expect(caster._computedStats).toBeNull()
  })
})
