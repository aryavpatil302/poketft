import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// Shiny Druddigon: allies sharing Druddigon's row gain +10 attack (dmg_buff)
// at combat start. Every shiny-effect test in this batch pairs its shiny
// case with a non-shiny control to prove the baseline is unchanged.

// Ensure all abilities are registered (required by createCombatState)
import '../ability'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = u.hexPos ?? { col: i, row: 5 } })
  enemies.forEach((u, i) => { u.hexPos = u.hexPos ?? { col: i, row: 2 } })
  return createCombatState(players, enemies)
}

describe('Druddigon shiny — row attack buff', () => {

  it('(a) shiny Druddigon grants +10 attack to an ally in the same row', () => {
    const druddigon = makeUnit('druddigon', 'player', 1)
    druddigon.hexPos = { col: 2, row: 5 }
    druddigon.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }   // same row
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([druddigon, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!
    const baseAttack = allyUnit.attack

    expect(computeStats(allyUnit).attack).toBe(baseAttack + 10)
  })

  it('(b) non-shiny control — same-row ally receives no attack buff', () => {
    const druddigon = makeUnit('druddigon', 'player', 1)
    druddigon.hexPos = { col: 2, row: 5 }
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([druddigon, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!

    expect(allyUnit.statusEffects.some(fx => fx.stackId?.startsWith('druddigon_shiny_row_'))).toBe(false)
    expect(computeStats(allyUnit).attack).toBe(allyUnit.attack)
  })

  it('(c) ally in a DIFFERENT row does not receive the buff', () => {
    const druddigon = makeUnit('druddigon', 'player', 1)
    druddigon.hexPos = { col: 2, row: 5 }
    druddigon.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 2, row: 6 }   // different row
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([druddigon, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!

    expect(allyUnit.statusEffects.some(fx => fx.stackId?.startsWith('druddigon_shiny_row_'))).toBe(false)
  })

  it('(d) edge case — Druddigon alone in its row does not throw and grants no buff to itself', () => {
    const druddigon = makeUnit('druddigon', 'player', 1)
    druddigon.hexPos = { col: 2, row: 5 }
    druddigon.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    let state: CombatState
    expect(() => { state = makeState([druddigon], [enemy]) }).not.toThrow()
    const druddigonUnit = state!.units.get(druddigon.id)!
    expect(druddigonUnit.statusEffects.some(fx => fx.stackId?.startsWith('druddigon_shiny_row_'))).toBe(false)
  })

  it('(e) an enemy in the same row is never buffed — team filter holds', () => {
    const druddigon = makeUnit('druddigon', 'player', 1)
    druddigon.hexPos = { col: 2, row: 5 }
    druddigon.isShiny = true
    const enemyInRow = makeUnit('dummy', 'enemy', 1)
    enemyInRow.hexPos = { col: 5, row: 5 }   // shares grid row, opposite team, different hex

    const state = makeState([druddigon], [enemyInRow])
    const enemyUnit = state.units.get(enemyInRow.id)!

    expect(enemyUnit.statusEffects.some(fx => fx.stackId?.startsWith('druddigon_shiny_row_'))).toBe(false)
  })
})
