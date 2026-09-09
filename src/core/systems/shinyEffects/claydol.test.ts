import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { TICK_RATE } from '../../constants'
import '../../systems/ability'

// Every test sets unit.isShiny = true on exactly the caster that should
// trigger the effect, and includes one explicit non-shiny control case
// proving the effect does NOT fire without it.

describe('Shiny Claydol — team mana font', () => {
  it('grants every living ally a +1/sec mana regen tickEffect at combat start', () => {
    const caster = makeUnit('claydol', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster, ally], [enemy])

    const casterFx = caster.statusEffects.find(fx => fx.stackId === `shiny_claydol_mana_font_${caster.id}`)
    const allyFx = ally.statusEffects.find(fx => fx.stackId === `shiny_claydol_mana_font_${ally.id}`)
    expect(casterFx).toBeDefined()
    expect(allyFx).toBeDefined()
    expect(allyFx?.tickInterval).toBe(TICK_RATE)

    ally.currentMana = 0
    allyFx!.tickEffect!(ally, state)
    expect(ally.currentMana).toBe(1)
  })

  it('does not push mana above maxMana', () => {
    const caster = makeUnit('claydol', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster, ally], [enemy])
    const allyFx = ally.statusEffects.find(fx => fx.stackId === `shiny_claydol_mana_font_${ally.id}`)!
    ally.currentMana = ally.maxMana
    allyFx.tickEffect!(ally, state)
    expect(ally.currentMana).toBe(ally.maxMana)
  })

  it('edge case: unit with maxMana 0 is a safe no-op tick (never throws, mana stays 0)', () => {
    const caster = makeUnit('claydol', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster, ally], [enemy])
    const allyFx = ally.statusEffects.find(fx => fx.stackId === `shiny_claydol_mana_font_${ally.id}`)!
    ally.maxMana = 0
    ally.currentMana = 0
    expect(() => allyFx.tickEffect!(ally, state)).not.toThrow()
    expect(ally.currentMana).toBe(0)
  })

  it('does NOT grant mana regen to allies when Claydol is not shiny (control case)', () => {
    const caster = makeUnit('claydol', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = false
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, ally], [enemy])

    expect(ally.statusEffects.some(fx => fx.id === 'shiny_claydol_mana_font')).toBe(false)
    expect(caster.statusEffects.some(fx => fx.id === 'shiny_claydol_mana_font')).toBe(false)
  })
})
