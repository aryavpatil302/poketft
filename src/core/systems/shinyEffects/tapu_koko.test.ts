import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { Unit, CombatState } from '../../types'

// New shape introduced by this batch: every shiny-effect test pairs its shiny
// case with an explicit non-shiny control proving the effect does NOT fire
// without unit.isShiny === true.

// Registers this species's shiny effect as a load-time side effect.
import './tapu_koko'
// Ensure all abilities are registered (required by createCombatState).
import '../ability'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

// Tapu-koko's OWN kit (shock_spirit) already sets Electric terrain, which
// independently grants the whole player team +15% attack speed
// (electric_terrain_as) regardless of shiny status — that's pre-existing
// behavior, not part of this batch. It stacks with the shiny team buff via
// computeStats's sequential atkSpd_buff compounding (each stack multiplies
// whatever attackSpeed already accumulated, not the raw base), so the exact
// absolute numbers below reflect both effects together. To isolate what
// THIS shiny effect contributes, the tests assert the effect's own status
// entry directly (id/magnitude/stackId) rather than re-deriving compounded
// arithmetic by hand.
describe('shiny Tapu-koko — team-wide +30% attack speed', () => {

  it('(a) a non-shiny ally on the same team receives the shiny_tapu_koko_atkspd status entry, magnitude 0.30', () => {
    const koko = makeUnit('tapu_koko', 'player', 1)
    koko.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([koko, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    const fx = allyUnit.statusEffects.find(f => f.stackId === 'shiny_tapu_koko_atkspd')
    expect(fx).toBeDefined()
    expect(fx!.id).toBe('atkSpd_buff')
    expect(fx!.magnitude).toBe(0.30)
    expect(fx!.sourceUnitId).toBe(koko.id)
    // Observed end-to-end value (electric terrain's own +15% compounds first,
    // then this shiny +30% compounds on top): 0.50 -> 0.575 -> 0.7475.
    expect(computeStats(allyUnit).attackSpeed).toBeCloseTo(0.7475, 10)
  })

  it('(b) the caster itself is included in the team-wide buff, on top of the universal +5% bonus', () => {
    const koko = makeUnit('tapu_koko', 'player', 1)
    koko.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([koko], [enemy])

    const kokoUnit = state.units.get(koko.id)!
    expect(kokoUnit.statusEffects.some(f => f.stackId === 'shiny_tapu_koko_atkspd')).toBe(true)
    // 0.85 base * 1.05 universal = 0.8925, * 1.15 electric terrain = 1.026375,
    // * 1.30 shiny team buff = 1.3342875 (observed).
    expect(computeStats(kokoUnit).attackSpeed).toBeCloseTo(1.3342875, 10)
  })

  it('(c) the enemy team is unaffected — no status entry, no attack-speed change', () => {
    const koko = makeUnit('tapu_koko', 'player', 1)
    koko.isShiny = true
    const enemy = makeUnit('tangela', 'enemy', 1)
    const state = makeState([koko], [enemy])

    const enemyUnit = state.units.get(enemy.id)!
    expect(computeStats(enemyUnit).attackSpeed).toBeCloseTo(0.50, 10)
    expect(enemyUnit.statusEffects.some(fx => fx.stackId === 'shiny_tapu_koko_atkspd')).toBe(false)
  })

  it('(d) an isDummy ally (test-mode training dummy) is excluded from the buff', () => {
    const koko = makeUnit('tapu_koko', 'player', 1)
    koko.isShiny = true
    const dummyAlly = makeUnit('dummy', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([koko, dummyAlly], [enemy])

    const dummyUnit = state.units.get(dummyAlly.id)!
    expect(dummyUnit.statusEffects.some(fx => fx.stackId === 'shiny_tapu_koko_atkspd')).toBe(false)
  })

  it('(e) non-shiny control — a non-shiny Tapu-koko grants no shiny team buff at all', () => {
    const koko = makeUnit('tapu_koko', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([koko, ally], [enemy])

    const allyUnit = state.units.get(ally.id)!
    const kokoUnit = state.units.get(koko.id)!
    expect(allyUnit.statusEffects.some(fx => fx.stackId === 'shiny_tapu_koko_atkspd')).toBe(false)
    expect(kokoUnit.statusEffects.some(fx => fx.stackId === 'shiny_tapu_koko_atkspd')).toBe(false)
    // Electric terrain's own +15% still fires (unconditional on shiny) —
    // 0.50 base * 1.15 = 0.575, NOT 0.50, so this confirms the ONLY thing
    // missing versus test (a) is the shiny stack, not the terrain buff.
    expect(computeStats(allyUnit).attackSpeed).toBeCloseTo(0.575, 10)
  })
})
