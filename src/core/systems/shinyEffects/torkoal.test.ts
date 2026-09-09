import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// New shape being introduced by this batch: shiny-conditional combat
// behavior tests. Every test below sets `isShiny = true` on exactly the
// unit(s) that should be affected, and includes a non-shiny control proving
// the effect does NOT fire without it.

import './index'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('Shiny Torkoal — self +20 armor', () => {
  it('(a) grants a +20 armorBuff status to the shiny Torkoal itself', () => {
    const torkoal = makeUnit('torkoal', 'player', 1)
    torkoal.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([torkoal], [enemy])

    const self = state.units.get(torkoal.id)!
    const fx = self.statusEffects.find(e => e.id === 'armorBuff' && e.sourceUnitId === torkoal.id)
    expect(fx).toBeDefined()
    expect(fx?.magnitude).toBe(20)
    expect(fx?.durationTicks).toBe(-1)
  })

  it('(b) does not grant armorBuff to a teammate — self-only', () => {
    const torkoal = makeUnit('torkoal', 'player', 1)
    torkoal.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([torkoal, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    expect(allyUnit.statusEffects.some(e => e.id === 'armorBuff')).toBe(false)
  })

  it('(c) non-shiny control — a non-shiny Torkoal grants nothing', () => {
    const torkoal = makeUnit('torkoal', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([torkoal], [enemy])

    const self = state.units.get(torkoal.id)!
    expect(self.statusEffects.some(e => e.id === 'armorBuff')).toBe(false)
  })

  it('(d) composes on top of the universal +5% shiny bonus without double-counting — armor comes from the status effect once', () => {
    const torkoal = makeUnit('torkoal', 'player', 1)
    torkoal.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([torkoal], [enemy])

    const self = state.units.get(torkoal.id)!
    const armorFx = self.statusEffects.filter(e => e.id === 'armorBuff' && e.sourceUnitId === torkoal.id)
    expect(armorFx).toHaveLength(1)
    // Base 1-star Torkoal defense is 70; +5% shiny -> round(70*1.05) = 74, then +20 armorBuff.
    expect(computeStats(self).defense).toBe(74 + 20)
  })
})
