import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// New shape being introduced by this batch: shiny-conditional combat
// behavior tests. Every test below sets `isShiny = true` on exactly the
// unit(s) that should be affected, and includes a non-shiny control proving
// the effect does NOT fire without it.
//
// UPDATED SPEC (user-approved simplification): Armarouge's shiny effect is
// +15 attack and +15% attack speed at combat start — not the original
// design doc's "+1 attack permanently on kill" (no mechanism for that in
// this codebase). armarouge.ts is untouched; this is pure Category A.

import './index'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('Shiny Armarouge — self +15 attack, +15% attack speed', () => {
  it('(a) grants a +15 dmg_buff and a 0.15 atkSpd_buff to the shiny Armarouge itself', () => {
    const armarouge = makeUnit('armarouge', 'player', 1)
    armarouge.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([armarouge], [enemy])

    const self = state.units.get(armarouge.id)!
    const atkFx = self.statusEffects.find(e => e.id === 'dmg_buff' && e.sourceUnitId === armarouge.id)
    const spdFx = self.statusEffects.find(e => e.id === 'atkSpd_buff' && e.sourceUnitId === armarouge.id)
    expect(atkFx).toBeDefined()
    expect(atkFx?.magnitude).toBe(15)
    expect(atkFx?.durationTicks).toBe(-1)
    expect(spdFx).toBeDefined()
    expect(spdFx?.magnitude).toBeCloseTo(0.15)
    expect(spdFx?.durationTicks).toBe(-1)
  })

  it('(b) does not grant either buff to a teammate — self-only', () => {
    const armarouge = makeUnit('armarouge', 'player', 1)
    armarouge.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([armarouge, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    expect(allyUnit.statusEffects.some(e => e.id === 'dmg_buff')).toBe(false)
    expect(allyUnit.statusEffects.some(e => e.id === 'atkSpd_buff')).toBe(false)
  })

  it('(c) non-shiny control — a non-shiny Armarouge grants nothing', () => {
    const armarouge = makeUnit('armarouge', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([armarouge], [enemy])

    const self = state.units.get(armarouge.id)!
    expect(self.statusEffects.some(e => e.id === 'dmg_buff')).toBe(false)
    expect(self.statusEffects.some(e => e.id === 'atkSpd_buff')).toBe(false)
  })

  it('(d) composes on top of the universal +5% shiny bonus without double-counting', () => {
    const armarouge = makeUnit('armarouge', 'player', 1)
    armarouge.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([armarouge], [enemy])

    const self = state.units.get(armarouge.id)!
    const atkFx = self.statusEffects.filter(e => e.id === 'dmg_buff' && e.sourceUnitId === armarouge.id)
    const spdFx = self.statusEffects.filter(e => e.id === 'atkSpd_buff' && e.sourceUnitId === armarouge.id)
    expect(atkFx).toHaveLength(1)
    expect(spdFx).toHaveLength(1)

    // Base 1-star Armarouge: attack 50 -> round(50*1.05) = 53 (universal), + 15 flat.
    expect(computeStats(self).attack).toBe(53 + 15)
    // Base attackSpeed 0.75 -> 0.75*1.05 = 0.7875 (universal, unrounded), then
    // +15% fractional on top of the already-shiny-boosted value.
    const shinyAtkSpd = 0.75 * 1.05
    expect(computeStats(self).attackSpeed).toBeCloseTo(shinyAtkSpd * 1.15, 10)
  })
})
