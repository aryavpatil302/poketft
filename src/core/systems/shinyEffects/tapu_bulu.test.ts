import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'   // side effect: loads the shinyEffects barrel, registering this batch
import { tickStatusEffects } from '../statusEffect'
import { TICK_RATE } from '../../constants'
import type { Unit, CombatState } from '../../types'

// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.
// tickInterval gates on state.tick % TICK_RATE === 0 — tickStatusEffects
// must be driven explicitly (same pattern as itemPassives.test.ts).

describe('Shiny Tapu Bulu - self 1% max-HP/sec regen', () => {
  it('registers a shiny_tapu_bulu_regen tickEffect on self when shiny', () => {
    const caster: Unit = makeUnit('tapu_bulu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster], [enemy])

    const fx = caster.statusEffects.find(e => e.stackId === 'shiny_tapu_bulu_regen')
    expect(fx).toBeDefined()
    expect(fx?.durationTicks).toBe(-1)
    expect(fx?.tickInterval).toBe(TICK_RATE)
  })

  it('heals 1% of max HP on each tick boundary', () => {
    const caster: Unit = makeUnit('tapu_bulu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state: CombatState = createCombatState([caster], [enemy])
    caster.currentHp = Math.floor(caster.maxHp * 0.5)
    const before = caster.currentHp

    // Tapu Bulu's own kit carries a separate grassy_terrain_heal tickEffect
    // (tickInterval 120) that also gates on tick 0 — advance to tick 60
    // (a multiple of this regen's 60-tick interval, not of 120) to isolate it.
    state.tick = TICK_RATE
    tickStatusEffects(state.units, state)

    const expectedHeal = Math.max(1, Math.round(caster.maxHp * 0.01))
    expect(caster.currentHp).toBe(before + expectedHeal)
    expect(state.events.some(e => e.type === 'heal' && e.targetId === caster.id)).toBe(true)
  })

  it('does not overheal past max HP', () => {
    const caster: Unit = makeUnit('tapu_bulu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state: CombatState = createCombatState([caster], [enemy])
    // Already full HP (as set by combat start) — tick should not exceed max.
    tickStatusEffects(state.units, state)

    expect(caster.currentHp).toBe(caster.maxHp)
  })

  it('does NOT regen when the unit is not shiny (control)', () => {
    const caster: Unit = makeUnit('tapu_bulu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // isShiny left false — the control case
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster], [enemy])

    expect(caster.statusEffects.some(e => e.stackId === 'shiny_tapu_bulu_regen')).toBe(false)
  })
})
