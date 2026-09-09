import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../ability'
import { mitigationFactor } from '../damage'
import { TICK_RATE } from '../../constants'
import type { Unit, CombatState } from '../../types'

import '../ability'

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < 20; i++) tickAbilityCast(caster, state)
}

function setup(shiny: boolean): { caster: Unit; enemy: Unit; state: CombatState } {
  const caster = makeUnit('abomasnow', 'player', 1)
  caster.hexPos = { col: 3, row: 6 }
  if (shiny) caster.isShiny = true
  const enemy = makeUnit('dummy', 'enemy', 1)
  enemy.hexPos = { col: 3, row: 2 }
  const state = createCombatState([caster], [enemy])
  return { caster, enemy, state }
}

describe('Shiny Abomasnow - Blizzard burst x1.3 + burn', () => {
  it('deals 1.3x the initial burst damage relative to the non-shiny amount', () => {
    const { caster, enemy, state } = setup(true)
    // Read the special stat AFTER createCombatState (post universal +5%
    // shiny bump on the caster itself, which compounds with Blizzard's own
    // abilityScalingStat: 'special' multiplier) so the expected value
    // isn't double- or under-counting that separate bonus.
    const spMult = computeStats(caster).special / 100
    cast(caster, state)
    const castDmg = 300
    const shinyBurstDmg = Math.round(castDmg * 1.3)
    const scaledBase = Math.round(shinyBurstDmg * spMult)
    const red = mitigationFactor(30)  // dummy spDefense
    const expectedDmg = Math.round(scaledBase * (1 - red))
    expect(enemy.currentHp).toBe(enemy.maxHp - expectedDmg)
  })

  it('non-shiny caster deals the plain unmultiplied burst damage (control)', () => {
    const { caster, enemy, state } = setup(false)
    cast(caster, state)
    expect(enemy.currentHp).toBe(enemy.maxHp - 231)
  })

  it('applies a burn status effect to every target hit by the burst', () => {
    const { caster, enemy, state } = setup(true)
    cast(caster, state)
    const burn = enemy.statusEffects.find(fx => fx.id === 'burn')
    expect(burn).toBeDefined()
    // applyBurn's fixed 4s duration happens to equal ZONE_DURATION here.
    expect(burn!.durationTicks).toBe(4 * TICK_RATE)
  })

  it('non-shiny caster does not burn targets (control)', () => {
    const { caster, enemy, state } = setup(false)
    cast(caster, state)
    expect(enemy.statusEffects.find(fx => fx.id === 'burn')).toBeUndefined()
  })

  it('shiny burn also applies the standard heal-block debuff that comes with applyBurn', () => {
    const { caster, enemy, state } = setup(true)
    cast(caster, state)
    expect(enemy.statusEffects.find(fx => fx.id === 'healBlock')).toBeDefined()
  })

  it('the MR shred debuff still applies at magnitude 30 regardless of shininess', () => {
    const { caster, enemy, state } = setup(true)
    cast(caster, state)
    expect(enemy.statusEffects.find(fx => fx.id === 'shred')?.magnitude).toBe(30)
  })

  it('recasting while shiny refreshes the burn like every other blizzard debuff (edge case)', () => {
    const { caster, enemy, state } = setup(true)
    cast(caster, state)
    caster.currentMana = caster.maxMana
    cast(caster, state)
    const burns = enemy.statusEffects.filter(fx => fx.id === 'burn')
    // Burn isn't cleared by the blizzard-specific recast filter (only
    // blizzard_chill/blizzard_shred stackIds are), so addStatusEffect's own
    // per-target stackId dedup is what keeps this at exactly one.
    expect(burns).toHaveLength(1)
  })
})
