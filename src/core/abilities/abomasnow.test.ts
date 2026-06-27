import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Abomasnow - Blizzard', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('abomasnow', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('creates exactly one PersistentAoEZone after cast', () => {
    cast(caster, state)
    expect(state.persistentAoEZones).toHaveLength(1)
  })

  it('zone id matches expected prefix and unit id', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.id).toBe(`abomasnow_blizzard_${caster.id}`)
  })

  it('zone center is at caster hex position', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.center).toEqual(caster.hexPos)
  })

  it('zone radius is 2', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.radius).toBe(2)
  })

  it('zone damagePerInterval is 60 at tier 1', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.damagePerInterval).toBe(60)
  })

  it('zone durationTicks is 4 * TICK_RATE at tier 1', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.durationTicks).toBe(4 * TICK_RATE)
  })

  it('zone targets enemy team (player caster → enemy zone)', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.targetTeam).toBe('enemy')
  })

  it('tier 2: damagePerInterval = 90, duration = 5 * TICK_RATE', () => {
    const t2 = makeUnit('abomasnow', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const zone = s2.persistentAoEZones[0]
    expect(zone.damagePerInterval).toBe(90)
    expect(zone.durationTicks).toBe(5 * TICK_RATE)
  })

  it('tier 3: damagePerInterval = 150, duration = 6 * TICK_RATE', () => {
    const t3 = makeUnit('abomasnow', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const zone = s3.persistentAoEZones[0]
    expect(zone.damagePerInterval).toBe(150)
    expect(zone.durationTicks).toBe(6 * TICK_RATE)
  })

  it('recasting removes the old zone and creates a new one (no duplication)', () => {
    cast(caster, state)
    expect(state.persistentAoEZones).toHaveLength(1)
    cast(caster, state)
    // Should still be exactly 1 zone (refreshed, not doubled)
    expect(state.persistentAoEZones).toHaveLength(1)
  })

  it('recast zone has same id as original zone', () => {
    cast(caster, state)
    const firstZoneId = state.persistentAoEZones[0].id
    cast(caster, state)
    const secondZoneId = state.persistentAoEZones[0].id
    expect(secondZoneId).toBe(firstZoneId)
  })

  it('zone intervalTicks equals TICK_RATE (damage once per second)', () => {
    cast(caster, state)
    const zone = state.persistentAoEZones[0]
    expect(zone.intervalTicks).toBe(TICK_RATE)
  })
})
