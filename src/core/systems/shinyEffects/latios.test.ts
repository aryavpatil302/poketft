import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// New shape introduced by this batch: every shiny-effect test pairs its shiny
// case with an explicit non-shiny control proving the effect does NOT fire
// without unit.isShiny === true.

import './latios'
import '../ability'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

describe('shiny Latios — self special ×1.5, composed after the universal +5% bonus', () => {

  it('(a) shiny Latios ends combat-start with special = round(round(100*1.05) * 1.5)', () => {
    const latios = makeUnit('latios', 'player', 1)
    latios.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latios], [enemy])

    const unit = state.units.get(latios.id)!
    // base 100 -> universal +5%: round(105) = 105 -> shiny effect x1.5: round(157.5) = 158
    expect(unit.special).toBe(158)
  })

  it('(b) non-shiny control — special stays at the raw base (100), no universal bonus and no ×1.5', () => {
    const latios = makeUnit('latios', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latios], [enemy])

    const unit = state.units.get(latios.id)!
    expect(unit.special).toBe(100)
  })

  it('(c) _computedStats is invalidated so the new special is visible on the very first tick', () => {
    const latios = makeUnit('latios', 'player', 1)
    latios.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latios], [enemy])

    const unit = state.units.get(latios.id)!
    // A lone Latios also triggers his own Soul Bonded kit passive (team +10%
    // special, self included — traitEffects.ts's applySoulBonded), which is
    // unconditional on shiny and layers on top via computeStats:
    // round(158 * 1.10) = round(173.8) = 174. The raw field (158, asserted in
    // (a) above) is what THIS shiny effect alone produced.
    expect(computeStats(unit).special).toBe(174)
  })

  it('(d) does not touch other stats (attack, defense, spDefense) beyond the universal +5% pass', () => {
    const latios = makeUnit('latios', 'player', 1)
    latios.isShiny = true
    const control = makeUnit('latios', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latios, control], [enemy])

    const unit = state.units.get(latios.id)!
    const controlUnit = state.units.get(control.id)!
    // Universal +5% only — round(70*1.05) = 74, round(55*1.05) = 58, round(70*1.05) = 74 (spDefense)
    expect(unit.attack).toBe(74)
    expect(unit.defense).toBe(58)
    expect(unit.spDefense).toBe(74)
    // Non-shiny control is unaffected entirely.
    expect(controlUnit.attack).toBe(70)
    expect(controlUnit.special).toBe(100)
    expect(controlUnit.defense).toBe(55)
    expect(controlUnit.spDefense).toBe(70)
  })
})
