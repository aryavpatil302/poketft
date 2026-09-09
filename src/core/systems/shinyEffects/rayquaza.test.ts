import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { applyDamage } from '../damage'
import type { Unit, CombatState } from '../../types'

import '../ability'
import './rayquaza'

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

describe('shinyEffects/rayquaza — full mana + 10% damage amp at combat start', () => {
  it('(a) shiny Rayquaza starts at full mana (base startMana is 70/100, well below max)', () => {
    const shiny = makeUnit('rayquaza', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny], [enemy])

    const unit = state.units.get(shiny.id)!
    expect(unit.currentMana).toBe(unit.maxMana)
  })

  it('(b) shiny Rayquaza gets a permanent 10% damage_amp status', () => {
    const shiny = makeUnit('rayquaza', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shiny], [enemy])

    const unit = state.units.get(shiny.id)!
    const fx = unit.statusEffects.find(f => f.stackId === 'shiny_rayquaza_amp')
    expect(fx).toBeDefined()
    expect(fx!.id).toBe('damage_amp')
    expect(fx!.magnitude).toBe(0.10)
    expect(fx!.durationTicks).toBe(-1)
  })

  it('(c) the damage_amp actually amplifies outgoing damage by 10% in applyDamage', () => {
    const shiny = makeUnit('rayquaza', 'player', 1)
    shiny.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.defense = 0
    const state = makeState([shiny], [enemy])

    const unit = state.units.get(shiny.id)!
    const target = state.units.get(enemy.id)!
    target._computedStats = null

    const result = applyDamage(unit, target, {
      baseAmount: 100,
      damageType: 'true',
      canCrit: false,
      abilityId: 'test_hit',
    }, state)

    expect(result.finalDamage).toBe(110)
  })

  it('(d) non-shiny control — mana stays at base startMana, no damage_amp, no amplification', () => {
    const control = makeUnit('rayquaza', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.defense = 0
    const state = makeState([control], [enemy])

    const unit = state.units.get(control.id)!
    // Rayquaza's base startMana is 70 (maxMana 100) — untouched without the shiny effect.
    expect(unit.currentMana).toBe(70)
    expect(unit.currentMana).not.toBe(unit.maxMana)
    expect(unit.statusEffects.some(f => f.stackId === 'shiny_rayquaza_amp')).toBe(false)

    const target = state.units.get(enemy.id)!
    target._computedStats = null
    const result = applyDamage(unit, target, {
      baseAmount: 100,
      damageType: 'true',
      canCrit: false,
      abilityId: 'test_hit',
    }, state)
    expect(result.finalDamage).toBe(100)
  })
})
