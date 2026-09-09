import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'

describe('Shiny Weavile - team-wide +5 attack / +5% attack speed', () => {
  it('grants dmg_buff +5 and atkSpd_buff +5% to an ally at combat start', () => {
    const weavile = makeUnit('weavile', 'player', 1)
    weavile.hexPos = { col: 3, row: 5 }
    weavile.isShiny = true
    const ally = makeUnit('snorunt', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([weavile, ally], [enemy])

    const dmg = ally.statusEffects.find(fx => fx.stackId === 'weavile_shiny_dmg_buff')
    const spd = ally.statusEffects.find(fx => fx.stackId === 'weavile_shiny_atkspd_buff')
    expect(dmg?.magnitude).toBe(5)
    expect(spd?.magnitude).toBe(0.05)
  })

  it('also buffs the shiny Weavile itself (team-wide includes self)', () => {
    const weavile = makeUnit('weavile', 'player', 1)
    weavile.hexPos = { col: 3, row: 5 }
    weavile.isShiny = true
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([weavile], [enemy])
    expect(weavile.statusEffects.some(fx => fx.stackId === 'weavile_shiny_dmg_buff')).toBe(true)
  })

  it('does not buff the enemy team', () => {
    const weavile = makeUnit('weavile', 'player', 1)
    weavile.hexPos = { col: 3, row: 5 }
    weavile.isShiny = true
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([weavile], [enemy])
    expect(enemy.statusEffects.some(fx => fx.stackId === 'weavile_shiny_dmg_buff')).toBe(false)
  })

  it('non-shiny Weavile grants no buff (control)', () => {
    const weavile = makeUnit('weavile', 'player', 1)
    weavile.hexPos = { col: 3, row: 5 }
    const ally = makeUnit('snorunt', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([weavile, ally], [enemy])
    expect(ally.statusEffects.some(fx => fx.stackId === 'weavile_shiny_dmg_buff')).toBe(false)
    expect(ally.statusEffects.some(fx => fx.stackId === 'weavile_shiny_atkspd_buff')).toBe(false)
  })

  it('two shiny Weaviles on the same team do not stack the buff (fixed stackId dedup)', () => {
    const w1 = makeUnit('weavile', 'player', 1)
    w1.hexPos = { col: 3, row: 5 }
    w1.isShiny = true
    const w2 = makeUnit('weavile', 'player', 1)
    w2.hexPos = { col: 2, row: 5 }
    w2.isShiny = true
    const ally = makeUnit('snorunt', 'player', 1)
    ally.hexPos = { col: 1, row: 5 }
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([w1, w2, ally], [enemy])

    const dmgBuffs = ally.statusEffects.filter(fx => fx.stackId === 'weavile_shiny_dmg_buff')
    expect(dmgBuffs).toHaveLength(1)
    expect(dmgBuffs[0].magnitude).toBe(5)
  })
})
