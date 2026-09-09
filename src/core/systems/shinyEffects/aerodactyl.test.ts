import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../ability'
import { getShinyEffect } from '../shinyEffects'
import type { CombatState, Unit } from '../../types'

import '../ability'
import './index'

// Every shiny test file in this batch must include one explicit non-shiny
// control proving the effect does NOT fire without isShiny set — see the
// convention note in the batch plan.

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Aerodactyl — shiny registration', () => {
  it('is registered with the expected id and a description', () => {
    const effect = getShinyEffect('aerodactyl')
    expect(effect).toBeDefined()
    expect(effect!.id).toBe('aerodactyl_shiny_ancient_power')
    expect(effect!.description.length).toBeGreaterThan(0)
  })
})

describe('Aerodactyl — shiny full mana + range override', () => {
  let caster: Unit
  let enemy: Unit

  beforeEach(() => {
    caster = makeUnit('aerodactyl', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
  })

  it('shiny Aerodactyl starts combat with full mana', () => {
    caster.isShiny = true
    // Confirm mana does not already start full for this species (otherwise
    // the assertion below would be meaningless).
    expect(caster.currentMana).toBeLessThan(caster.maxMana)
    const state = createCombatState([caster], [enemy])
    const unit = state.units.get(caster.id)!
    expect(unit.currentMana).toBe(unit.maxMana)
  })

  it('non-shiny control — Aerodactyl does not start combat with full mana', () => {
    const state = createCombatState([caster], [enemy])
    const unit = state.units.get(caster.id)!
    expect(unit.currentMana).toBeLessThan(unit.maxMana)
  })

  it('shiny Aerodactyl gains +2 range from Ancient Power (instead of +1)', () => {
    caster.isShiny = true
    const state = createCombatState([caster], [enemy])
    const unit = state.units.get(caster.id)!
    const baseRange = unit.range
    cast(unit, state)
    expect(unit.range).toBe(baseRange + 2)
  })

  it('non-shiny control — Aerodactyl gains +1 range from Ancient Power', () => {
    const state = createCombatState([caster], [enemy])
    const unit = state.units.get(caster.id)!
    const baseRange = unit.range
    cast(unit, state)
    expect(unit.range).toBe(baseRange + 1)
  })

  it('shiny range bonus does not stack further on a second cast', () => {
    caster.isShiny = true
    const state = createCombatState([caster], [enemy])
    const unit = state.units.get(caster.id)!
    const baseRange = unit.range
    cast(unit, state)
    unit.currentMana = unit.maxMana
    cast(unit, state)
    expect(unit.range).toBe(baseRange + 2)
  })
})
