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

describe('Shiny Alolan Marowak — team-wide +20 attack', () => {
  it('(a) grants a +20 dmg_buff status to the shiny Marowak itself', () => {
    const marowak = makeUnit('a_marowak', 'player', 1)
    marowak.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([marowak], [enemy])

    const self = state.units.get(marowak.id)!
    const fx = self.statusEffects.find(e => e.id === 'dmg_buff' && e.sourceUnitId === marowak.id)
    expect(fx).toBeDefined()
    expect(fx?.magnitude).toBe(20)
    expect(fx?.durationTicks).toBe(-1)
  })

  it('(b) grants the same +20 dmg_buff to a teammate, not just itself', () => {
    const marowak = makeUnit('a_marowak', 'player', 1)
    marowak.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([marowak, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    const fx = allyUnit.statusEffects.find(e => e.id === 'dmg_buff' && e.sourceUnitId === marowak.id)
    expect(fx).toBeDefined()
    expect(fx?.magnitude).toBe(20)
    expect(computeStats(allyUnit).attack).toBe(40 + 20) // tangela base attack 40
  })

  it('(c) does not grant dmg_buff to the enemy team', () => {
    const marowak = makeUnit('a_marowak', 'player', 1)
    marowak.isShiny = true
    const enemy = makeUnit('tangela', 'enemy', 1)
    const state = makeState([marowak], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    expect(enemyUnit.statusEffects.some(e => e.id === 'dmg_buff' && e.sourceUnitId === marowak.id)).toBe(false)
  })

  it('(d) non-shiny control — a non-shiny Marowak grants nothing to its team', () => {
    const marowak = makeUnit('a_marowak', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([marowak, ally], [enemy])

    const marowakUnit = state.units.get(marowak.id)!
    const allyUnit = state.units.get(ally.id)!
    expect(marowakUnit.statusEffects.some(e => e.id === 'dmg_buff')).toBe(false)
    expect(allyUnit.statusEffects.some(e => e.id === 'dmg_buff')).toBe(false)
  })

  it('(e) test-mode dummies on the team are excluded from the grant', () => {
    const marowak = makeUnit('a_marowak', 'player', 1)
    marowak.isShiny = true
    const dummy = makeUnit('dummy', 'player', 1)
    dummy.isDummy = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([marowak, dummy], [enemy])

    const dummyUnit = state.units.get(dummy.id)!
    expect(dummyUnit.statusEffects.some(e => e.id === 'dmg_buff')).toBe(false)
  })

  it('(f) composes on top of the universal +5% shiny bonus without double-counting — exactly one dmg_buff entry', () => {
    const marowak = makeUnit('a_marowak', 'player', 1)
    marowak.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([marowak], [enemy])

    const self = state.units.get(marowak.id)!
    const fx = self.statusEffects.filter(e => e.id === 'dmg_buff' && e.sourceUnitId === marowak.id)
    expect(fx).toHaveLength(1)
    // Base 1-star Marowak attack is 70; +5% shiny -> round(70*1.05) = 74, then +20 flat.
    expect(computeStats(self).attack).toBe(74 + 20)
  })
})
