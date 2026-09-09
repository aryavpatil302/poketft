import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// New shape introduced by this batch: every shiny-effect test pairs its shiny
// case with an explicit non-shiny control proving the effect does NOT fire
// without unit.isShiny === true.

import './latias'
import '../ability'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

describe('shiny Latias — self spDefense ×1.5, composed after the universal +5% bonus', () => {

  it('(a) shiny Latias ends combat-start with spDefense = round(round(85*1.05) * 1.5)', () => {
    const latias = makeUnit('latias', 'player', 1)
    latias.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latias], [enemy])

    const unit = state.units.get(latias.id)!
    // base 85 -> universal +5%: round(89.25) = 89 -> shiny effect x1.5: round(133.5) = 134
    expect(unit.spDefense).toBe(134)
  })

  it('(b) non-shiny control — spDefense stays at the raw base (85), no universal bonus and no ×1.5', () => {
    const latias = makeUnit('latias', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latias], [enemy])

    const unit = state.units.get(latias.id)!
    expect(unit.spDefense).toBe(85)
  })

  it('(c) _computedStats is invalidated so the new spDefense is visible on the very first tick', () => {
    const latias = makeUnit('latias', 'player', 1)
    latias.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latias], [enemy])

    const unit = state.units.get(latias.id)!
    // A lone Latias also triggers her own Soul Bonded kit passive (team +10
    // flat sp. defense, self included — traitEffects.ts's applySoulBonded),
    // which is unconditional on shiny and layers on top via computeStats:
    // 134 + 10 = 144. The raw field (134, asserted in (a) above) is what
    // THIS shiny effect alone produced.
    expect(computeStats(unit).spDefense).toBe(144)
  })

  it('(d) does not touch other stats (attack, special, defense) beyond the universal +5% pass', () => {
    const latias = makeUnit('latias', 'player', 1)
    latias.isShiny = true
    const control = makeUnit('latias', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([latias, control], [enemy])

    const unit = state.units.get(latias.id)!
    const controlUnit = state.units.get(control.id)!
    // Universal +5% only — round(70*1.05) = 74, round(100*1.05) = 105, round(75*1.05) = 79
    expect(unit.attack).toBe(74)
    expect(unit.special).toBe(105)
    expect(unit.defense).toBe(79)
    // Non-shiny control is unaffected entirely.
    expect(controlUnit.attack).toBe(70)
    expect(controlUnit.special).toBe(100)
    expect(controlUnit.defense).toBe(75)
    expect(controlUnit.spDefense).toBe(85)
  })
})
