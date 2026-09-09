import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../ability'
import type { Unit, CombatState } from '../../types'

// Shiny Zubat: Poison Sting's poison-per-tick damage is doubled at its single
// computation site in abilities/zubat.ts. Every shiny-effect test in this
// batch pairs its shiny case with a non-shiny control to prove the baseline
// is unchanged.

// Ensure all abilities are registered (required by createCombatState)
import '../ability'

function cast(caster: Unit, state: CombatState, castTicks = 15): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

function makeScenario(shiny: boolean): { caster: Unit; enemy: Unit; state: CombatState } {
  const caster = makeUnit('zubat', 'player', 1)
  caster.hexPos = { col: 3, row: 5 }
  caster.isShiny = shiny
  const enemy = makeUnit('dummy', 'enemy', 1)
  enemy.hexPos = { col: 3, row: 2 }
  const state = createCombatState([caster], [enemy])
  return { caster, enemy, state }
}

describe('Zubat shiny — doubled poison', () => {

  it('(a) shiny Zubat tier-1 poison ticks for double the non-shiny amount (10 vs 5)', () => {
    const shiny = makeScenario(true)
    cast(shiny.caster, shiny.state)
    const shinyProj = [...shiny.state.projectiles.values()][0]
    shinyProj.onHit!(shiny.caster, shiny.enemy, shiny.state)
    const shinyPoison = shiny.enemy.statusEffects.find(e => e.id === 'zubat_poison')!
    const shinyHpBefore = shiny.enemy.currentHp
    shinyPoison.tickEffect!(shiny.enemy, shiny.state)
    expect(shinyHpBefore - shiny.enemy.currentHp).toBe(10)

    const control = makeScenario(false)
    cast(control.caster, control.state)
    const controlProj = [...control.state.projectiles.values()][0]
    controlProj.onHit!(control.caster, control.enemy, control.state)
    const controlPoison = control.enemy.statusEffects.find(e => e.id === 'zubat_poison')!
    const controlHpBefore = control.enemy.currentHp
    controlPoison.tickEffect!(control.enemy, control.state)
    expect(controlHpBefore - control.enemy.currentHp).toBe(5)
  })

  it('(b) non-shiny control alone — poison damage matches the pre-shiny baseline exactly', () => {
    const { caster, enemy, state } = makeScenario(false)
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'zubat_poison')!
    const hpBefore = enemy.currentHp
    poison.tickEffect!(enemy, state)
    expect(enemy.currentHp).toBe(hpBefore - 5)
  })

  it('(c) shiny doubling composes across all 4 poison ticks, not just the first', () => {
    const { caster, enemy, state } = makeScenario(true)
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'zubat_poison')!
    let totalDamage = 0
    for (let i = 0; i < 4; i++) {
      const before = enemy.currentHp
      poison.tickEffect!(enemy, state)
      totalDamage += before - enemy.currentHp
    }
    // 20 base total for tier 1, doubled by shiny → 40
    expect(totalDamage).toBe(40)
  })

  it('(d) tier 2 shiny poison ticks for double the non-shiny amount (26 vs 13)', () => {
    const shinyCaster = makeUnit('zubat', 'player', 2)
    shinyCaster.hexPos = { col: 3, row: 5 }
    shinyCaster.isShiny = true
    const shinyEnemy = makeUnit('dummy', 'enemy', 1)
    shinyEnemy.hexPos = { col: 3, row: 2 }
    const shinyState = createCombatState([shinyCaster], [shinyEnemy])
    cast(shinyCaster, shinyState)
    const shinyProj = [...shinyState.projectiles.values()][0]
    shinyProj.onHit!(shinyCaster, shinyEnemy, shinyState)
    const shinyPoison = shinyEnemy.statusEffects.find(e => e.id === 'zubat_poison')!
    const shinyHpBefore = shinyEnemy.currentHp
    shinyPoison.tickEffect!(shinyEnemy, shinyState)
    expect(shinyHpBefore - shinyEnemy.currentHp).toBe(26)
  })

  it('(e) dead target — shiny doubling does not change the existing no-op-on-death guard', () => {
    const { caster, enemy, state } = makeScenario(true)
    cast(caster, state)
    const proj = [...state.projectiles.values()][0]
    enemy.state = 'dead'
    proj.onHit!(caster, enemy, state)
    const poison = enemy.statusEffects.find(e => e.id === 'zubat_poison')
    expect(poison).toBeUndefined()
  })
})
