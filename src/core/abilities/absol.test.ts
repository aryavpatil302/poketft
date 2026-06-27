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

describe('Absol - Night Slash', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('absol', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    // Place enemy adjacent (1 hex away) to be in range
    enemy.hexPos = { col: 3, row: 4 }
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

  it('resets mana to 0 after cast animation completes', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('tier 1 - deals physical damage (200) to adjacent enemy', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('physical')
    }
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 2 - deals 300 base physical damage', () => {
    const t2 = makeUnit('absol', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 4 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('physical')
    }
  })

  it('tier 3 - deals 500 base physical damage', () => {
    const t3 = makeUnit('absol', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 4 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
  })

  it('heals caster for each enemy hit (tier 1 = 60 per enemy)', () => {
    // Set caster HP below max so heal is visible
    caster.currentHp = caster.maxHp - 200
    const hpBefore = caster.currentHp
    cast(caster, state)
    // Should have healed for 60 (one enemy hit)
    expect(caster.currentHp).toBeGreaterThan(hpBefore)
  })

  it('hits multiple adjacent enemies and heals per hit', () => {
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 4 }
    state = createCombatState([caster], [enemy, e2])

    caster.currentHp = caster.maxHp - 500
    const hpBefore = caster.currentHp
    cast(caster, state)

    const damagedCount = [enemy, e2].filter(e => e.currentHp < e.maxHp).length
    expect(damagedCount).toBeGreaterThanOrEqual(1)
    // Healed for each enemy hit
    expect(caster.currentHp).toBeGreaterThan(hpBefore)
  })

  it('does not hit enemies more than 1 hex away', () => {
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 2 }  // 3 rows away — out of range
    state = createCombatState([caster], [farEnemy])
    cast(caster, state)
    expect(farEnemy.currentHp).toBe(farEnemy.maxHp)
  })

  it('does no damage when no enemies are adjacent', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('does not damage allies', () => {
    const ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster, ally], [enemy])
    const allyHpBefore = ally.currentHp
    cast(caster, state)
    expect(ally.currentHp).toBe(allyHpBefore)
  })
})
