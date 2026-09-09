import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { getNeighbors } from '../../hexGrid'
import '../../systems/ability'

// Every test sets unit.isShiny = true on exactly the caster that should
// trigger the effect, and includes one explicit non-shiny control case
// proving the effect does NOT fire without it.

describe('Shiny Xatu — future sight shield', () => {
  it('grants adjacent allies a 100 HP shield at combat start', () => {
    const caster = makeUnit('xatu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true

    const neighbors = getNeighbors(caster.hexPos)
    expect(neighbors.length).toBeGreaterThanOrEqual(2)

    const adjAlly = makeUnit('tangela', 'player', 1)
    adjAlly.hexPos = neighbors[0]
    const farAlly = makeUnit('venusaur', 'player', 1)
    farAlly.hexPos = { col: 0, row: 0 }

    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, adjAlly, farAlly], [enemy])

    const shield = adjAlly.shields.find(s => s.id === `shiny_xatu_shield_${adjAlly.id}`)
    expect(shield).toBeDefined()
    expect(shield?.value).toBe(100)
    expect(shield?.maxValue).toBe(100)

    // Non-adjacent ally is untouched.
    expect(farAlly.shields).toHaveLength(0)
  })

  it('excludes adjacent enemies — only allies get shielded', () => {
    const caster = makeUnit('xatu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const neighbors = getNeighbors(caster.hexPos)
    const adjEnemy = makeUnit('dummy', 'enemy', 1)
    adjEnemy.hexPos = neighbors[0]

    createCombatState([caster], [adjEnemy])

    expect(adjEnemy.shields).toHaveLength(0)
  })

  it('edge case: 0 adjacent allies no-ops cleanly, does not throw', () => {
    const caster = makeUnit('xatu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    expect(() => createCombatState([caster], [enemy])).not.toThrow()
    expect(caster.shields).toHaveLength(0)
  })

  it('does NOT shield adjacent allies when Xatu is not shiny (control case)', () => {
    const caster = makeUnit('xatu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = false
    const neighbors = getNeighbors(caster.hexPos)
    const adjAlly = makeUnit('tangela', 'player', 1)
    adjAlly.hexPos = neighbors[0]
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, adjAlly], [enemy])

    expect(adjAlly.shields).toHaveLength(0)
  })
})
