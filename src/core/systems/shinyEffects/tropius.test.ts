import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'   // side effect: loads the shinyEffects barrel, registering this batch
import type { Unit } from '../../types'

// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.

describe('Shiny Tropius - team +100 max HP', () => {
  it('grants +100 max HP to every living ally, regardless of row, when shiny', () => {
    const caster: Unit = makeUnit('tropius', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const frontAlly: Unit = makeUnit('dummy_melee', 'player', 1)
    frontAlly.hexPos = { col: 4, row: 7 }
    const backAlly: Unit = makeUnit('dummy_melee', 'player', 1)
    backAlly.hexPos = { col: 5, row: 4 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const frontBefore = frontAlly.maxHp
    const backBefore  = backAlly.maxHp
    const casterBefore = caster.maxHp

    createCombatState([caster, frontAlly, backAlly], [enemy])

    // The caster is itself shiny, so it also gets the universal +5% shiny
    // stat bump (applied before Tropius's own onCombatStart) on top of +100.
    expect(caster.maxHp).toBe(Math.round(casterBefore * 1.05) + 100)
    expect(frontAlly.maxHp).toBe(frontBefore + 100)
    expect(backAlly.maxHp).toBe(backBefore + 100)
    expect(caster.currentHp).toBe(caster.maxHp)
  })

  it('does NOT grant the bonus when the caster is not shiny (control)', () => {
    const caster: Unit = makeUnit('tropius', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // isShiny left false — the control case
    const ally: Unit = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const allyBefore = ally.maxHp

    createCombatState([caster, ally], [enemy])

    expect(ally.maxHp).toBe(allyBefore)
  })

  it('does not affect the enemy team', () => {
    const caster: Unit = makeUnit('tropius', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const enemyBefore = enemy.maxHp

    createCombatState([caster], [enemy])

    expect(enemy.maxHp).toBe(enemyBefore)
  })
})
