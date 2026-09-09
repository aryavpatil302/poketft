import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'

describe('Shiny Avalugg (h_avalugg) - same-row allies +15 armor / +15 spDef', () => {
  it('buffs an ally sharing the same row', () => {
    const avalugg = makeUnit('h_avalugg', 'player', 1)
    avalugg.hexPos = { col: 3, row: 5 }
    avalugg.isShiny = true
    const sameRowAlly = makeUnit('snorunt', 'player', 1)
    sameRowAlly.hexPos = { col: 1, row: 5 }
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([avalugg, sameRowAlly], [enemy])

    const armor = sameRowAlly.statusEffects.find(fx => fx.stackId === 'h_avalugg_shiny_armor')
    const spdef = sameRowAlly.statusEffects.find(fx => fx.stackId === 'h_avalugg_shiny_spdef')
    expect(armor?.magnitude).toBe(15)
    expect(spdef?.magnitude).toBe(15)
  })

  it('does not buff an ally in a different row', () => {
    const avalugg = makeUnit('h_avalugg', 'player', 1)
    avalugg.hexPos = { col: 3, row: 5 }
    avalugg.isShiny = true
    const diffRowAlly = makeUnit('snorunt', 'player', 1)
    diffRowAlly.hexPos = { col: 3, row: 6 }
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([avalugg, diffRowAlly], [enemy])
    expect(diffRowAlly.statusEffects.some(fx => fx.stackId === 'h_avalugg_shiny_armor')).toBe(false)
  })

  it('does not buff itself (self excluded from its own row aura)', () => {
    const avalugg = makeUnit('h_avalugg', 'player', 1)
    avalugg.hexPos = { col: 3, row: 5 }
    avalugg.isShiny = true
    const sameRowAlly = makeUnit('snorunt', 'player', 1)
    sameRowAlly.hexPos = { col: 1, row: 5 }
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([avalugg, sameRowAlly], [enemy])
    expect(avalugg.statusEffects.some(fx => fx.stackId === 'h_avalugg_shiny_armor')).toBe(false)
  })

  it('edge case: Avalugg alone in its row is a clean no-op (no crash, no self-buff)', () => {
    const avalugg = makeUnit('h_avalugg', 'player', 1)
    avalugg.hexPos = { col: 3, row: 5 }
    avalugg.isShiny = true
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    expect(() => createCombatState([avalugg], [enemy])).not.toThrow()
    expect(avalugg.statusEffects.some(fx => fx.stackId === 'h_avalugg_shiny_armor')).toBe(false)
  })

  it('non-shiny Avalugg grants no buff (control)', () => {
    const avalugg = makeUnit('h_avalugg', 'player', 1)
    avalugg.hexPos = { col: 3, row: 5 }
    const sameRowAlly = makeUnit('snorunt', 'player', 1)
    sameRowAlly.hexPos = { col: 1, row: 5 }
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([avalugg, sameRowAlly], [enemy])
    expect(sameRowAlly.statusEffects.some(fx => fx.stackId === 'h_avalugg_shiny_armor')).toBe(false)
  })
})
