import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'   // side effect: loads the shinyEffects barrel, registering this batch
import { tickStatusEffects } from '../statusEffect'
import { TICK_RATE } from '../../constants'
import type { Unit, CombatState } from '../../types'

// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.
// tickInterval gates on state.tick % TICK_RATE === 0 — createCombatState
// itself does not tick status effects, so tickStatusEffects must be driven
// explicitly in these tests (same pattern as itemPassives.test.ts).

describe('Shiny Toucannon - 15s burn on every enemy at combat start', () => {
  it('applies a shiny_toucannon_burn status effect (15s duration) to every living enemy when shiny', () => {
    const caster: Unit = makeUnit('toucannon', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster], [enemy])

    const fx = enemy.statusEffects.find(e => e.stackId === 'shiny_toucannon_burn')
    expect(fx).toBeDefined()
    expect(fx?.durationTicks).toBe(15 * TICK_RATE)
  })

  it('burn tick deals true damage to the enemy over time', () => {
    const caster: Unit = makeUnit('toucannon', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state: CombatState = createCombatState([caster], [enemy])
    const hpBefore = enemy.currentHp

    // state.tick starts at 0 — 0 % TICK_RATE === 0, so the first explicit
    // tickStatusEffects call fires the burn immediately.
    tickStatusEffects(state.units, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    expect(state.events.some(e => e.type === 'damage' && e.targetId === enemy.id && e.abilityId === 'shiny_toucannon')).toBe(true)

    const afterFirstTick = enemy.currentHp
    state.tick = TICK_RATE
    tickStatusEffects(state.units, state)
    expect(enemy.currentHp).toBeLessThan(afterFirstTick)
  })

  it('does NOT burn enemies when the caster is not shiny (control)', () => {
    const caster: Unit = makeUnit('toucannon', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // isShiny left false — the control case
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster], [enemy])

    expect(enemy.statusEffects.some(e => e.stackId === 'shiny_toucannon_burn')).toBe(false)
  })

  it('does not burn allies', () => {
    const caster: Unit = makeUnit('toucannon', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally: Unit = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, ally], [enemy])

    expect(ally.statusEffects.some(e => e.stackId === 'shiny_toucannon_burn')).toBe(false)
  })

  it('edge case: a burn tick that would kill the enemy marks it dead without throwing', () => {
    const caster: Unit = makeUnit('toucannon', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [enemy])
    enemy.currentHp = 1   // one tick of burn is lethal

    expect(() => tickStatusEffects(state.units, state)).not.toThrow()
    expect(enemy.state).toBe('dead')
    expect(enemy.currentHp).toBe(0)
    expect(state.events.some(e => e.type === 'death' && e.unitId === enemy.id && e.abilityId === 'shiny_toucannon')).toBe(true)
  })
})
