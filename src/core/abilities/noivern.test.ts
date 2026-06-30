import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS         = 20
const DAMAGE_DELAY_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
  // Tick the delayed-damage status effect to completion
  for (let i = 0; i < DAMAGE_DELAY_TICKS; i++) tickStatusEffects(state.units, state)
}

describe('Noivern - Boomburst', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('noivern', 'player', 1)
    caster.hexPos = { col: 3, row: 4 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }  // row distance 2, within range
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

  it('emits a boomburst_soundwave VFX event on cast', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
    const vfx = state.events.find(e => e.type === 'vfx' && (e as any).effectId === 'boomburst_soundwave')
    expect(vfx).toBeDefined()
  })

  it('deals magic damage to enemy within 3 rows', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(10000)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'magic' && e.targetId === enemy.id
    )
    expect(dmgEvent).toBeDefined()
  })

  it('tier 1 - damage is 400 (before mitigation)', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.spDefense = 0
    enemy._computedStats = null
    cast(caster, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(400)
    }
  })

  it('tier 2 - damage is 650 (before mitigation)', () => {
    const t2 = makeUnit('noivern', 'player', 2)
    t2.hexPos = { col: 3, row: 4 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 10000; e.currentHp = 10000; e.spDefense = 0; e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)
    for (let i = 0; i < DAMAGE_DELAY_TICKS; i++) tickStatusEffects(s.units, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(650)
  })

  it('tier 3 - damage is 2000 (before mitigation)', () => {
    const t3 = makeUnit('noivern', 'player', 3)
    t3.hexPos = { col: 3, row: 4 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = 99999; e.currentHp = 99999; e.spDefense = 0; e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)
    for (let i = 0; i < DAMAGE_DELAY_TICKS; i++) tickStatusEffects(s.units, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(2000)
  })

  it('hits all enemies within 3 rows', () => {
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 1, row: 2 }  // row distance 2 from caster (row 4)
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 5, row: 7 }  // row distance 3
    state = createCombatState([caster], [e1, e2])
    cast(caster, state)

    expect(e1.currentHp).toBeLessThan(e1.maxHp)
    expect(e2.currentHp).toBeLessThan(e2.maxHp)
  })

  it('does NOT hit enemies more than 3 rows away', () => {
    const nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 1 }  // row distance 3, within range
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 8 }  // row distance 4, out of range

    state = createCombatState([caster], [nearEnemy, farEnemy])
    cast(caster, state)

    expect(nearEnemy.currentHp).toBeLessThan(nearEnemy.maxHp)
    expect(farEnemy.currentHp).toBe(farEnemy.maxHp)
  })

  it('does nothing when no enemies are in range', () => {
    enemy.hexPos = { col: 3, row: 8 }  // row distance 4, out of range
    state = createCombatState([caster], [enemy])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('does not apply silence', () => {
    cast(caster, state)
    const silence = enemy.statusEffects.find(e => e.id === 'silence')
    expect(silence).toBeUndefined()
  })
})
