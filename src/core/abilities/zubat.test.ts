import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 15): void {
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

  it('projectile has magic damage payload (tier 1 = 200)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    expect(proj.damagePayload?.baseAmount).toBe(200)
    expect(proj.damagePayload?.damageType).toBe('magic')
  })

  it('projectile onHit applies zubat_poison status to target', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    expect(proj.onHit).toBeDefined()
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'zubat_poison')
    expect(poison).toBeDefined()
  })

  it('poison lasts 4 seconds (4 * TICK_RATE)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'zubat_poison')
    expect(poison!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('tier 1 poison ticks for 5 damage per second (20 total / 4 ticks)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'zubat_poison')!
    const hpBefore = enemy.currentHp
    poison.tickEffect!(enemy, state)
    expect(enemy.currentHp).toBe(hpBefore - 5)
  })

  it('tier 2 poison ticks for 13 damage per second (50 total / 4 ticks)', () => {
    const t2 = makeUnit('zubat', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const proj = [...s2.projectiles.values()][0]
    proj.onHit!(t2, e2, s2)
    const poison = e2.statusEffects.find(e => e.id === 'zubat_poison')!
    const hpBefore = e2.currentHp
    poison.tickEffect!(e2, s2)
    expect(e2.currentHp).toBe(hpBefore - 13)
  })

  it('tier 3 poison ticks for 19 damage per second (75 total / 4 ticks)', () => {
    const t3 = makeUnit('zubat', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const proj = [...s3.projectiles.values()][0]
    proj.onHit!(t3, e3, s3)
    const poison = e3.statusEffects.find(e => e.id === 'zubat_poison')!
    const hpBefore = e3.currentHp
    poison.tickEffect!(e3, s3)
    expect(e3.currentHp).toBe(hpBefore - 19)
  })

  it('does not apply poison to already dead target', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    enemy.state = 'dead'
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'zubat_poison')
    expect(poison).toBeUndefined()
  })
})
