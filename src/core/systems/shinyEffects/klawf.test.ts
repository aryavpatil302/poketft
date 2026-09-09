import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../ability'
import { getShinyEffect } from '../shinyEffects'
import type { Unit, CombatState } from '../../types'

import '../ability'
import './index'

// Every shiny test file in this batch must include one explicit non-shiny
// control proving the effect does NOT fire without isShiny set — see the
// convention note in the batch plan.

const CAST_TICKS = 12

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Klawf — shiny registration', () => {
  it('is registered with the expected id and a description', () => {
    const effect = getShinyEffect('klawf')
    expect(effect).toBeDefined()
    expect(effect!.id).toBe('klawf_shiny_anger_shell')
    expect(effect!.description.length).toBeGreaterThan(0)
  })

  it('onCombatStart is a no-op — behavior lives entirely in klawf.ts onCast', () => {
    const effect = getShinyEffect('klawf')!
    const self = makeUnit('klawf', 'player', 1)
    self.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([self], [enemy])
    expect(() => effect.onCombatStart(state.units.get(self.id)!, state)).not.toThrow()
  })
})

describe('Klawf — shiny Anger Shell crit magnitude', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('klawf', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
  })

  it('shiny Klawf gets exactly 100% (1.0) crit chance magnitude from Anger Shell', () => {
    caster.isShiny = true
    state = createCombatState([caster], [enemy])
    cast(caster, state)
    const buff = caster.statusEffects.find(fx => fx.stackId === 'klawf_crit')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBe(1.0)
  })

  it('non-shiny control — Klawf still gets exactly 50% (0.50) crit chance magnitude', () => {
    state = createCombatState([caster], [enemy])
    cast(caster, state)
    const buff = caster.statusEffects.find(fx => fx.stackId === 'klawf_crit')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBe(0.50)
  })
})
