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

describe('Claydol - Gravity', () => {
  let caster: Unit
  let enemy1: Unit
  let enemy2: Unit
  let enemy3: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('claydol', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy1 = makeUnit('dummy', 'enemy', 1)
    enemy1.hexPos = { col: 3, row: 2 }
    enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 2 }
    enemy3 = makeUnit('dummy', 'enemy', 1)
    enemy3.hexPos = { col: 2, row: 2 }
    state = createCombatState([caster], [enemy1, enemy2, enemy3])
  })

  it('triggers cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('lifts the 2 nearest enemies to ascended state', () => {
    cast(caster, state)
    const ascendedEnemies = [enemy1, enemy2, enemy3].filter(e => e.state === 'ascended')
    expect(ascendedEnemies).toHaveLength(2)
  })

  it('adds claydol_slam countdown status on the caster', () => {
    cast(caster, state)
    const slam = caster.statusEffects.find(e => e.stackId === 'claydol_slam')
    expect(slam).toBeDefined()
    expect(slam!.id).toBe('claydol_slam')
  })

  it('claydol_slam duration is 2.5 seconds at tier 1', () => {
    cast(caster, state)
    const slam = caster.statusEffects.find(e => e.stackId === 'claydol_slam')
    expect(slam!.durationTicks).toBe(Math.round(2.5 * TICK_RATE))
  })

  it('claydol_slam duration is 2.5 seconds at tier 2', () => {
    const t2 = makeUnit('claydol', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2a = makeUnit('dummy', 'enemy', 1)
    e2a.hexPos = { col: 3, row: 2 }
    const e2b = makeUnit('dummy', 'enemy', 1)
    e2b.hexPos = { col: 4, row: 2 }
    const s2 = createCombatState([t2], [e2a, e2b])
    cast(t2, s2)
    const slam = t2.statusEffects.find(e => e.stackId === 'claydol_slam')
    expect(slam!.durationTicks).toBe(Math.round(2.5 * TICK_RATE))
  })

  it('claydol_slam duration is 2.5 seconds at tier 3', () => {
    const t3 = makeUnit('claydol', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3a = makeUnit('dummy', 'enemy', 1)
    e3a.hexPos = { col: 3, row: 2 }
    const e3b = makeUnit('dummy', 'enemy', 1)
    e3b.hexPos = { col: 4, row: 2 }
    const s3 = createCombatState([t3], [e3a, e3b])
    cast(t3, s3)
    const slam = t3.statusEffects.find(e => e.stackId === 'claydol_slam')
    expect(slam!.durationTicks).toBe(Math.round(2.5 * TICK_RATE))
  })

  it('slam onExpire resets ascended enemies back to idle', () => {
    cast(caster, state)
    const slam = caster.statusEffects.find(e => e.stackId === 'claydol_slam')!
    const ascendedBefore = [enemy1, enemy2, enemy3].filter(e => e.state === 'ascended')
    expect(ascendedBefore).toHaveLength(2)
    slam.onExpire!(caster, state)
    // Previously ascended enemies should now be idle (if not dead)
    const stillAscended = [enemy1, enemy2, enemy3].filter(e => e.state === 'ascended')
    expect(stillAscended).toHaveLength(0)
  })

  it('slam onExpire deals center damage to enemies occupying the former ascended hex', () => {
    cast(caster, state)
    const slam = caster.statusEffects.find(e => e.stackId === 'claydol_slam')!
    const hpBefore1 = enemy1.currentHp
    const hpBefore2 = enemy2.currentHp
    slam.onExpire!(caster, state)
    // At least the two lifted enemies should have taken damage if they remain in the zone
    const dmgDealt1 = hpBefore1 - enemy1.currentHp
    const dmgDealt2 = hpBefore2 - enemy2.currentHp
    expect(dmgDealt1 + dmgDealt2).toBeGreaterThan(0)
  })

  it('does not lift more than 2 enemies at tier 1', () => {
    cast(caster, state)
    const count = [enemy1, enemy2, enemy3].filter(e => e.state === 'ascended').length
    expect(count).toBeLessThanOrEqual(2)
  })
})
