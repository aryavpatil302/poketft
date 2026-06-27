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

describe('Spiritomb - Destiny Bond', () => {
  let caster: Unit
  let nearEnemy: Unit
  let farEnemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('spiritomb', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 4 }
    farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 0, row: 0 }
    state = createCombatState([caster], [nearEnemy, farEnemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
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

  it('creates a persistent AoE zone centered on caster', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones.find(z => z.id.startsWith('spiritomb_zone_'))
    expect(zone).toBeDefined()
    expect(zone?.center).toEqual(caster.hexPos)
    expect(zone?.radius).toBe(1)
  })

  it('AoE zone has correct magic damage per interval (tier 1 = 50)', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones.find(z => z.id.startsWith('spiritomb_zone_'))
    expect(zone?.damagePerInterval).toBe(50)
    expect(zone?.damageType).toBe('magic')
    expect(zone?.intervalTicks).toBe(TICK_RATE)
  })

  it('AoE zone lasts 6 seconds (6 * TICK_RATE)', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones.find(z => z.id.startsWith('spiritomb_zone_'))
    expect(zone?.durationTicks).toBe(6 * TICK_RATE)
  })

  it('tier 2 zone deals 75 damage per interval', () => {
    const t2 = makeUnit('spiritomb', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 4 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 0, row: 0 }
    const s = createCombatState([t2], [e1, e2])
    cast(t2, s)
    const zone = s.persistentAoEZones.find(z => z.id.startsWith('spiritomb_zone_'))
    expect(zone?.damagePerInterval).toBe(75)
  })

  it('tier 3 zone deals 120 damage per interval', () => {
    const t3 = makeUnit('spiritomb', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 4 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 0, row: 0 }
    const s = createCombatState([t3], [e1, e2])
    cast(t3, s)
    const zone = s.persistentAoEZones.find(z => z.id.startsWith('spiritomb_zone_'))
    expect(zone?.damagePerInterval).toBe(120)
  })

  it('applies spiritomb_mirror mark on the most distant enemy', () => {
    cast(caster, state)
    // farEnemy (col 0, row 0) is more distant than nearEnemy
    const mark = farEnemy.marks.find(m => m.id === 'spiritomb_mirror')
    expect(mark).toBeDefined()
    expect(mark?.durationTicks).toBe(6 * TICK_RATE)
  })

  it('does not mark the near enemy', () => {
    cast(caster, state)
    const mark = nearEnemy.marks.find(m => m.id === 'spiritomb_mirror')
    expect(mark).toBeUndefined()
  })

  it('applies mirror damage status effect on distant enemy', () => {
    cast(caster, state)
    const fx = farEnemy.statusEffects.find(fx => fx.id === 'spiritomb_mirror_dmg')
    expect(fx).toBeDefined()
    expect(fx?.tickInterval).toBe(TICK_RATE)
  })

  it('does nothing with no enemies', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    // zone still created, no errors
    const zone = state.persistentAoEZones.find(z => z.id.startsWith('spiritomb_zone_'))
    expect(zone).toBeDefined()
  })
})
