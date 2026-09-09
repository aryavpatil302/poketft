import { describe, it, expect } from 'vitest'
// Shiny-conditional combat behavior test: sets isShiny = true on exactly the
// unit(s) that should be affected, and includes a non-shiny control proving
// the effect does not fire without it.
import { makeUnit, computeStats } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import '../shinyEffects/index'
import type { Unit } from '../../types'

describe('Shiny Morelull - team +5 special', () => {
  it('grants +5 special to every living ally, including itself, at combat start', () => {
    const caster = makeUnit('morelull', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const ally = makeUnit('morgrem', 'player', 1)
    ally.hexPos = { col: 1, row: 4 }
    const enemy = makeUnit('morgrem', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 3 }

    createCombatState([caster, ally], [enemy])

    // Caster's own base special was already bumped +5% by the universal
    // shiny passive (100 -> 105) BEFORE the per-species effect ran; the
    // +5 flat buff stacks on top of that, not the pre-bonus base.
    expect(computeStats(caster).special).toBe(110)
    // Non-shiny ally: no universal bonus, but the team-wide +5 still lands.
    expect(computeStats(ally).special).toBe(105)
  })

  it('does not affect the enemy team', () => {
    const caster = makeUnit('morelull', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 0, row: 4 }
    const enemy = makeUnit('morgrem', 'enemy', 1)
    enemy.hexPos = { col: 0, row: 3 }

    createCombatState([caster], [enemy])

    expect(computeStats(enemy).special).toBe(100)
    expect(enemy.statusEffects.some((fx: Unit['statusEffects'][number]) => fx.id === 'sp_buff')).toBe(false)
  })

  it('non-shiny control: a non-shiny Morelull grants no bonus to anyone', () => {
    const caster = makeUnit('morelull', 'player', 1)
    // isShiny intentionally left unset
    caster.hexPos = { col: 0, row: 4 }
    const ally = makeUnit('morgrem', 'player', 1)
    ally.hexPos = { col: 1, row: 4 }

    createCombatState([caster, ally], [])

    expect(computeStats(caster).special).toBe(100)
    expect(computeStats(ally).special).toBe(100)
    expect(caster.statusEffects.some((fx: Unit['statusEffects'][number]) => fx.id === 'sp_buff')).toBe(false)
  })
})
