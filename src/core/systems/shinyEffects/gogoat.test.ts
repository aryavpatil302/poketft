import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { getShinyEffect } from '../shinyEffects'
import type { CombatState, Unit } from '../../types'

import '../ability'
import './index'

// Every shiny test file in this batch must include one explicit non-shiny
// control proving the effect does NOT fire without isShiny set — see the
// convention note in the batch plan.

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('Gogoat — shiny registration', () => {
  it('is registered with the expected id and a description', () => {
    const effect = getShinyEffect('gogoat')
    expect(effect).toBeDefined()
    expect(effect!.id).toBe('gogoat_shiny_grass_pelt')
    expect(effect!.description.length).toBeGreaterThan(0)
  })
})

describe('Gogoat — shiny +50 HP to all allies', () => {
  it('shiny Gogoat grants +50 max HP and +50 current HP to himself and every living ally', () => {
    const gogoat = makeUnit('gogoat', 'player', 1)
    gogoat.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const baseGogoatHp = gogoat.maxHp
    const baseAllyHp   = ally.maxHp
    // Gogoat is shiny, so the universal +5% shiny stat passive (initShinyEffects,
    // shinyEffects.ts) runs BEFORE this species effect and bumps his stored
    // maxHp/currentHp first — the +50 here composes on top of that, not the
    // raw pre-shiny base.
    const gogoatHpAfterUniversalBonus = Math.round(baseGogoatHp * 1.05)

    const state = makeState([gogoat, ally], [enemy])

    const gogoatUnit = state.units.get(gogoat.id)!
    const allyUnit    = state.units.get(ally.id)!
    expect(gogoatUnit.maxHp).toBe(gogoatHpAfterUniversalBonus + 50)
    expect(gogoatUnit.currentHp).toBe(gogoatHpAfterUniversalBonus + 50)
    expect(allyUnit.maxHp).toBe(baseAllyHp + 50)
    expect(allyUnit.currentHp).toBe(baseAllyHp + 50)
  })

  it('does not grant the bonus to enemies', () => {
    const gogoat = makeUnit('gogoat', 'player', 1)
    gogoat.isShiny = true
    const enemy = makeUnit('tangela', 'enemy', 1)
    const baseEnemyHp = enemy.maxHp

    const state = makeState([gogoat], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    expect(enemyUnit.maxHp).toBe(baseEnemyHp)
    expect(enemyUnit.currentHp).toBe(baseEnemyHp)
  })

  it('non-shiny control — a non-shiny Gogoat grants no HP bonus to allies', () => {
    const gogoat = makeUnit('gogoat', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const baseGogoatHp = gogoat.maxHp
    const baseAllyHp   = ally.maxHp

    const state = makeState([gogoat, ally], [enemy])

    const gogoatUnit = state.units.get(gogoat.id)!
    const allyUnit    = state.units.get(ally.id)!
    expect(gogoatUnit.maxHp).toBe(baseGogoatHp)
    expect(allyUnit.maxHp).toBe(baseAllyHp)
  })
})
