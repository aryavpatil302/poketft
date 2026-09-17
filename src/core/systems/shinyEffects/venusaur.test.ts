import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'   // side effect: loads the shinyEffects barrel, registering this batch
import type { Unit } from '../../types'

// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.

describe('Shiny Venusaur - front 2 rows +50 max HP', () => {
  it('grants +50 max HP to allies in the front 2 rows (player rows 4-5) when shiny', () => {
    const caster: Unit = makeUnit('venusaur', 'player', 1)
    caster.hexPos = { col: 3, row: 4 }
    caster.isShiny = true
    const frontAlly: Unit = makeUnit('dummy_melee', 'player', 1)
    frontAlly.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const frontMaxHpBefore = frontAlly.maxHp

    createCombatState([caster, frontAlly], [enemy])

    expect(frontAlly.maxHp).toBe(frontMaxHpBefore + 50)
    expect(frontAlly.currentHp).toBe(frontAlly.maxHp)
  })

  it('does NOT affect an ally outside the front 2 rows (row 7, back of player half)', () => {
    const caster: Unit = makeUnit('venusaur', 'player', 1)
    caster.hexPos = { col: 3, row: 4 }
    caster.isShiny = true
    const backAlly: Unit = makeUnit('dummy_melee', 'player', 1)
    backAlly.hexPos = { col: 4, row: 7 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const backMaxHpBefore = backAlly.maxHp

    createCombatState([caster, backAlly], [enemy])

    expect(backAlly.maxHp).toBe(backMaxHpBefore)
  })

  it('does NOT grant the bonus when the caster is not shiny (control)', () => {
    const caster: Unit = makeUnit('venusaur', 'player', 1)
    caster.hexPos = { col: 3, row: 4 }
    // isShiny left false — the control case
    const frontAlly: Unit = makeUnit('dummy_melee', 'player', 1)
    frontAlly.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const frontMaxHpBefore = frontAlly.maxHp

    createCombatState([caster, frontAlly], [enemy])

    expect(frontAlly.maxHp).toBe(frontMaxHpBefore)
  })

  it('applies front-row targeting relative to enemy team too (rows 2-3)', () => {
    const enemyCaster: Unit = makeUnit('venusaur', 'enemy', 1)
    enemyCaster.hexPos = { col: 3, row: 3 }
    enemyCaster.isShiny = true
    const frontAlly: Unit = makeUnit('dummy_melee', 'enemy', 1)
    frontAlly.hexPos = { col: 4, row: 2 }
    const backAlly: Unit = makeUnit('dummy_melee', 'enemy', 1)
    backAlly.hexPos = { col: 5, row: 0 }
    const player: Unit = makeUnit('dummy', 'player', 1)
    player.hexPos = { col: 3, row: 5 }

    const frontBefore = frontAlly.maxHp
    const backBefore = backAlly.maxHp

    createCombatState([player], [enemyCaster, frontAlly, backAlly])

    expect(frontAlly.maxHp).toBe(frontBefore + 50)
    expect(backAlly.maxHp).toBe(backBefore)
  })
})
