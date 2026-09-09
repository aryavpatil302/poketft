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

function hasDmgBuffFrom(unit: Unit, sourceId: string): boolean {
  return unit.statusEffects.some(fx => fx.id === 'dmg_buff' && fx.sourceUnitId === sourceId && fx.magnitude === 10)
}

describe('Shiny Drednaw — melee ally attack buff', () => {
  it('grants +10 dmg_buff to a melee ally (range 1) at combat start', () => {
    const shiny = makeUnit('drednaw', 'player', 1)
    shiny.isShiny = true
    const meleeAlly = makeUnit('quagsire', 'player', 1)  // river ally, range 1
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny, meleeAlly], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    const allyUnit = state.units.get(meleeAlly.id)!
    expect(hasDmgBuffFrom(allyUnit, shinyUnit.id)).toBe(true)
    expect(allyUnit.range).toBe(1)
  })

  it('grants the buff to the shiny caster itself (Drednaw is melee, range 1)', () => {
    const shiny = makeUnit('drednaw', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    expect(hasDmgBuffFrom(shinyUnit, shinyUnit.id)).toBe(true)
  })

  it('edge case: excludes a ranged ally (range > 1) from the buff', () => {
    const shiny = makeUnit('drednaw', 'player', 1)
    shiny.isShiny = true
    const rangedAlly = makeUnit('ribombee', 'player', 1)  // range 4
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([shiny, rangedAlly], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    const allyUnit = state.units.get(rangedAlly.id)!
    expect(allyUnit.range).toBeGreaterThan(1)
    expect(hasDmgBuffFrom(allyUnit, shinyUnit.id)).toBe(false)
  })

  it('non-shiny control: a non-shiny Drednaw grants no buff to melee allies', () => {
    const control = makeUnit('drednaw', 'player', 1)
    const meleeAlly = makeUnit('quagsire', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = place([control, meleeAlly], [enemy])

    const controlUnit = state.units.get(control.id)!
    const allyUnit = state.units.get(meleeAlly.id)!
    expect(allyUnit.statusEffects.some(fx => fx.id === 'dmg_buff' && fx.sourceUnitId === controlUnit.id)).toBe(false)
    expect(controlUnit.statusEffects.some(fx => fx.id === 'dmg_buff' && fx.sourceUnitId === controlUnit.id)).toBe(false)
  })

  it('does not buff enemy-team units, even melee ones', () => {
    const shiny = makeUnit('drednaw', 'player', 1)
    shiny.isShiny = true
    const enemyMelee = makeUnit('quagsire', 'enemy', 1)  // enemy team, still range 1

    const state = place([shiny], [enemyMelee])

    const shinyUnit = state.units.get(shiny.id)!
    const enemyUnit = state.units.get(enemyMelee.id)!
    expect(hasDmgBuffFrom(enemyUnit, shinyUnit.id)).toBe(false)
  })
})
