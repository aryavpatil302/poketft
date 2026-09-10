import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'   // side effect: registers the shinyEffects barrel
import { triggerAbility, tickAbilityCast } from '../ability'
import { tickStatusEffects } from '../statusEffect'
import { TICK_RATE } from '../../constants'
import type { Unit, CombatState } from '../../types'

import '../ability'

// Tier 2: shiny per-species combat effects credit their contribution into the
// same Unit.traitDmg / traitHeal / traitShield tallies the bot-league report
// reads, keyed "shiny:<definitionId>". These tests prove the tag lands for a
// representative shield effect, heal effect, and bonus-damage effect — plus a
// non-shiny control proving the key is absent without isShiny.

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < 20; i++) tickAbilityCast(caster, state)
}

describe('shiny effect contribution tagging', () => {
  it('shiny Tangela credits its team shield to traitShield["shiny:tangela"]', () => {
    const caster = makeUnit('tangela', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, ally], [enemy])

    expect(ally.traitShield['shiny:tangela']).toBeGreaterThan(0)
    expect(caster.traitShield['shiny:tangela']).toBeGreaterThan(0)
  })

  it('non-shiny Tangela does not credit any shiny key (control)', () => {
    const caster = makeUnit('tangela', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    const ally = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, ally], [enemy])

    expect(Object.keys(ally.traitShield).some(k => k.startsWith('shiny:'))).toBe(false)
    expect(Object.keys(caster.traitShield).some(k => k.startsWith('shiny:'))).toBe(false)
  })

  it('shiny Tapu Bulu credits its regen to traitHeal["shiny:tapu_bulu"]', () => {
    const caster = makeUnit('tapu_bulu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [enemy])
    caster.currentHp = Math.floor(caster.maxHp * 0.5)

    state.tick = TICK_RATE
    tickStatusEffects(state.units, state)

    expect(caster.traitHeal['shiny:tapu_bulu']).toBeGreaterThan(0)
  })

  it('shiny Abomasnow credits its x1.3 burst bonus to traitDmg["shiny:abomasnow"]', () => {
    const caster = makeUnit('abomasnow', 'player', 1)
    caster.hexPos = { col: 3, row: 6 }
    caster.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [enemy])
    cast(caster, state)

    expect(caster.traitDmg['shiny:abomasnow']).toBeGreaterThan(0)
  })

  it('non-shiny Abomasnow does not credit a shiny damage key (control)', () => {
    const caster = makeUnit('abomasnow', 'player', 1)
    caster.hexPos = { col: 3, row: 6 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [enemy])
    cast(caster, state)

    expect(Object.keys(caster.traitDmg).some(k => k.startsWith('shiny:'))).toBe(false)
  })
})
