import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// Import to ensure the shiny effect registry is populated. Registration is
// a module-load side effect of importing this directory's barrel directly
// (shinyEffects.ts deliberately does NOT import the barrel itself, to avoid
// a circular import — see the comment in shinyEffects.ts).
import './index'

// Shiny-conditional combat behavior test: every case below sets isShiny =
// true on exactly the unit that should be affected, and includes a
// non-shiny control proving the effect does NOT fire without it.

function place(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('Shiny Bellibolt — self max HP bonus', () => {
  it('gains +300 max HP (on top of the universal +5% bonus) and starts at full health', () => {
    const shiny = makeUnit('bellibolt', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny], [enemy])
    const shinyUnit = state.units.get(shiny.id)!

    // Base Bellibolt hp=900. Universal shiny +5% -> round(900*1.05)=945.
    // Then +300 flat -> 1245.
    expect(shinyUnit.maxHp).toBe(1245)
    expect(shinyUnit.currentHp).toBe(shinyUnit.maxHp)
  })

  it('non-shiny control: a non-shiny Bellibolt keeps its raw base maxHp (900), unaffected', () => {
    const control = makeUnit('bellibolt', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([control], [enemy])
    const controlUnit = state.units.get(control.id)!

    expect(controlUnit.maxHp).toBe(900)
    expect(controlUnit.currentHp).toBe(900)
  })

  it('does not affect allies — only self gains the bonus', () => {
    const shiny = makeUnit('bellibolt', 'player', 1)
    shiny.isShiny = true
    const ally = makeUnit('quagsire', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!

    // Quagsire base hp=1100, untouched by Bellibolt's shiny effect.
    expect(allyUnit.maxHp).toBe(1100)
  })

  it('edge case: composes correctly at 2-star tier (tier scaling -> +5% -> +300, in that order)', () => {
    const shiny2 = makeUnit('bellibolt', 'player', 2)
    shiny2.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny2], [enemy])
    const shinyUnit = state.units.get(shiny2.id)!

    // 900 -> 1620 via star-2 1.8x, then x1.05 -> 1701, then +300 -> 2001.
    expect(shinyUnit.maxHp).toBe(2001)
    expect(shinyUnit.currentHp).toBe(shinyUnit.maxHp)
  })
})
