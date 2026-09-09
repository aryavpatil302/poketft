import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../ability'
import { TICK_RATE } from '../../constants'
import type { Unit, CombatState } from '../../types'

import '../ability'

// This file introduces the shiny-conditional combat-behavior test shape used
// across this whole batch: every effect gets its normal case, an explicit
// non-shiny control proving the effect does NOT fire without isShiny, and
// real edge cases.

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

function setupSnorunt(tier: 1 | 2 | 3, shiny: boolean): { caster: Unit; state: CombatState } {
  const caster = makeUnit('snorunt', 'player', tier)
  caster.hexPos = { col: 3, row: 5 }
  if (shiny) caster.isShiny = true
  const enemy = makeUnit('dummy', 'enemy', 1)
  enemy.hexPos = { col: 3, row: 2 }
  const state = createCombatState([caster], [enemy])
  return { caster, state }
}

describe('Shiny Snorunt - Ice Body shield 1.5x', () => {
  it('shields for 1.5x the formula value at tier 1', () => {
    const { caster, state } = setupSnorunt(1, true)
    // Read the special stat AFTER createCombatState (post universal +5%
    // shiny bump, which runs before this ability ever casts) so the
    // expected value isn't double-counting that separate bonus.
    const spMult = computeStats(caster).special / 100
    cast(caster, state)
    const expected = Math.round(Math.round(150 * spMult) * 1.5)
    expect(caster.shields[0]?.value).toBe(expected)
  })

  it('non-shiny snorunt shield is unaffected (control)', () => {
    const { caster, state } = setupSnorunt(1, false)
    const spMult = computeStats(caster).special / 100
    cast(caster, state)
    expect(caster.shields[0]?.value).toBe(Math.round(150 * spMult))
  })

  it('scales the same 1.5x ratio at tier 2 and tier 3', () => {
    const shieldValues = [150, 200, 300]
    for (const tier of [2, 3] as const) {
      const { caster, state } = setupSnorunt(tier, true)
      const spMult = computeStats(caster).special / 100
      cast(caster, state)
      const expected = Math.round(Math.round(shieldValues[tier - 1] * spMult) * 1.5)
      expect(caster.shields[0]?.value).toBe(expected)
    }
  })

  it('shield duration is unaffected by shininess (still 3 * TICK_RATE)', () => {
    const { caster, state } = setupSnorunt(1, true)
    cast(caster, state)
    expect(caster.shields[0]?.durationTicks).toBe(3 * TICK_RATE)
  })
})
