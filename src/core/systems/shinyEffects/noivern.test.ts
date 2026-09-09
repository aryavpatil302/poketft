import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

import '../ability'
import './noivern'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('shinyEffects/noivern — all allies +20 Special at combat start', () => {
  it('(a) every living ally, including Noivern itself, gets a sp_buff status of +20', () => {
    const shiny = makeUnit('noivern', 'player', 1)
    shiny.isShiny = true
    const ally = makeUnit('pidgeotto', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny, ally], [enemy])

    const shinyUnit = state.units.get(shiny.id)!
    const allyUnit = state.units.get(ally.id)!

    const shinyFx = shinyUnit.statusEffects.find(f => f.stackId === `shiny_noivern_sp_${shinyUnit.id}`)
    expect(shinyFx).toBeDefined()
    expect(shinyFx!.id).toBe('sp_buff')
    expect(shinyFx!.magnitude).toBe(20)
    expect(shinyFx!.durationTicks).toBe(-1)

    const allyFx = allyUnit.statusEffects.find(f => f.stackId === `shiny_noivern_sp_${allyUnit.id}`)
    expect(allyFx).toBeDefined()
    expect(allyFx!.magnitude).toBe(20)
  })

  it('(b) computed special reflects the buff, stacked on top of the universal +5% shiny bonus', () => {
    const shiny = makeUnit('noivern', 'player', 1)
    shiny.isShiny = true
    const ally = makeUnit('pidgeotto', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    // Pidgeotto base special 100, no shiny bonus (ally is not itself shiny) -> +20 = 120
    expect(allyUnit.special).toBe(100)
    expect(computeStats(allyUnit).special).toBe(120)
  })

  it('(c) enemy team is untouched', () => {
    const shiny = makeUnit('noivern', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('pidgeotto', 'enemy', 1)
    const state = makeState([shiny], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    expect(enemyUnit.statusEffects.some(f => f.stackId?.startsWith('shiny_noivern_sp_'))).toBe(false)
    expect(computeStats(enemyUnit).special).toBe(100)
  })

  it('(d) dummy training units on the same team are skipped', () => {
    const shiny = makeUnit('noivern', 'player', 1)
    shiny.isShiny = true
    const dummyAlly = makeUnit('dummy', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny, dummyAlly], [enemy])

    const dummyUnit = state.units.get(dummyAlly.id)!
    expect(dummyUnit.statusEffects.some(f => f.stackId?.startsWith('shiny_noivern_sp_'))).toBe(false)
  })

  it('(e) no allies besides itself — does not throw, self still buffed', () => {
    const shiny = makeUnit('noivern', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    expect(() => makeState([shiny], [enemy])).not.toThrow()
  })

  it('(f) non-shiny control — no ally gets sp_buff', () => {
    const control = makeUnit('noivern', 'player', 1)
    const ally = makeUnit('pidgeotto', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([control, ally], [enemy])

    const controlUnit = state.units.get(control.id)!
    const allyUnit = state.units.get(ally.id)!
    expect(controlUnit.statusEffects.some(f => f.stackId?.startsWith('shiny_noivern_sp_'))).toBe(false)
    expect(allyUnit.statusEffects.some(f => f.stackId?.startsWith('shiny_noivern_sp_'))).toBe(false)
    expect(allyUnit.special).toBe(100)
  })
})
