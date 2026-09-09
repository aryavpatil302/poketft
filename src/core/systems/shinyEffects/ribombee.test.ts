import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../../systems/ability'
import type { Unit, CombatState } from '../../types'
import '../../systems/ability'

// Shiny Ribombee is Category B: the ×1.5 heal/damage multiplier lives inside
// src/core/abilities/ribombee.ts's onCast, not in this directory's
// ribombee.ts (which only registers a description). These tests exercise
// the ability file's shiny branch directly.
//
// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function setup(isShiny: boolean) {
  const caster = makeUnit('ribombee', 'player', 1)
  caster.hexPos = { col: 3, row: 5 }
  caster.visualPos = { x: 300, y: 500 }
  caster.isShiny = isShiny
  const enemy = makeUnit('dummy', 'enemy', 1)
  enemy.hexPos = { col: 3, row: 2 }
  const ally = makeUnit('dummy', 'player', 1)
  ally.hexPos = { col: 4, row: 5 }
  const state = createCombatState([caster, ally], [enemy])
  ally.currentHp = ally.maxHp / 2   // lower HP so ribombee targets it (dummy has 0 attack, survives)
  return { caster, enemy, ally, state }
}

describe('Shiny Ribombee - Pollen Puff heal/damage ×1.5', () => {
  it('damage projectile baseAmount is ×1.5 for a shiny caster', () => {
    const { caster, state } = setup(true)
    cast(caster, state)
    const dmgProj = [...state.projectiles.values()].find(p => p.abilityId === 'ribombee_pollen_puff' && p.damagePayload)
    expect(dmgProj?.damagePayload?.baseAmount).toBe(Math.round(200 * 1.5))   // tier 1 base 200 → 300
  })

  it('heal projectile amount is ×1.5 for a shiny caster', () => {
    const { caster, state } = setup(true)
    const spMult = computeStats(caster).special / 100
    cast(caster, state)
    const healProj = [...state.projectiles.values()].find(p => p.abilityId === 'ribombee_pollen_puff' && p.healPayload)
    expect(healProj?.healPayload?.amount).toBe(Math.round(100 * spMult * 1.5))
  })

  it('damage projectile baseAmount is unmodified for a non-shiny caster (control)', () => {
    const { caster, state } = setup(false)
    cast(caster, state)
    const dmgProj = [...state.projectiles.values()].find(p => p.abilityId === 'ribombee_pollen_puff' && p.damagePayload)
    expect(dmgProj?.damagePayload?.baseAmount).toBe(200)
  })

  it('heal projectile amount is unmodified for a non-shiny caster (control)', () => {
    const { caster, state } = setup(false)
    const spMult = computeStats(caster).special / 100
    cast(caster, state)
    const healProj = [...state.projectiles.values()].find(p => p.abilityId === 'ribombee_pollen_puff' && p.healPayload)
    expect(healProj?.healPayload?.amount).toBe(Math.round(100 * spMult))
  })

  it('tier 3 shiny damage scales from the tier-3 base (400 → 600)', () => {
    const caster = makeUnit('ribombee', 'player', 3)
    caster.hexPos = { col: 3, row: 5 }
    caster.visualPos = { x: 300, y: 500 }
    caster.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])
    cast(caster, state)
    const dmgProj = [...state.projectiles.values()].find(p => p.abilityId === 'ribombee_pollen_puff' && p.damagePayload)
    expect(dmgProj?.damagePayload?.baseAmount).toBe(Math.round(400 * 1.5))
  })
})
