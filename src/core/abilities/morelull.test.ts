import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickProjectiles } from '../projectile'
import { TICK_RATE } from '../constants'
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

describe('Morelull - Strength Sap', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('morelull', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // Use a real unit as the enemy so it has an attack stat to sap
    enemy = makeUnit('tangela', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('launches a sap projectile at the nearest enemy', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'morelull_strength_sap')
    expect(projs).toHaveLength(1)
    expect(projs[0].targetId).toBe(enemy.id)
  })

  it('projectile has magic damage payload (tier 1 = 300)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    expect(proj.damagePayload?.baseAmount).toBe(300)
    expect(proj.damagePayload?.damageType).toBe('magic')
  })

  it('deals magic damage to the nearest enemy on hit (HP decreases)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    resolveProjectiles(state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('applies a 33% attack reduction to the enemy for 3 seconds', () => {
    const atkBefore = computeStats(enemy).attack
    cast(caster, state)
    resolveProjectiles(state)
    const reduction = enemy.statusEffects.find(e => e.id === 'atk_reduction')
    expect(reduction).toBeDefined()
    expect(reduction!.magnitude).toBe(Math.round(atkBefore * 0.33))
    expect(reduction!.durationTicks).toBe(3 * TICK_RATE)
  })

  it('fires a heal projectile from the enemy to the nearest ally', () => {
    caster.currentHp = Math.max(1, caster.maxHp - 500)  // ensure the heal actually lands
    cast(caster, state)
    // Resolve just the damage projectile; heal projectile should then exist
    resolveProjectiles(state, 500)
    // After all projectiles resolve, the caster (only ally) got healed —
    // verify via heal event
    expect(state.events.some(e => e.type === 'heal')).toBe(true)
  })

  it('heal equals target attack × healPct at tier 1 (85%)', () => {
    const atkBefore = computeStats(enemy).attack
    caster.currentHp = Math.max(1, caster.maxHp - 1000)
    const hpBefore = caster.currentHp
    cast(caster, state)
    resolveProjectiles(state)
    const expectedHeal = Math.round(atkBefore * 0.85)
    expect(caster.currentHp).toBe(Math.min(caster.maxHp, hpBefore + expectedHeal))
  })

  it('adds a brief shake animation on cast', () => {
    cast(caster, state)
    expect(caster.statusEffects.some(e => e.stackId === 'morelull_shake')).toBe(true)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.projectiles.size).toBe(0)
  })
})
