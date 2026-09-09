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

describe('Shiny Graveler — team-wide +5 armor', () => {
  it('(a) grants a +5 armorBuff status to the shiny Graveler itself', () => {
    const graveler = makeUnit('graveler', 'player', 1)
    graveler.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([graveler], [enemy])

    const self = state.units.get(graveler.id)!
    const fx = self.statusEffects.find(e => e.id === 'armorBuff' && e.sourceUnitId === graveler.id)
    expect(fx).toBeDefined()
    expect(fx?.magnitude).toBe(5)
    expect(fx?.durationTicks).toBe(-1)
  })

  it('(b) grants the same +5 armorBuff to a teammate, not just Graveler', () => {
    const graveler = makeUnit('graveler', 'player', 1)
    graveler.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([graveler, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    const baseDef = 50 // tangela 1-star base defense
    const fx = allyUnit.statusEffects.find(e => e.id === 'armorBuff' && e.sourceUnitId === graveler.id)
    expect(fx).toBeDefined()
    expect(fx?.magnitude).toBe(5)
    expect(computeStats(allyUnit).defense).toBe(baseDef + 5)
  })

  it('(c) does not grant armorBuff to the enemy team', () => {
    const graveler = makeUnit('graveler', 'player', 1)
    graveler.isShiny = true
    const enemy = makeUnit('tangela', 'enemy', 1)
    const state = makeState([graveler], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    const fx = enemyUnit.statusEffects.find(e => e.id === 'armorBuff' && e.sourceUnitId === graveler.id)
    expect(fx).toBeUndefined()
  })

  it('(d) non-shiny control — a non-shiny Graveler grants nothing to its team', () => {
    const graveler = makeUnit('graveler', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([graveler, ally], [enemy])

    const gravelerUnit = state.units.get(graveler.id)!
    const allyUnit = state.units.get(ally.id)!
    expect(gravelerUnit.statusEffects.some(e => e.id === 'armorBuff')).toBe(false)
    expect(allyUnit.statusEffects.some(e => e.id === 'armorBuff')).toBe(false)
  })

  it('(e) test-mode dummies on the team are excluded from the grant', () => {
    const graveler = makeUnit('graveler', 'player', 1)
    graveler.isShiny = true
    const dummy = makeUnit('dummy', 'player', 1)
    dummy.isDummy = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([graveler, dummy], [enemy])

    const dummyUnit = state.units.get(dummy.id)!
    expect(dummyUnit.statusEffects.some(e => e.id === 'armorBuff')).toBe(false)
  })

  it('(f) composes on top of the universal +5% shiny bonus without double-counting — armor comes from the status effect only, once', () => {
    const graveler = makeUnit('graveler', 'player', 1)
    graveler.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([graveler], [enemy])

    const self = state.units.get(graveler.id)!
    const armorFx = self.statusEffects.filter(e => e.id === 'armorBuff' && e.sourceUnitId === graveler.id)
    // Exactly one armorBuff entry — the universal +5% is baked directly into
    // stored defense (unit.defense), not a second armorBuff status effect.
    expect(armorFx).toHaveLength(1)
    // Base 1-star Graveler defense is 65; +5% shiny -> round(65*1.05) = 68, then +5 armorBuff.
    expect(computeStats(self).defense).toBe(68 + 5)
  })
})
