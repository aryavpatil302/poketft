import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { applyDamage } from './damage'
import { OVERTIME_START_TICK, OVERTIME_DAMAGE_AMP } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

// Deal `abilityId`-tagged damage from src → tgt and return the HP lost.
function hit(src: Unit, tgt: Unit, state: CombatState, type: 'physical' | 'magic' | 'true'): number {
  const before = tgt.currentHp
  applyDamage(src, tgt, { baseAmount: 1000, damageType: type, canCrit: false, abilityId: 'test' }, state)
  return before - tgt.currentHp
}

function scenario(): { src: Unit; tgt: Unit; state: CombatState } {
  const src = makeUnit('graveler', 'player', 1); src.hexPos = { col: 3, row: 5 }
  const tgt = makeUnit('graveler', 'enemy', 1);  tgt.hexPos = { col: 3, row: 2 }
  tgt.maxHp = 1_000_000; tgt.currentHp = 1_000_000   // never dies during the test
  const state = createCombatState([src], [tgt])
  for (const u of state.units.values()) computeStats(u)
  return { src, tgt, state }
}

describe('Overtime combat modifiers', () => {
  it('true damage: +30% amp, no durability interaction', () => {
    const { src, tgt, state } = scenario()
    state.tick = OVERTIME_START_TICK - 1
    const normal = hit(src, tgt, state, 'true')
    state.tick = OVERTIME_START_TICK
    const overtime = hit(src, tgt, state, 'true')
    // 1000 → 1300 exactly (true damage skips mitigation entirely)
    expect(normal).toBe(1000)
    expect(overtime).toBe(Math.round(1000 * (1 + OVERTIME_DAMAGE_AMP)))
  })

  it('physical damage takes more in overtime (amp up AND armor down)', () => {
    const { src, tgt, state } = scenario()
    expect(computeStats(tgt).defense).toBeGreaterThan(0)   // mitigation is in play

    state.tick = OVERTIME_START_TICK - 1
    const normal = hit(src, tgt, state, 'physical')
    state.tick = OVERTIME_START_TICK
    const overtime = hit(src, tgt, state, 'physical')

    // Strictly more than the +30% amp alone, because reduced armor lets more through.
    expect(overtime).toBeGreaterThan(Math.round(normal * (1 + OVERTIME_DAMAGE_AMP)))
  })

  it('magic damage takes more in overtime (amp up AND sp.def down)', () => {
    const { src, tgt, state } = scenario()
    state.tick = OVERTIME_START_TICK - 1
    const normal = hit(src, tgt, state, 'magic')
    state.tick = OVERTIME_START_TICK
    const overtime = hit(src, tgt, state, 'magic')
    expect(overtime).toBeGreaterThan(Math.round(normal * (1 + OVERTIME_DAMAGE_AMP)))
  })

  it('modifiers switch on exactly at the overtime tick, not before', () => {
    const { src, tgt, state } = scenario()
    state.tick = OVERTIME_START_TICK - 1
    const justBefore = hit(src, tgt, state, 'true')
    expect(justBefore).toBe(1000)   // unbuffed right up to the boundary
  })
})
