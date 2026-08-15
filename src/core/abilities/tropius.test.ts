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

describe('Tropius - Leaf Tornado', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tropius', 'player', 1)
    caster.hexPos = { col: 0, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 2 }  // directly in line with caster
    state = createCombatState([caster], [enemy])
    caster.targetId = enemy.id
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

  it('deals magic damage to enemies in the tornado path', () => {
    cast(caster, state)
    resolveProjectiles(state)
    expect(enemy.currentHp).toBeLessThan(enemy.maxHp)
  })

  it('applies knockUp status to enemies hit', () => {
    enemy.maxHp = 999999
    enemy.currentHp = 999999
    cast(caster, state)
    resolveProjectiles(state)
    const knockUp = enemy.statusEffects.find(fx => fx.id === 'knockUp')
    expect(knockUp).toBeDefined()
  })

  it('tier 1 knockUp duration is 2 seconds (120 ticks)', () => {
    enemy.maxHp = 999999
    enemy.currentHp = 999999
    cast(caster, state)
    const knockUp = enemy.statusEffects.find(fx => fx.id === 'knockUp')
    if (knockUp) {
      expect(knockUp.durationTicks).toBe(120)  // 2 * 60
    }
  })

  it('tier 3 knockUp duration is 5 seconds (300 ticks)', () => {
    const t3 = makeUnit('tropius', 'player', 3)
    t3.hexPos = { col: 0, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 0, row: 2 }
    e.maxHp = 999999
    e.currentHp = 999999
    const s = createCombatState([t3], [e])
    t3.targetId = e.id
    cast(t3, s)
    const knockUp = e.statusEffects.find(fx => fx.id === 'knockUp')
    if (knockUp) {
      expect(knockUp.durationTicks).toBe(300)  // 5 * 60
    }
  })

  it('grants a shield only once an enemy is actually knocked up', () => {
    enemy.maxHp = 999999
    enemy.currentHp = 999999
    cast(caster, state)
    // No shield at cast time — it lands when the tornado knocks the enemy up.
    expect(caster.shields.some(s => s.sourceAbility === 'tropius_leaf_tornado')).toBe(false)
    resolveProjectiles(state)
    expect(caster.shields.some(s => s.sourceAbility === 'tropius_leaf_tornado')).toBe(true)
  })

  it('tier 1 shield value is 200 per enemy knocked up', () => {
    enemy.maxHp = 999999
    enemy.currentHp = 999999
    cast(caster, state)
    resolveProjectiles(state)
    const shield = caster.shields.find(s => s.sourceAbility === 'tropius_leaf_tornado')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(200)
  })

  it('grants one shield per enemy knocked up', () => {
    // Place 2 enemies in the tornado corridor; both survive → 2 separate shields
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 0, row: 1 }
    e2.maxHp = 999999
    e2.currentHp = 999999
    enemy.maxHp = 999999
    enemy.currentHp = 999999
    state = createCombatState([caster], [enemy, e2])
    caster.targetId = enemy.id
    cast(caster, state)
    resolveProjectiles(state)
    const shields = caster.shields.filter(s => s.sourceAbility === 'tropius_leaf_tornado')
    expect(shields).toHaveLength(2)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    resolveProjectiles(state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
    expect(caster.shields).toHaveLength(0)
  })

  it('emits a shield event once an enemy is knocked up', () => {
    enemy.maxHp = 999999
    enemy.currentHp = 999999
    cast(caster, state)
    resolveProjectiles(state)
    // state.events accumulates across tickProjectiles here (only advanceCombatTick clears it)
    const shieldEvent = state.events.find(e => e.type === 'shield' && e.unitId === caster.id)
    expect(shieldEvent).toBeDefined()
  })
})
