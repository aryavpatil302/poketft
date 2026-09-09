import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// New shape introduced by this batch: every shiny-effect test pairs its shiny
// case with an explicit non-shiny control proving the effect does NOT fire
// without unit.isShiny === true.

import './salamence'
import '../ability'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

describe('shiny Salamence — self full mana + 10% durability at combat start', () => {

  it('(a) shiny Salamence starts combat at full mana instead of startMana', () => {
    const salamence = makeUnit('salamence', 'player', 1)
    salamence.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([salamence], [enemy])

    const unit = state.units.get(salamence.id)!
    expect(unit.currentMana).toBe(unit.maxMana)
    expect(unit.currentMana).toBe(60)
  })

  it('(b) non-shiny control — currentMana stays at startMana (20), no durability buff', () => {
    const salamence = makeUnit('salamence', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([salamence], [enemy])

    const unit = state.units.get(salamence.id)!
    expect(unit.currentMana).toBe(20)
    expect(unit.statusEffects.some(fx => fx.stackId === 'shiny_salamence_durability')).toBe(false)
    expect(computeStats(unit).defense).toBe(70)
    expect(computeStats(unit).spDefense).toBe(55)
  })

  it('(c) 10% durability composes on top of the universal +5% base-stat bump via computeStats', () => {
    const salamence = makeUnit('salamence', 'player', 1)
    salamence.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([salamence], [enemy])

    const unit = state.units.get(salamence.id)!
    // Stored base after universal +5%: defense round(70*1.05)=74, spDefense round(55*1.05)=58.
    // iron_barbs_durability then multiplies both by 1.10 inside computeStats:
    // defense round(74*1.10)=81, spDefense round(58*1.10)=64.
    expect(unit.defense).toBe(74)
    expect(unit.spDefense).toBe(58)
    expect(computeStats(unit).defense).toBe(81)
    expect(computeStats(unit).spDefense).toBe(64)
  })

  it('(d) does not touch attack/special beyond the universal +5% pass', () => {
    const salamence = makeUnit('salamence', 'player', 1)
    salamence.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([salamence], [enemy])

    const unit = state.units.get(salamence.id)!
    // round(95*1.05) = 100, round(100*1.05) = 105
    expect(unit.attack).toBe(100)
    expect(unit.special).toBe(105)
  })
})
