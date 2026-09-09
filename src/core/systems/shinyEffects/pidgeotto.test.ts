import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// Registers all abilities (required by createCombatState → initAbilityPassives)
// plus this effect's own registration (module-load side effect of './pidgeotto').
import '../ability'
import './pidgeotto'

// Every shiny-effect test in this batch pairs the shiny case with a
// non-shiny control proving the effect does not fire without isShiny.

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('shinyEffects/pidgeotto — +15 Attack at combat start', () => {
  it('(a) shiny Pidgeotto gains a dmg_buff status of +15 attack, permanent for the fight', () => {
    const shiny = makeUnit('pidgeotto', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny], [enemy])

    const unit = state.units.get(shiny.id)!
    const fx = unit.statusEffects.find(f => f.stackId === 'shiny_pidgeotto_atk')
    expect(fx).toBeDefined()
    expect(fx!.id).toBe('dmg_buff')
    expect(fx!.magnitude).toBe(15)
    expect(fx!.durationTicks).toBe(-1)
  })

  it('(b) the +15 shows up in computed attack, stacked on top of the universal +5% shiny bonus', () => {
    const shiny = makeUnit('pidgeotto', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny], [enemy])

    const unit = state.units.get(shiny.id)!
    // Base attack 65 -> x1.05 universal shiny bump -> 68 (rounded, stored base)
    expect(unit.attack).toBe(68)
    // Then computeStats layers +15 flat from the dmg_buff status -> 83
    expect(computeStats(unit).attack).toBe(83)
  })

  it('(c) non-shiny control — no dmg_buff status, attack stays at raw base', () => {
    const control = makeUnit('pidgeotto', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([control], [enemy])

    const unit = state.units.get(control.id)!
    expect(unit.statusEffects.some(f => f.stackId === 'shiny_pidgeotto_atk')).toBe(false)
    expect(unit.attack).toBe(65)
    expect(computeStats(unit).attack).toBe(65)
  })

  it('(d) a shiny and non-shiny Pidgeotto in the same combat do not cross-contaminate', () => {
    const shiny = makeUnit('pidgeotto', 'player', 1)
    shiny.isShiny = true
    const control = makeUnit('pidgeotto', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny, control], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    const controlUnit = state.units.get(control.id)!
    expect(shinyUnit.statusEffects.some(f => f.stackId === 'shiny_pidgeotto_atk')).toBe(true)
    expect(controlUnit.statusEffects.some(f => f.stackId === 'shiny_pidgeotto_atk')).toBe(false)
  })
})
