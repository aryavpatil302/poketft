import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { TICK_RATE } from '../../constants'
import { getShinyEffect } from '../shinyEffects'
import type { CombatState, Unit, AttackModifier } from '../../types'

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

function findPoisonMod(ally: Unit): AttackModifier | undefined {
  return ally.attackModifiers.find(m => m.id === 'sneasler_shiny_poison')
}

describe('Sneasler — shiny registration', () => {
  it('is registered with the expected id and a description', () => {
    const effect = getShinyEffect('sneasler')
    expect(effect).toBeDefined()
    expect(effect!.id).toBe('sneasler_shiny_dire_claw')
    expect(effect!.description.length).toBeGreaterThan(0)
  })
})

describe('Sneasler — shiny poison-on-hit window', () => {
  it('grants every living ally (including Sneasler herself) a poison attack modifier at combat start', () => {
    const sneasler = makeUnit('sneasler', 'player', 1)
    sneasler.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([sneasler, ally], [enemy])

    const sneaslerUnit = state.units.get(sneasler.id)!
    const allyUnit = state.units.get(ally.id)!
    expect(findPoisonMod(sneaslerUnit)).toBeDefined()
    expect(findPoisonMod(allyUnit)).toBeDefined()
  })

  it('does not grant the modifier to enemies', () => {
    const sneasler = makeUnit('sneasler', 'player', 1)
    sneasler.isShiny = true
    const enemy = makeUnit('tangela', 'enemy', 1)

    const state = makeState([sneasler], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    expect(findPoisonMod(enemyUnit)).toBeUndefined()
  })

  it('an ally attack landing within the first 10 seconds applies poison to the enemy hit', () => {
    const sneasler = makeUnit('sneasler', 'player', 1)
    sneasler.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([sneasler, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!
    const enemyUnit = state.units.get(enemy.id)!
    const mod = findPoisonMod(allyUnit)!

    state.tick = 5 * TICK_RATE   // well within the 10s window
    mod.onHit!(allyUnit, enemyUnit, state)

    const poison = enemyUnit.statusEffects.find(fx => fx.stackId === 'sneasler_shiny_poison')
    expect(poison).toBeDefined()
    expect(poison!.id).toBe('poison')
    expect(poison!.sourceUnitId).toBe(allyUnit.id)
  })

  it('an ally attack landing after the first 10 seconds does not apply poison', () => {
    const sneasler = makeUnit('sneasler', 'player', 1)
    sneasler.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([sneasler, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!
    const enemyUnit = state.units.get(enemy.id)!
    const mod = findPoisonMod(allyUnit)!

    state.tick = 10 * TICK_RATE + 1   // just past the window
    mod.onHit!(allyUnit, enemyUnit, state)

    const poison = enemyUnit.statusEffects.find(fx => fx.stackId === 'sneasler_shiny_poison')
    expect(poison).toBeUndefined()
  })

  it('the poison tickEffect deals magic damage each tick to a living target', () => {
    const sneasler = makeUnit('sneasler', 'player', 1)
    sneasler.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([sneasler, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!
    const enemyUnit = state.units.get(enemy.id)!
    const mod = findPoisonMod(allyUnit)!

    state.tick = 0
    mod.onHit!(allyUnit, enemyUnit, state)
    const poison = enemyUnit.statusEffects.find(fx => fx.stackId === 'sneasler_shiny_poison')!
    const hpBefore = enemyUnit.currentHp
    poison.tickEffect!(enemyUnit, state)
    expect(enemyUnit.currentHp).toBeLessThan(hpBefore)
  })

  it('the companion window status effect removes the modifier from attackModifiers onExpire', () => {
    const sneasler = makeUnit('sneasler', 'player', 1)
    sneasler.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([sneasler, ally], [enemy])
    const allyUnit = state.units.get(ally.id)!
    expect(findPoisonMod(allyUnit)).toBeDefined()

    const window = allyUnit.statusEffects.find(fx => fx.id === 'sneasler_shiny_poison_window')!
    expect(window).toBeDefined()
    expect(window.durationTicks).toBe(10 * TICK_RATE)
    window.onExpire!(allyUnit, state)

    expect(findPoisonMod(allyUnit)).toBeUndefined()
  })

  it('non-shiny control — a non-shiny Sneasler grants no poison modifier to allies', () => {
    const sneasler = makeUnit('sneasler', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)

    const state = makeState([sneasler, ally], [enemy])

    const sneaslerUnit = state.units.get(sneasler.id)!
    const allyUnit = state.units.get(ally.id)!
    expect(findPoisonMod(sneaslerUnit)).toBeUndefined()
    expect(findPoisonMod(allyUnit)).toBeUndefined()
  })
})
