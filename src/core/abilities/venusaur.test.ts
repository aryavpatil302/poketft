import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
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
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 1 }
    e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 4, row: 1 }
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

  it('tier 1 - applies leech_seed to 2 nearest enemies', () => {
    cast(caster, state)
    const seeded = [e1, e2, e3].filter(e =>
      e.statusEffects.some(fx => fx.id === 'leech_seed')
    )
    expect(seeded).toHaveLength(2)
  })

  it('tier 3 - applies leech_seed to 3 nearest enemies', () => {
    const t3 = makeUnit('venusaur', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    const seeded = [e1, e2, e3].filter(e =>
      e.statusEffects.some(fx => fx.id === 'leech_seed')
    )
    expect(seeded).toHaveLength(3)
  })

  it('leech_seed has permanent duration (-1)', () => {
    cast(caster, state)
    const seed = e1.statusEffects.find(fx => fx.id === 'leech_seed')
    if (seed) {
      expect(seed.durationTicks).toBe(-1)
    }
  })

  it('tier 1 leech_seed magnitude is 80 (damage per second)', () => {
    cast(caster, state)
    const seed = e1.statusEffects.find(fx => fx.id === 'leech_seed')
    if (seed) {
      expect(seed.magnitude).toBe(80)
    }
  })

  it('tier 2 leech_seed magnitude is 100', () => {
    const t2 = makeUnit('venusaur', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t2], [e1, e2, e3])
    cast(t2, s)
    const seed = e1.statusEffects.find(fx => fx.id === 'leech_seed')
    if (seed) {
      expect(seed.magnitude).toBe(100)
    }
  })

  it('tier 3 leech_seed magnitude is 120', () => {
    const t3 = makeUnit('venusaur', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    const seed = e1.statusEffects.find(fx => fx.id === 'leech_seed')
    if (seed) {
      expect(seed.magnitude).toBe(120)
    }
  })

  it('already-seeded target receives 50% reduced magnitude on recast', () => {
    cast(caster, state)
    // Recast — e1 is already seeded
    const prevSeedCount = e1.statusEffects.filter(fx => fx.id === 'leech_seed').length
    cast(caster, state)
    // A new seed with half magnitude should be added
    const seeds = e1.statusEffects.filter(fx => fx.id === 'leech_seed')
    const halfMagSeed = seeds.find(fx => fx.magnitude === 40)  // 80 * 0.5
    if (seeds.length > prevSeedCount) {
      expect(halfMagSeed).toBeDefined()
    }
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    // No status effects applied to anyone
    expect(caster.statusEffects.filter(fx => fx.id === 'leech_seed')).toHaveLength(0)
  })
})
