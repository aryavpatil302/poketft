import { describe, it, expect } from 'vitest'
// Shiny-conditional combat behavior test: sets isShiny = true on exactly the
// unit(s) that should be affected, and includes a non-shiny control proving
// the effect does not fire without it.
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import '../shinyEffects/index'
import type { Unit } from '../../types'

describe('Shiny Morgrem - team +5 special defense', () => {
  it('grants +5 spDefBuff to every living ally, including itself, at combat start', () => {
    const caster = makeUnit('morgrem', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const ally = makeUnit('morelull', 'player', 1)
    ally.hexPos = { col: 1, row: 4 }
    const enemy = makeUnit('morelull', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 3 }

    createCombatState([caster, ally], [enemy])

    // Caster's own base spDefense was already bumped +5% by the universal
    // shiny passive (30 -> 32) BEFORE the per-species effect ran; the +5
    // flat buff stacks on top of that, not the pre-bonus base.
    expect(computeStats(caster).spDefense).toBe(37)
    // Non-shiny ally: no universal bonus, but the team-wide +5 still lands.
    expect(computeStats(ally).spDefense).toBe(35)
  })

  it('does not affect the enemy team', () => {
    const caster = makeUnit('morgrem', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const enemy = makeUnit('morelull', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 3 }

    createCombatState([caster], [enemy])

    expect(computeStats(enemy).spDefense).toBe(30)
    expect(enemy.statusEffects.some((fx: Unit['statusEffects'][number]) => fx.id === 'spDefBuff')).toBe(false)
  })

  it('non-shiny control: a non-shiny Morgrem grants no bonus to anyone', () => {
    const caster = makeUnit('morgrem', 'player', 1)
    // isShiny intentionally left unset
    caster.hexPos = { col: 0, row: 4 }
    const ally = makeUnit('morelull', 'player', 1)
    ally.hexPos = { col: 1, row: 4 }

    createCombatState([caster, ally], [])

    expect(computeStats(caster).spDefense).toBe(30)
    expect(computeStats(ally).spDefense).toBe(30)
    expect(caster.statusEffects.some((fx: Unit['statusEffects'][number]) => fx.id === 'spDefBuff')).toBe(false)
  })
})
