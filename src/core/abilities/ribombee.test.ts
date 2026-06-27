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

describe('Ribombee - Pollen Puff', () => {
  let caster: Unit
  let enemy: Unit
  let ally: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('ribombee', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.visualPos = { x: 300, y: 500 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    ally.currentHp = ally.maxHp / 2  // lower HP so ribombee targets it
    state = createCombatState([caster, ally], [enemy])
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

  it('fires 2 projectiles on cast (one heal, one damage)', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    expect(projs).toHaveLength(2)
  })

  it('heal projectile targets the lowest health ally', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const healProj = projs.find(p => p.healPayload)
    expect(healProj).toBeDefined()
    expect(healProj!.targetId).toBe(ally.id)
  })

  it('heal projectile carries the correct heal amount (tier 1 = 100)', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const healProj = projs.find(p => p.healPayload)
    expect(healProj?.healPayload?.amount).toBe(100)
  })

  it('damage projectile targets the nearest enemy', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const dmgProj = projs.find(p => p.damagePayload)
    expect(dmgProj).toBeDefined()
    expect(dmgProj!.targetId).toBe(enemy.id)
  })

  it('damage projectile deals magic damage (tier 1 = 100 base)', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const dmgProj = projs.find(p => p.damagePayload)
    expect(dmgProj?.damagePayload?.damageType).toBe('magic')
    expect(dmgProj?.damagePayload?.baseAmount).toBe(100)
  })

  it('damage projectile has an onHit callback (for the chill debuff)', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const dmgProj = projs.find(p => p.damagePayload)
    expect(typeof dmgProj?.onHit).toBe('function')
  })

  it('onHit applies chill (atkSpd slow) status effect to enemy', () => {
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const dmgProj = projs.find(p => p.damagePayload)
    // Simulate the projectile landing
    dmgProj!.onHit!(caster, enemy, state)
    const chill = enemy.statusEffects.find(fx => fx.id === 'chill' && fx.stackId === 'ribombee_pollen_slow')
    expect(chill).toBeDefined()
    expect(chill?.magnitude).toBeCloseTo(0.30)
    expect(chill?.durationTicks).toBe(60)
  })

  it('tier 2 heal projectile carries 175 heal amount', () => {
    const t2 = makeUnit('ribombee', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.visualPos = { x: 300, y: 500 }
    const a = makeUnit('dummy', 'player', 1)
    a.hexPos = { col: 4, row: 5 }
    a.currentHp = 1
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2, a], [e])
    cast(t2, s)
    const projs = [...s.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const healProj = projs.find(p => p.healPayload)
    expect(healProj?.healPayload?.amount).toBe(175)
  })

  it('tier 3 damage projectile carries 300 base damage', () => {
    const t3 = makeUnit('ribombee', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    t3.visualPos = { x: 300, y: 500 }
    const a = makeUnit('dummy', 'player', 1)
    a.hexPos = { col: 4, row: 5 }
    a.currentHp = 1
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3, a], [e])
    cast(t3, s)
    const projs = [...s.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    const dmgProj = projs.find(p => p.damagePayload)
    expect(dmgProj?.damagePayload?.baseAmount).toBe(300)
  })

  it('fires only one damage projectile when no allies present', () => {
    // Solo caster — no allies, so only the damage puff fires
    state = createCombatState([caster], [enemy])
    cast(caster, state)
    const projs = [...state.projectiles.values()].filter(p => p.abilityId === 'ribombee_pollen_puff')
    // Only enemy puff should be created
    expect(projs.some(p => p.damagePayload)).toBe(true)
  })
})
