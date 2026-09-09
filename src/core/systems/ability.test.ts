import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from './ability'
import type { Unit, CombatState } from '../types'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Shiny Runerigus's Wandering Spirit mark drains the marked target's mana fully
// (currentMana = 0) instead of the non-shiny half-drain when the mark is consumed.
describe('triggerAbility - Wandering Spirit shiny mana drain', () => {
  let caster: Unit
  let target: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('runerigus', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    target = makeUnit('oranguru', 'enemy', 1)
    target.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [target])
  })

  it('drains the marked target to 0 mana when the applying Runerigus is shiny', () => {
    caster.isShiny = true
    cast(caster, state)
    target.currentMana = target.maxMana
    triggerAbility(target, state)
    expect(target.currentMana).toBe(0)
  })

  it('drains the marked target to exactly 50% mana when the applying Runerigus is NOT shiny (regression: unchanged from pre-shiny behavior)', () => {
    caster.isShiny = false
    cast(caster, state)
    target.currentMana = target.maxMana
    triggerAbility(target, state)
    expect(target.currentMana).toBe(Math.round(target.maxMana * 0.5))
  })

  it('still applies mana lock regardless of shiny status', () => {
    caster.isShiny = true
    cast(caster, state)
    target.currentMana = target.maxMana
    triggerAbility(target, state)
    expect(target.manaLockTimer).toBeGreaterThan(0)
  })
})
