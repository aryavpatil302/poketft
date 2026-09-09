import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { getNeighbors } from '../../hexGrid'
import '../../systems/ability'

// Every test sets unit.isShiny = true on exactly the caster that should
// trigger the effect, and includes one explicit non-shiny control case
// proving the effect does NOT fire without it.

describe('Shiny Stonjourner — adjacent bulwark', () => {
  it('grants adjacent allies +5 armor and +5 special defense at combat start', () => {
    const caster = makeUnit('stonjourner', 'player', 1)
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

    const armorFx = adjAlly.statusEffects.find(fx => fx.stackId === `shiny_stonjourner_armor_${adjAlly.id}`)
    const spDefFx = adjAlly.statusEffects.find(fx => fx.stackId === `shiny_stonjourner_spdef_${adjAlly.id}`)
    expect(armorFx?.magnitude).toBe(5)
    expect(spDefFx?.magnitude).toBe(5)

    // Non-adjacent ally is untouched.
    expect(farAlly.statusEffects.some(fx => fx.id === 'armorBuff')).toBe(false)
    expect(farAlly.statusEffects.some(fx => fx.id === 'spDefBuff')).toBe(false)
  })

  it('excludes adjacent enemies — only allies get buffed', () => {
    const caster = makeUnit('stonjourner', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const neighbors = getNeighbors(caster.hexPos)
    const adjEnemy = makeUnit('dummy', 'enemy', 1)
    adjEnemy.hexPos = neighbors[0]

    createCombatState([caster], [adjEnemy])

    expect(adjEnemy.statusEffects.some(fx => fx.id === 'armorBuff')).toBe(false)
  })

  it('edge case: 0 adjacent allies (alone / board edge) no-ops cleanly, does not throw', () => {
    const caster = makeUnit('stonjourner', 'player', 1)
    caster.hexPos = { col: 0, row: 0 }  // board corner
    caster.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    expect(() => createCombatState([caster], [enemy])).not.toThrow()
    expect(caster.statusEffects.some(fx => fx.id === 'armorBuff')).toBe(false)
  })

  it('does NOT buff adjacent allies when Stonjourner is not shiny (control case)', () => {
    const caster = makeUnit('stonjourner', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = false
    const neighbors = getNeighbors(caster.hexPos)
    const adjAlly = makeUnit('tangela', 'player', 1)
    adjAlly.hexPos = neighbors[0]
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    createCombatState([caster, adjAlly], [enemy])

    expect(adjAlly.statusEffects.some(fx => fx.id === 'armorBuff')).toBe(false)
    expect(adjAlly.statusEffects.some(fx => fx.id === 'spDefBuff')).toBe(false)
  })
})
