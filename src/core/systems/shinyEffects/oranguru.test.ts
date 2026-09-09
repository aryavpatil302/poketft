import { describe, it, expect } from 'vitest'
// Shiny-conditional combat behavior test: sets isShiny = true on exactly the
// unit(s) that should be affected, and includes a non-shiny control proving
// the effect does not fire without it.
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import '../shinyEffects/index'
import type { Unit } from '../../types'

describe('Shiny Oranguru - self full mana + attack speed', () => {
  it('fills to full mana and grants +15% attack speed to itself only', () => {
    const caster = makeUnit('oranguru', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const ally = makeUnit('morgrem', 'player', 1)
    const allyStartMana = ally.currentMana
    ally.hexPos = { col: 1, row: 4 }

    createCombatState([caster, ally], [])

    expect(caster.currentMana).toBe(caster.maxMana)
    // Oranguru's base attackSpeed (0.65) was already bumped +5% by the
    // universal shiny passive (0.65 -> 0.6825) BEFORE the per-species
    // effect ran; the +15% atkSpd_buff stacks fractionally on top of that.
    expect(computeStats(caster).attackSpeed).toBeCloseTo(0.6825 * 1.15, 6)
    // Self-only: the ally gets neither the mana fill nor the attack speed buff.
    expect(ally.currentMana).toBe(allyStartMana)
    expect(ally.statusEffects.some((fx: Unit['statusEffects'][number]) => fx.id === 'atkSpd_buff')).toBe(false)
  })

  it('does not affect allies', () => {
    const caster = makeUnit('oranguru', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const ally = makeUnit('morgrem', 'player', 1)
    const allyStartMana = ally.currentMana
    ally.hexPos = { col: 1, row: 4 }

    createCombatState([caster, ally], [])

    expect(ally.currentMana).toBe(allyStartMana)
    expect(computeStats(ally).attackSpeed).toBeCloseTo(ally.attackSpeed, 6)
  })

  it('non-shiny control: a non-shiny Oranguru gains no bonus', () => {
    const caster = makeUnit('oranguru', 'player', 1)
    // isShiny intentionally left unset
    const startMana = caster.currentMana
    caster.hexPos = { col: 0, row: 4 }

    createCombatState([caster], [])

    expect(caster.currentMana).toBe(startMana)
    expect(caster.currentMana).toBeLessThan(caster.maxMana)
    expect(caster.statusEffects.some((fx: Unit['statusEffects'][number]) => fx.id === 'atkSpd_buff')).toBe(false)
    expect(computeStats(caster).attackSpeed).toBeCloseTo(0.65, 6)
  })
})
