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

function hasSpDefBuffFrom(unit: Unit, sourceId: string): boolean {
  return unit.statusEffects.some(fx => fx.id === 'spDefBuff' && fx.sourceUnitId === sourceId && fx.magnitude === 20)
}

describe('Shiny Quagsire — team Sp. Def buff', () => {
  it('grants +20 spDefBuff to every living ally at combat start', () => {
    const shiny = makeUnit('quagsire', 'player', 1)
    shiny.isShiny = true
    const ally1 = makeUnit('drednaw', 'player', 1)
    const ally2 = makeUnit('bellibolt', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny, ally1, ally2], [enemy])
    const shinyUnit = state.units.get(shiny.id)!

    expect(hasSpDefBuffFrom(state.units.get(ally1.id)!, shinyUnit.id)).toBe(true)
    expect(hasSpDefBuffFrom(state.units.get(ally2.id)!, shinyUnit.id)).toBe(true)
  })

  it('grants the buff to the shiny caster itself (self counts as an ally)', () => {
    const shiny = makeUnit('quagsire', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny], [enemy])
    const shinyUnit = state.units.get(shiny.id)!

    expect(hasSpDefBuffFrom(shinyUnit, shinyUnit.id)).toBe(true)
  })

  it('non-shiny control: a non-shiny Quagsire grants no buff to itself or allies', () => {
    const control = makeUnit('quagsire', 'player', 1)
    const ally = makeUnit('drednaw', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([control, ally], [enemy])
    const controlUnit = state.units.get(control.id)!
    const allyUnit = state.units.get(ally.id)!

    expect(hasSpDefBuffFrom(controlUnit, controlUnit.id)).toBe(false)
    expect(hasSpDefBuffFrom(allyUnit, controlUnit.id)).toBe(false)
  })

  it('does not buff enemy-team units', () => {
    const shiny = makeUnit('quagsire', 'player', 1)
    shiny.isShiny = true
    const enemyUnitSrc = makeUnit('drednaw', 'enemy', 1)

    const state = place([shiny], [enemyUnitSrc])
    const shinyUnit = state.units.get(shiny.id)!
    const enemyUnit = state.units.get(enemyUnitSrc.id)!

    expect(hasSpDefBuffFrom(enemyUnit, shinyUnit.id)).toBe(false)
  })

  it('edge case: solo Quagsire with no other allies and only an enemy on the board — self still gets the buff, no crash', () => {
    const shiny = makeUnit('quagsire', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    let state: CombatState
    expect(() => { state = place([shiny], [enemy]) }).not.toThrow()
    const shinyUnit = state!.units.get(shiny.id)!
    expect(hasSpDefBuffFrom(shinyUnit, shinyUnit.id)).toBe(true)
  })
})
