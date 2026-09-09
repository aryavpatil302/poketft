import { describe, it, expect } from 'vitest'
// Shiny-conditional combat behavior test: sets isShiny = true on exactly the
// unit(s) that should be affected, and includes a non-shiny control proving
// the effect does not fire without it.
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import '../shinyEffects/index'
import type { Unit } from '../../types'

function hasDamageAmp(unit: Unit): boolean {
  return unit.statusEffects.some(fx => fx.id === 'damage_amp' && fx.magnitude === 0.05)
}

describe('Shiny Celebi - back 2 rows damage amp', () => {
  it('grants +5% damage_amp to allies in the caster\'s own back 2 rows (player: rows 4-5)', () => {
    const caster = makeUnit('celebi', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const backAlly = makeUnit('morgrem', 'player', 1)
    backAlly.hexPos = { col: 1, row: 5 }

    createCombatState([caster, backAlly], [])

    expect(hasDamageAmp(caster)).toBe(true)
    expect(hasDamageAmp(backAlly)).toBe(true)
  })

  it('excludes an ally NOT in the back 2 rows (player front rows 6-7)', () => {
    const caster = makeUnit('celebi', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const frontAlly = makeUnit('morgrem', 'player', 1)
    frontAlly.hexPos = { col: 1, row: 7 }

    createCombatState([caster, frontAlly], [])

    expect(hasDamageAmp(frontAlly)).toBe(false)
  })

  it('does not affect the enemy team, even one standing in the mirrored back rows', () => {
    const caster = makeUnit('celebi', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    // Enemy back rows (mirrored) are 2-3 — placing the enemy there proves
    // the team filter, not just the row filter, gates eligibility.
    const enemy = makeUnit('morgrem', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 2 }

    createCombatState([caster], [enemy])

    expect(hasDamageAmp(enemy)).toBe(false)
  })

  it('non-shiny control: a non-shiny Celebi grants no bonus to anyone', () => {
    const caster = makeUnit('celebi', 'player', 1)
    // isShiny intentionally left unset
    caster.hexPos = { col: 0, row: 4 }
    const backAlly = makeUnit('morgrem', 'player', 1)
    backAlly.hexPos = { col: 1, row: 5 }

    createCombatState([caster, backAlly], [])

    expect(hasDamageAmp(caster)).toBe(false)
    expect(hasDamageAmp(backAlly)).toBe(false)
  })
})
