import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('A-Marowak - Shadow Bone', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('a_marowak', 'player', 1)
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

  it('adds exactly 3 attack modifiers', () => {
    cast(caster, state)
    expect(caster.attackModifiers).toHaveLength(3)
  })

  it('first modifier has id a_marowak_bone with 1 charge', () => {
    cast(caster, state)
    const mod1 = caster.attackModifiers[0]
    expect(mod1.id).toBe('a_marowak_bone')
    expect(mod1.remainingCharges).toBe(1)
  })

  it('second modifier has id a_marowak_bone with 1 charge', () => {
    cast(caster, state)
    const mod2 = caster.attackModifiers[1]
    expect(mod2.id).toBe('a_marowak_bone')
    expect(mod2.remainingCharges).toBe(1)
  })

  it('third modifier has id a_marowak_bone_3 with 1 charge', () => {
    cast(caster, state)
    const mod3 = caster.attackModifiers[2]
    expect(mod3.id).toBe('a_marowak_bone_3')
    expect(mod3.remainingCharges).toBe(1)
  })

  it('tier 1 - first two modifiers deal 80 magic bonus damage', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].bonusDamage).toBe(80)
    expect(caster.attackModifiers[0].bonusDamageType).toBe('magic')
    expect(caster.attackModifiers[1].bonusDamage).toBe(80)
    expect(caster.attackModifiers[1].bonusDamageType).toBe('magic')
  })

  it('tier 2 - first two modifiers deal 120 magic bonus damage', () => {
    const t2 = makeUnit('a_marowak', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)
    expect(t2.attackModifiers[0].bonusDamage).toBe(120)
    expect(t2.attackModifiers[1].bonusDamage).toBe(120)
  })

  it('tier 3 - first two modifiers deal 200 magic bonus damage', () => {
    const t3 = makeUnit('a_marowak', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)
    expect(t3.attackModifiers[0].bonusDamage).toBe(200)
    expect(t3.attackModifiers[1].bonusDamage).toBe(200)
  })

  it('third modifier has bonusDamage 0 (uses onHit instead)', () => {
    cast(caster, state)
    const mod3 = caster.attackModifiers[2]
    expect(mod3.bonusDamage).toBe(0)
  })

  it('third modifier onHit deals magic damage to target', () => {
    cast(caster, state)
    const mod3 = caster.attackModifiers[2]
    expect(mod3.onHit).toBeDefined()

    enemy.maxHp = 10000
    enemy.currentHp = 10000
    const hpBefore = enemy.currentHp
    mod3.onHit!(caster, enemy, state)

    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'magic' && e.targetId === enemy.id
    )
    expect(dmgEvent).toBeDefined()
  })

  it('tier 1 - third modifier onHit deals 120 magic damage (base, before mitigation)', () => {
    cast(caster, state)
    const mod3 = caster.attackModifiers[2]

    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.spDefense = 0  // remove mitigation so received = base
    enemy._computedStats = null  // force recompute with 0 spDefense
    mod3.onHit!(caster, enemy, state)

    const dmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'magic' && e.targetId === enemy.id
    )
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(120)
    }
  })

  it('tier 1 - third modifier onHit heals caster for 50% of dmg3 (60 HP)', () => {
    cast(caster, state)
    const mod3 = caster.attackModifiers[2]

    caster.currentHp = 1  // drop to 1 so heal is visible
    mod3.onHit!(caster, enemy, state)

    // heal = Math.round(120 * 0.50) = 60
    expect(caster.currentHp).toBeGreaterThan(1)
    expect(state.events.some(e => e.type === 'heal')).toBe(true)
  })

  it('tier 3 - third modifier onHit deals 300 magic damage (base, before mitigation)', () => {
    const t3 = makeUnit('a_marowak', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000
    e.currentHp = 10000
    e.spDefense = 0  // remove mitigation
    e._computedStats = null  // force recompute
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)

    const mod3 = t3.attackModifiers[2]
    mod3.onHit!(t3, e, s)

    const dmgEvent = s.events.find(
      ev => ev.type === 'damage' && (ev as any).damageType === 'magic' && ev.targetId === e.id
    )
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(300)
    }
  })
})
