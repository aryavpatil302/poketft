import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'

const HP_BONUS = 150

describe('Shiny Mamoswine - team-wide +150 max HP', () => {
  it('grants an ally +150 max HP and +150 current HP at combat start', () => {
    const mamoswine = makeUnit('mamoswine', 'player', 1)
    mamoswine.hexPos = { col: 3, row: 5 }
    mamoswine.isShiny = true
    const ally = makeUnit('snorunt', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const beforeMaxHp = ally.maxHp
    const beforeCurrentHp = ally.currentHp
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([mamoswine, ally], [enemy])

    expect(ally.maxHp).toBe(beforeMaxHp + HP_BONUS)
    expect(ally.currentHp).toBe(beforeCurrentHp + HP_BONUS)
  })

  it('also buffs Mamoswine itself (team-wide includes self)', () => {
    const mamoswine = makeUnit('mamoswine', 'player', 1)
    mamoswine.hexPos = { col: 3, row: 5 }
    mamoswine.isShiny = true
    const beforeMaxHp = mamoswine.maxHp
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([mamoswine], [enemy])
    // Mamoswine is itself shiny, so its own maxHp is ALSO already bumped by
    // the universal +5% shiny stat pass (initShinyEffects) before this
    // per-species +150 registers — account for that compounding rather
    // than asserting a flat +150 over the pre-bump baseline.
    const expectedAfterUniversalBump = Math.round(beforeMaxHp * 1.05)
    expect(mamoswine.maxHp).toBe(expectedAfterUniversalBump + HP_BONUS)
  })

  it('does not buff the enemy team', () => {
    const mamoswine = makeUnit('mamoswine', 'player', 1)
    mamoswine.hexPos = { col: 3, row: 5 }
    mamoswine.isShiny = true
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const beforeEnemyMaxHp = enemy.maxHp
    createCombatState([mamoswine], [enemy])
    expect(enemy.maxHp).toBe(beforeEnemyMaxHp)
  })

  it('non-shiny Mamoswine grants no bonus to allies (control)', () => {
    const mamoswine = makeUnit('mamoswine', 'player', 1)
    mamoswine.hexPos = { col: 3, row: 5 }
    const ally = makeUnit('snorunt', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const beforeMaxHp = ally.maxHp
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([mamoswine, ally], [enemy])
    expect(ally.maxHp).toBe(beforeMaxHp)
  })

  it('two shiny Mamoswines on the same team stack additively (direct field mutation, not a deduped status effect)', () => {
    const m1 = makeUnit('mamoswine', 'player', 1)
    m1.hexPos = { col: 3, row: 5 }
    m1.isShiny = true
    const m2 = makeUnit('mamoswine', 'player', 1)
    m2.hexPos = { col: 2, row: 5 }
    m2.isShiny = true
    const ally = makeUnit('snorunt', 'player', 1)
    ally.hexPos = { col: 1, row: 5 }
    const beforeMaxHp = ally.maxHp
    const enemy = makeUnit('snorunt', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    createCombatState([m1, m2, ally], [enemy])
    expect(ally.maxHp).toBe(beforeMaxHp + HP_BONUS * 2)
  })
})
