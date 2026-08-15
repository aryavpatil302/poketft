import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { applyDamage } from './damage'
import { hexId } from '../hexGrid'
import type { CombatState } from '../types'

import './ability'

// Kill the (single) substitutor and return the substitute it leaves behind.
function killSubAndGetSpawn(stage: number | undefined): number | null {
  const ferro = makeUnit('ferrothorn', 'player', 1); ferro.hexPos = { col: 3, row: 5 }
  const foe   = makeUnit('dummy', 'enemy', 1);        foe.hexPos = { col: 3, row: 2 }
  const state: CombatState = createCombatState([ferro], [foe], stage)

  applyDamage(foe, ferro, { baseAmount: 10_000_000, damageType: 'true', canCrit: false, abilityId: 'test' }, state)

  const sub = [...state.units.values()].find(u => u.definitionId === 'substitutor_sub')
  return sub ? sub.maxHp : null
}

describe('Substitutor — stage-scaled substitute HP', () => {
  it('a single substitutor leaves a 1500-HP substitute at full strength (no stage)', () => {
    expect(killSubAndGetSpawn(undefined)).toBe(1500)
  })

  it('scales the substitute HP down in early stages, up to the full mark by stage 5', () => {
    // Single-substitutor breakpoint is 1500; multiplier ramps 0.4 → 1.0 over stages 1-5.
    expect(killSubAndGetSpawn(1)).toBe(600)    // 1500 × 0.40
    expect(killSubAndGetSpawn(2)).toBe(825)    // 1500 × 0.55
    expect(killSubAndGetSpawn(3)).toBe(1050)   // 1500 × 0.70
    expect(killSubAndGetSpawn(4)).toBe(1275)   // 1500 × 0.85
    expect(killSubAndGetSpawn(5)).toBe(1500)   // full
  })

  it('holds at full strength past the plateau stage', () => {
    expect(killSubAndGetSpawn(8)).toBe(1500)
  })

  it('spawns the substitute on the fallen unit’s freed hex', () => {
    const ferro = makeUnit('ferrothorn', 'player', 1); ferro.hexPos = { col: 3, row: 5 }
    const foe   = makeUnit('dummy', 'enemy', 1);        foe.hexPos = { col: 3, row: 2 }
    const state = createCombatState([ferro], [foe], 3)

    applyDamage(foe, ferro, { baseAmount: 10_000_000, damageType: 'true', canCrit: false, abilityId: 'test' }, state)

    const sub = [...state.units.values()].find(u => u.definitionId === 'substitutor_sub')!
    expect(sub).toBeDefined()
    expect(state.hexOccupancy.get(hexId({ col: 3, row: 5 }))).toBe(sub.id)
  })
})
