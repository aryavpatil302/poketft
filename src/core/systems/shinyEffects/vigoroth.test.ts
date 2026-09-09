import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'   // side effect: loads the shinyEffects barrel, registering this batch
import { computeStats } from '../../unitFactory'
import type { Unit } from '../../types'

// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.

describe('Shiny Vigoroth - team +10% attack speed', () => {
  it('grants every living ally an atkSpd_buff of magnitude 0.10 when shiny', () => {
    const caster: Unit = makeUnit('vigoroth', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally: Unit = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, ally], [enemy])

    const casterFx = caster.statusEffects.find(fx => fx.id === 'atkSpd_buff' && fx.stackId === `shiny_vigoroth_atkspd_${caster.id}`)
    const allyFx   = ally.statusEffects.find(fx => fx.id === 'atkSpd_buff' && fx.stackId === `shiny_vigoroth_atkspd_${ally.id}`)
    expect(casterFx?.magnitude).toBeCloseTo(0.10)
    expect(allyFx?.magnitude).toBeCloseTo(0.10)
  })

  it('increases computed attackSpeed for a buffed ally', () => {
    const caster: Unit = makeUnit('vigoroth', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally: Unit = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const baseAtkSpd = ally.attackSpeed
    createCombatState([caster, ally], [enemy])

    expect(computeStats(ally).attackSpeed).toBeCloseTo(baseAtkSpd * 1.10, 5)
  })

  it('does NOT buff allies when the caster is not shiny (control)', () => {
    const caster: Unit = makeUnit('vigoroth', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // isShiny left false — the control case
    const ally: Unit = makeUnit('dummy_melee', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, ally], [enemy])

    expect(caster.statusEffects.some(fx => fx.stackId === `shiny_vigoroth_atkspd_${caster.id}`)).toBe(false)
    expect(ally.statusEffects.some(fx => fx.stackId === `shiny_vigoroth_atkspd_${ally.id}`)).toBe(false)
  })

  it('does not buff the enemy team', () => {
    const caster: Unit = makeUnit('vigoroth', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster], [enemy])

    expect(enemy.statusEffects.some(fx => fx.stackId === `shiny_vigoroth_atkspd_${enemy.id}`)).toBe(false)
  })

  it('does not buff training dummies (isDummy excluded)', () => {
    const caster: Unit = makeUnit('vigoroth', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const dummyAlly: Unit = makeUnit('dummy', 'player', 1)
    dummyAlly.hexPos = { col: 4, row: 5 }
    const enemy: Unit = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, dummyAlly], [enemy])

    expect(dummyAlly.statusEffects.some(fx => fx.stackId === `shiny_vigoroth_atkspd_${dummyAlly.id}`)).toBe(false)
  })
})
