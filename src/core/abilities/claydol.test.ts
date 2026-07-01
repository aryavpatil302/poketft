import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'

import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20
const CHANNEL_TICKS = 90  // 1.5 * 60

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function expireGravity(target: Unit, state: CombatState): void {
  const fx = target.statusEffects.find(e => e.stackId === 'claydol_gravity_target')
  if (fx) fx.onExpire!(target, state)
}

describe('Claydol – Gravity', () => {
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

  it('lifts exactly 2 nearest enemies to ascended state', () => {
    cast(caster, state)
    const ascended = [enemy1, enemy2, enemy3].filter(e => e.state === 'ascended')
    expect(ascended).toHaveLength(2)
  })

  it('adds claydol_gravity_target status effect to lifted enemies', () => {
    cast(caster, state)
    const lifted = [enemy1, enemy2, enemy3].filter(e => e.state === 'ascended')
    for (const e of lifted) {
      expect(e.statusEffects.some(fx => fx.stackId === 'claydol_gravity_target')).toBe(true)
    }
  })

  it('channel duration is 1.5 seconds (90 ticks)', () => {
    cast(caster, state)
    const lifted = [enemy1, enemy2, enemy3].find(e => e.state === 'ascended')!
    const fx = lifted.statusEffects.find(f => f.stackId === 'claydol_gravity_target')!
    expect(fx.durationTicks).toBe(CHANNEL_TICKS)
  })

  it('tickEffect keeps enemy in ascended state each tick', () => {
    cast(caster, state)
    const lifted = [enemy1, enemy2, enemy3].find(e => e.state === 'ascended')!
    const fx = lifted.statusEffects.find(f => f.stackId === 'claydol_gravity_target')!
    lifted.state = 'idle'
    fx.tickEffect!(lifted, state)
    expect(lifted.state).toBe('ascended')
  })

  it('slam deals flat + max HP % damage (tier 1: 400 + 5%)', () => {
    cast(caster, state)
    const lifted = [enemy1, enemy2, enemy3].find(e => e.state === 'ascended')!
    lifted.spDefense = 0; lifted._computedStats = null
    const hpBefore = lifted.currentHp
    expireGravity(lifted, state)
    const expectedMin = 400 + Math.round(lifted.maxHp * 0.05)
    expect(hpBefore - lifted.currentHp).toBeGreaterThanOrEqual(expectedMin - 1)
  })

  it('slam damage scales per tier', () => {
    const flatDmg = [400, 600, 1000] as const
    const pctDmg  = [0.05, 0.08, 0.10] as const
    for (const tier of [1, 2, 3] as const) {
      const c = makeUnit('claydol', 'player', tier)
      c.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 2 }
      e.spDefense = 0; e._computedStats = null
      const st = createCombatState([c], [e])
      cast(c, st)
      const hpBefore = e.currentHp
      expireGravity(e, st)
      const expected = flatDmg[tier - 1] + Math.round(e.maxHp * pctDmg[tier - 1])
      expect(hpBefore - e.currentHp).toBeGreaterThanOrEqual(expected - 1)
    }
  })

  it('slam resets enemy state from ascended to idle', () => {
    cast(caster, state)
    const lifted = [enemy1, enemy2, enemy3].find(e => e.state === 'ascended')!
    expireGravity(lifted, state)
    expect(lifted.state).not.toBe('ascended')
  })

  it('emits claydol_gravity_cast VFX event', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'claydol_gravity_cast')).toBe(true)
  })

  it('emits claydol_gravity_slam VFX event on each slammed enemy', () => {
    cast(caster, state)
    state.events = []
    const lifted = [enemy1, enemy2, enemy3].filter(e => e.state === 'ascended')
    for (const e of lifted) expireGravity(e, state)
    const slamEvents = state.events.filter(e => e.type === 'vfx' && (e as any).effectId === 'claydol_gravity_slam')
    expect(slamEvents).toHaveLength(2)
  })

  it('does not damage dead enemies on slam', () => {
    cast(caster, state)
    const lifted = [enemy1, enemy2, enemy3].find(e => e.state === 'ascended')!
    lifted.state = 'dead'
    const hpBefore = lifted.currentHp
    expireGravity(lifted, state)
    expect(lifted.currentHp).toBe(hpBefore)
  })
})
