import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { TICK_RATE } from '../../constants'
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

describe('Shiny Wheezing — 30% Sunder+Shred to every enemy at combat start', () => {
  it('(a) applies sunder_pct and shred_pct at magnitude 0.30 for 15s to a living enemy', () => {
    const wheezing = makeUnit('wheezing', 'player', 1)
    wheezing.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([wheezing], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    const sunder = enemyUnit.statusEffects.find(e => e.id === 'sunder_pct' && e.sourceUnitId === wheezing.id)
    const shred = enemyUnit.statusEffects.find(e => e.id === 'shred_pct' && e.sourceUnitId === wheezing.id)
    expect(sunder).toBeDefined()
    expect(sunder?.magnitude).toBeCloseTo(0.30)
    expect(sunder?.durationTicks).toBe(15 * TICK_RATE)
    expect(shred).toBeDefined()
    expect(shred?.magnitude).toBeCloseTo(0.30)
    expect(shred?.durationTicks).toBe(15 * TICK_RATE)
  })

  it('(b) applies to every living enemy, not just one', () => {
    const wheezing = makeUnit('wheezing', 'player', 1)
    wheezing.isShiny = true
    const e1 = makeUnit('dummy', 'enemy', 1)
    const e2 = makeUnit('dummy', 'enemy', 1)
    const state = makeState([wheezing], [e1, e2])

    const e1Unit = state.units.get(e1.id)!
    const e2Unit = state.units.get(e2.id)!
    expect(e1Unit.statusEffects.some(e => e.id === 'sunder_pct')).toBe(true)
    expect(e2Unit.statusEffects.some(e => e.id === 'sunder_pct')).toBe(true)
  })

  it('(c) does not apply to Wheezing\'s own team', () => {
    const wheezing = makeUnit('wheezing', 'player', 1)
    wheezing.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([wheezing, ally], [enemy])

    const wheezingUnit = state.units.get(wheezing.id)!
    const allyUnit = state.units.get(ally.id)!
    expect(wheezingUnit.statusEffects.some(e => e.id === 'sunder_pct')).toBe(false)
    expect(allyUnit.statusEffects.some(e => e.id === 'sunder_pct')).toBe(false)
  })

  it('(d) edge case — zero enemies on the board is a no-op, does not throw', () => {
    const wheezing = makeUnit('wheezing', 'player', 1)
    wheezing.isShiny = true
    expect(() => makeState([wheezing], [])).not.toThrow()
  })

  it('(e) non-shiny control — a non-shiny Wheezing applies nothing', () => {
    const wheezing = makeUnit('wheezing', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([wheezing], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    expect(enemyUnit.statusEffects.some(e => e.id === 'sunder_pct')).toBe(false)
    expect(enemyUnit.statusEffects.some(e => e.id === 'shred_pct')).toBe(false)
  })

  it('(f) reduces defense and spDefense by 30% via computeStats — actual durability impact', () => {
    const wheezing = makeUnit('wheezing', 'player', 1)
    wheezing.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([wheezing], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    const baseDef = enemyUnit.defense
    const baseSpDef = enemyUnit.spDefense
    const stats = computeStats(enemyUnit)
    expect(stats.defense).toBeCloseTo(baseDef * 0.70)
    expect(stats.spDefense).toBeCloseTo(baseSpDef * 0.70)
  })
})
