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

describe("Tapu Fini - Nature's Madness", () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tapu_fini', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('marks the target as whirlpooled', () => {
    cast(caster, state)
    expect(enemy.whirlpooled).toBe(true)
  })

  it('adds a whirlpool_damage status effect to the target', () => {
    cast(caster, state)
    expect(enemy.statusEffects.some(e => e.id === 'whirlpool_damage')).toBe(true)
  })

  it('whirlpool lasts 10 seconds', () => {
    cast(caster, state)
    const fx = enemy.statusEffects.find(e => e.id === 'whirlpool_damage')
    expect(fx?.durationTicks).toBe(10 * TICK_RATE)
  })

  it('emits a tapufini_whirlpool vfx event', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'vfx' && e.effectId === 'tapufini_whirlpool')).toBe(true)
  })

  it('tier 1/2 — only whirlpools one enemy when multiple are present', () => {
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [enemy, e2])
    cast(caster, state)
    const whirlpooled = [enemy, e2].filter(e => e.whirlpooled)
    expect(whirlpooled).toHaveLength(1)
  })

  it('tier 3 — whirlpools every enemy simultaneously', () => {
    const t3 = makeUnit('tapu_fini', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1); e1.hexPos = { col: 2, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1); e2.hexPos = { col: 4, row: 2 }
    const e3 = makeUnit('dummy', 'enemy', 1); e3.hexPos = { col: 3, row: 1 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    expect(e1.whirlpooled).toBe(true)
    expect(e2.whirlpooled).toBe(true)
    expect(e3.whirlpooled).toBe(true)
  })

  it('tier 3 — emits one vfx event per enemy', () => {
    const t3 = makeUnit('tapu_fini', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1); e1.hexPos = { col: 2, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1); e2.hexPos = { col: 4, row: 2 }
    const s = createCombatState([t3], [e1, e2])
    cast(t3, s)
    const whirlpoolVfx = s.events.filter(e => e.type === 'vfx' && e.effectId === 'tapufini_whirlpool')
    expect(whirlpoolVfx).toHaveLength(2)
  })
})
