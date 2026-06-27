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

describe('Zubat - Poison Sting', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('zubat', 'player', 1)
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

  it('adds a projectile to state.projectiles after cast', () => {
    cast(caster, state)
    expect(state.projectiles.size).toBeGreaterThan(0)
  })

  it('projectile targets the nearest enemy', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    expect(proj.targetId).toBe(enemy.id)
  })

  it('projectile sourceId is the caster', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    expect(proj.sourceId).toBe(caster.id)
  })

  it('projectile onHit applies poison status to target (tier 1 = 20 dmg/tick)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    expect(proj.onHit).toBeDefined()
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'poison')
    expect(poison).toBeDefined()
    expect(poison!.magnitude).toBe(20)
  })

  it('poison lasts 3 seconds (3 * TICK_RATE)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'poison')
    expect(poison!.durationTicks).toBe(3 * TICK_RATE)
  })

  it('tier 2 poison magnitude is 30', () => {
    const t2 = makeUnit('zubat', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const proj = [...s2.projectiles.values()][0]
    proj.onHit!(t2, e2, s2)
    const poison = e2.statusEffects.find(e => e.id === 'poison')
    expect(poison!.magnitude).toBe(30)
  })

  it('tier 3 poison magnitude is 50', () => {
    const t3 = makeUnit('zubat', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const proj = [...s3.projectiles.values()][0]
    proj.onHit!(t3, e3, s3)
    const poison = e3.statusEffects.find(e => e.id === 'poison')
    expect(poison!.magnitude).toBe(50)
  })

  it('poison tick effect reduces enemy HP', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'poison')!
    const hpBefore = enemy.currentHp
    poison.tickEffect!(enemy, state)
    expect(enemy.currentHp).toBe(Math.max(0, hpBefore - 20))
  })

  it('does not apply poison to already dead target', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    enemy.state = 'dead'
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'poison')
    expect(poison).toBeUndefined()
  })
})
