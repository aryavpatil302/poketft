import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// Shiny Excadrill: the whole team (Excadrill included) gains +15% crit
// chance at combat start. Every shiny-effect test in this batch pairs its
// shiny case with a non-shiny control to prove the baseline is unchanged.

// Ensure all abilities are registered (required by createCombatState)
import '../ability'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  return createCombatState(players, enemies)
}

describe('Excadrill shiny — team crit chance', () => {

  it('(a) shiny Excadrill grants +15% crit chance to itself and to allies', () => {
    const excadrill = makeUnit('excadrill', 'player', 1)
    excadrill.hexPos = { col: 2, row: 5 }
    excadrill.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 4, row: 6 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 2, row: 2 }

    const state = makeState([excadrill, ally], [enemy])
    const excadrillUnit = state.units.get(excadrill.id)!
    const allyUnit = state.units.get(ally.id)!

    const baseExcadrillCrit = excadrillUnit.critChance
    const baseAllyCrit = allyUnit.critChance

    expect(computeStats(excadrillUnit).critChance).toBeCloseTo(baseExcadrillCrit + 0.15, 10)
    expect(computeStats(allyUnit).critChance).toBeCloseTo(baseAllyCrit + 0.15, 10)
  })

  it('(b) non-shiny control — no crit chance buff granted to self or allies', () => {
    const excadrill = makeUnit('excadrill', 'player', 1)
    excadrill.hexPos = { col: 2, row: 5 }
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 4, row: 6 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 2, row: 2 }

    const state = makeState([excadrill, ally], [enemy])
    const excadrillUnit = state.units.get(excadrill.id)!
    const allyUnit = state.units.get(ally.id)!

    expect(excadrillUnit.statusEffects.some(fx => fx.stackId?.startsWith('excadrill_shiny_crit_'))).toBe(false)
    expect(allyUnit.statusEffects.some(fx => fx.stackId?.startsWith('excadrill_shiny_crit_'))).toBe(false)
  })

  it('(c) the enemy team never receives the buff — team filter holds', () => {
    const excadrill = makeUnit('excadrill', 'player', 1)
    excadrill.hexPos = { col: 2, row: 5 }
    excadrill.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 2, row: 2 }

    const state = makeState([excadrill], [enemy])
    const enemyUnit = state.units.get(enemy.id)!

    expect(enemyUnit.statusEffects.some(fx => fx.stackId?.startsWith('excadrill_shiny_crit_'))).toBe(false)
  })

  it('(d) edge case — Excadrill with no living allies still buffs itself, no crash', () => {
    const excadrill = makeUnit('excadrill', 'player', 1)
    excadrill.hexPos = { col: 2, row: 5 }
    excadrill.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 2, row: 2 }

    let state: CombatState
    expect(() => { state = makeState([excadrill], [enemy]) }).not.toThrow()
    const excadrillUnit = state!.units.get(excadrill.id)!
    expect(computeStats(excadrillUnit).critChance).toBeCloseTo(excadrillUnit.critChance + 0.15, 10)
  })

  it('(e) a dummy ally (isDummy) is excluded from the buff, same filter used everywhere else', () => {
    const excadrill = makeUnit('excadrill', 'player', 1)
    excadrill.hexPos = { col: 2, row: 5 }
    excadrill.isShiny = true
    const dummyAlly = makeUnit('dummy', 'player', 1)
    dummyAlly.hexPos = { col: 4, row: 6 }
    dummyAlly.isDummy = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 2, row: 2 }

    const state = makeState([excadrill, dummyAlly], [enemy])
    const dummyUnit = state.units.get(dummyAlly.id)!

    expect(dummyUnit.statusEffects.some(fx => fx.stackId?.startsWith('excadrill_shiny_crit_'))).toBe(false)
  })
})
