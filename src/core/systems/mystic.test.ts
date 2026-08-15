import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { applyDamage } from './damage'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered (required by createCombatState)
import '../systems/ability'

// Mystic units: tapu_fini, morelull, oranguru, abomasnow (celebi is no longer mystic)

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

// Simulate one instance of mystic ability damage
function abilityHit(source: Unit, target: Unit, state: CombatState): void {
  applyDamage(source, target, {
    baseAmount: 10,
    damageType: 'magic',
    canCrit: false,
    abilityId: 'test_mystic_ability',
  }, state)
}

function sunderMag(unit: Unit): number {
  return unit.statusEffects.find(e => e.stackId === 'mystic_sunder')?.magnitude ?? 0
}

function durabilityMag(unit: Unit): number {
  return unit.statusEffects.find(e => e.stackId === 'mystic_durability')?.magnitude ?? 0
}

describe('Mystic trait — durability steal', () => {

  it('below threshold (1 mystic): no mystic_active marker, no steal', () => {
    const m1 = makeUnit('morelull', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([m1, ally], [enemy])

    const src = state.units.get(m1.id)!
    expect(src.statusEffects.some(e => e.stackId === 'mystic_active')).toBe(false)
    abilityHit(src, enemy, state)
    expect(sunderMag(enemy)).toBe(0)
  })

  it('threshold 2: mystic units get the active marker at level 2', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([m1, m2], [enemy])

    for (const m of [m1, m2]) {
      const fx = state.units.get(m.id)!.statusEffects.find(e => e.stackId === 'mystic_active')
      expect(fx).toBeDefined()
      expect(fx!.magnitude).toBe(2)
    }
  })

  it('threshold 2: ability hit steals 3% durability and grants it team-wide', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([m1, m2, ally], [enemy])

    abilityHit(state.units.get(m1.id)!, enemy, state)

    expect(sunderMag(enemy)).toBeCloseTo(0.03)
    // Every living ally gains the stolen durability
    expect(durabilityMag(state.units.get(m1.id)!)).toBeCloseTo(0.03)
    expect(durabilityMag(state.units.get(m2.id)!)).toBeCloseTo(0.03)
    expect(durabilityMag(state.units.get(ally.id)!)).toBeCloseTo(0.03)
  })

  it('threshold 2: per-enemy reduction caps at 18%', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    const state = makeState([m1, m2], [enemy])

    const src = state.units.get(m1.id)!
    for (let i = 0; i < 10; i++) abilityHit(src, enemy, state)

    expect(sunderMag(enemy)).toBeCloseTo(0.18)
  })

  it('threshold 2: team durability gain caps at 18%', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const e1 = makeUnit('dummy', 'enemy', 1)
    const e2 = makeUnit('dummy', 'enemy', 1)
    e1.maxHp = 100000; e1.currentHp = 100000
    e2.maxHp = 100000; e2.currentHp = 100000
    const state = makeState([m1, m2], [e1, e2])

    const src = state.units.get(m1.id)!
    // Two enemies × 10 hits each — enough steals to exceed the team cap
    for (let i = 0; i < 10; i++) abilityHit(src, e1, state)
    for (let i = 0; i < 10; i++) abilityHit(src, e2, state)

    expect(durabilityMag(src)).toBeCloseTo(0.18)
    // Both enemies individually capped
    expect(sunderMag(e1)).toBeCloseTo(0.18)
    expect(sunderMag(e2)).toBeCloseTo(0.18)
  })

  it('threshold 4: steals 5% per hit, caps at 20%', () => {
    const m1 = makeUnit('tapu_fini', 'player', 1)
    const m2 = makeUnit('morelull',  'player', 1)
    const m3 = makeUnit('oranguru',  'player', 1)
    const m4 = makeUnit('abomasnow', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    const state = makeState([m1, m2, m3, m4], [enemy])

    const src = state.units.get(m1.id)!
    abilityHit(src, enemy, state)
    expect(sunderMag(enemy)).toBeCloseTo(0.05)

    for (let i = 0; i < 10; i++) abilityHit(src, enemy, state)
    expect(sunderMag(enemy)).toBeCloseTo(0.20)
    expect(durabilityMag(src)).toBeCloseTo(0.20)
  })

  it('auto attacks do NOT steal durability', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([m1, m2], [enemy])

    applyDamage(state.units.get(m1.id)!, enemy, {
      baseAmount: 10, damageType: 'physical', canCrit: false, abilityId: 'auto_attack',
    }, state)

    expect(sunderMag(enemy)).toBe(0)
  })

  it('non-mystic ally abilities do NOT steal durability', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([m1, m2, ally], [enemy])

    abilityHit(state.units.get(ally.id)!, enemy, state)
    expect(sunderMag(enemy)).toBe(0)
  })

  it('stolen durability reduces the enemy defense and spDefense in computeStats', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)  // defense 30, spDefense 30
    const state = makeState([m1, m2], [enemy])

    abilityHit(state.units.get(m1.id)!, enemy, state)
    const stats = computeStats(enemy)
    // 30 × (1 - 0.03) = 29.1 → 29
    expect(stats.defense).toBe(29)
    expect(stats.spDefense).toBe(29)
  })

  it('granted durability raises ally defense and spDefense in computeStats', () => {
    const m1 = makeUnit('oranguru', 'player', 1)
    const m2 = makeUnit('morelull', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([m1, m2], [enemy])

    const src = state.units.get(m1.id)!
    const defBefore   = computeStats(src).defense
    const spDefBefore = computeStats(src).spDefense
    abilityHit(src, enemy, state)
    const stats = computeStats(src)
    expect(stats.defense).toBe(Math.round(defBefore * 1.03))
    expect(stats.spDefense).toBe(Math.round(spDefBefore * 1.03))
  })

  it('enemy mystics steal from the player team symmetrically', () => {
    const p1 = makeUnit('tangela', 'player', 1)
    const m1 = makeUnit('oranguru', 'enemy', 1)
    const m2 = makeUnit('morelull', 'enemy', 1)
    const state = makeState([p1], [m1, m2])

    const src = state.units.get(m1.id)!
    expect(src.statusEffects.some(e => e.stackId === 'mystic_active')).toBe(true)
    abilityHit(src, state.units.get(p1.id)!, state)
    expect(sunderMag(state.units.get(p1.id)!)).toBeCloseTo(0.03)
    expect(durabilityMag(src)).toBeCloseTo(0.03)
  })
})
