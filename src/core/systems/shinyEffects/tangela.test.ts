import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'   // side effect: loads the shinyEffects barrel, registering this batch
import type { Unit } from '../../types'

// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.

describe('Shiny Tangela - team shield', () => {
  it('shields every living ally 75 HP at combat start when the caster is shiny', () => {
    const caster: Unit = makeUnit('tangela', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally: Unit = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster, ally], [enemy])

    expect(caster.shields.some(s => s.sourceAbility === 'shiny_tangela' && s.value === 75)).toBe(true)
    expect(ally.shields.some(s => s.sourceAbility === 'shiny_tangela' && s.value === 75)).toBe(true)
    expect(state.events.some(e => e.type === 'shield' && e.unitId === ally.id && e.amount === 75)).toBe(true)
  })

  it('does NOT shield allies when the caster is not shiny (control)', () => {
    const caster: Unit = makeUnit('tangela', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // isShiny left false/undefined — the control case
    const ally: Unit = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, ally], [enemy])

    expect(caster.shields.some(s => s.sourceAbility === 'shiny_tangela')).toBe(false)
    expect(ally.shields.some(s => s.sourceAbility === 'shiny_tangela')).toBe(false)
  })

  it('does not shield the enemy team', () => {
    const caster: Unit = makeUnit('tangela', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster], [enemy])

    expect(enemy.shields.some(s => s.sourceAbility === 'shiny_tangela')).toBe(false)
  })

  it('does not shield training dummies (isDummy excluded)', () => {
    const caster: Unit = makeUnit('tangela', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const dummyAlly: Unit = makeUnit('dummy', 'player', 1)
    dummyAlly.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, dummyAlly], [enemy])

    expect(dummyAlly.shields.some(s => s.sourceAbility === 'shiny_tangela')).toBe(false)
  })

  it('edge case: solo shiny Tangela (no allies) still shields itself, no throw', () => {
    const caster: Unit = makeUnit('tangela', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    expect(() => createCombatState([caster], [enemy])).not.toThrow()
    expect(caster.shields.some(s => s.sourceAbility === 'shiny_tangela' && s.value === 75)).toBe(true)
  })
})
