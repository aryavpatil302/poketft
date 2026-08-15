import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickProjectiles } from '../projectile'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function resolveProjectiles(state: CombatState, maxTicks = 500): void {
  for (let i = 0; i < maxTicks && state.projectiles.size > 0; i++) {
    tickProjectiles(state)
  }
}

describe('Venusaur - Leech Seed', () => {
  let caster: Unit
  let e1: Unit
  let e2: Unit
  let e3: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('venusaur', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // All enemies within the 2-hex seed range
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 4 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 4 }
    e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 4, row: 4 }
    state = createCombatState([caster], [e1, e2, e3])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
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

  it('tier 1 - seeds 2 nearest enemies within 2 hexes (via projectiles)', () => {
    cast(caster, state)
    resolveProjectiles(state)
    const seeded = [e1, e2, e3].filter(e =>
      e.statusEffects.some(fx => fx.id === 'leech_seed')
    )
    expect(seeded).toHaveLength(2)
  })

  it('tier 3 - seeds 3 nearest enemies', () => {
    const t3 = makeUnit('venusaur', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    resolveProjectiles(s)
    const seeded = [e1, e2, e3].filter(e =>
      e.statusEffects.some(fx => fx.id === 'leech_seed')
    )
    expect(seeded).toHaveLength(3)
  })

  it('does not seed enemies beyond 2 hexes', () => {
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 0 }
    state = createCombatState([caster], [farEnemy])
    cast(caster, state)
    resolveProjectiles(state)
    expect(farEnemy.statusEffects.some(fx => fx.id === 'leech_seed')).toBe(false)
  })

  it('leech_seed lasts 3 seconds (180 ticks)', () => {
    cast(caster, state)
    resolveProjectiles(state)
    const seed = e1.statusEffects.find(fx => fx.id === 'leech_seed')
    expect(seed).toBeDefined()
    expect(seed!.durationTicks).toBe(180)
  })

  it('tier 1 leech_seed magnitude is 80 (damage per second)', () => {
    cast(caster, state)
    resolveProjectiles(state)
    const seed = e1.statusEffects.find(fx => fx.id === 'leech_seed')
    expect(seed).toBeDefined()
    expect(seed!.magnitude).toBe(80)
  })

  it('tier 2 leech_seed magnitude is 100', () => {
    const t2 = makeUnit('venusaur', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t2], [e1, e2, e3])
    cast(t2, s)
    resolveProjectiles(s)
    const seededEnemy = [e1, e2, e3].find(e => e.statusEffects.some(fx => fx.id === 'leech_seed'))
    const seed = seededEnemy?.statusEffects.find(fx => fx.id === 'leech_seed')
    expect(seed).toBeDefined()
    expect(seed!.magnitude).toBe(100)
  })

  it('tier 3 leech_seed magnitude is 120', () => {
    const t3 = makeUnit('venusaur', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    resolveProjectiles(s)
    const seed = e1.statusEffects.find(fx => fx.id === 'leech_seed')
    expect(seed).toBeDefined()
    expect(seed!.magnitude).toBe(120)
  })

  it('recast refreshes the seed (stackId dedupe, single instance)', () => {
    cast(caster, state)
    resolveProjectiles(state)
    cast(caster, state)
    resolveProjectiles(state)
    const seeds = e1.statusEffects.filter(fx => fx.id === 'leech_seed')
    expect(seeds).toHaveLength(1)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    resolveProjectiles(state)
    expect(state.projectiles.size).toBe(0)
  })
})
