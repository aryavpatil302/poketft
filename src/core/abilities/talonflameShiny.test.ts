import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

// Shiny Talonflame: a lethal Brave Bird heals for 75% of the damage dealt.
// Must NOT fire on a non-lethal hit even when shiny, and must NOT fire on a
// lethal hit when the caster isn't shiny — see talonflame.ts's landing callback.

const CAST_TICKS = 15
const DMG_PCT = [3.5, 5.65, 7.15] as const
const braveBirdBase = (u: Unit, tier: 1 | 2 | 3) =>
  Math.round(computeStats(u).attack * DMG_PCT[tier - 1])

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Advances all visual-only leaps until the unit returns to idle (mirrors
// talonflame.test.ts's own helper).
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !(unit as any)._leap) unit.state = 'idle'
  }
}

describe('Talonflame - Brave Bird (shiny)', () => {
  it('(a) shiny — a lethal hit heals the caster for 75% of the target\'s remaining HP, not the raw damage', () => {
    const caster = makeUnit('talonflame', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }

    const enemyHp = 1
    const weakEnemy = makeUnit('dummy', 'enemy', 1)
    weakEnemy.maxHp = enemyHp
    weakEnemy.currentHp = enemyHp
    weakEnemy.defense = 0
    weakEnemy._computedStats = null
    weakEnemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [weakEnemy])
    caster.critChance = 0
    caster._computedStats = null
    // Headroom for the heal to land in full.
    caster.currentHp = Math.round(caster.maxHp / 2)
    const hpBefore = caster.currentHp

    cast(caster, state)
    advanceLeaps(caster, state)

    // Sanity: this is genuinely an overkill case (raw damage exceeds the HP available).
    const dealt = braveBirdBase(caster, 1)
    expect(dealt).toBeGreaterThan(enemyHp)
    expect(caster.currentHp - hpBefore).toBe(Math.round(enemyHp * 0.75))
  })

  it('(b) shiny — a non-lethal hit does NOT heal the caster', () => {
    const caster = makeUnit('talonflame', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }

    const toughEnemy = makeUnit('dummy', 'enemy', 1)
    toughEnemy.maxHp = 100000
    toughEnemy.currentHp = 100000
    toughEnemy.defense = 0
    toughEnemy._computedStats = null
    toughEnemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [toughEnemy])
    caster.critChance = 0
    caster._computedStats = null
    caster.currentHp = Math.round(caster.maxHp / 2)
    const hpBefore = caster.currentHp

    cast(caster, state)
    advanceLeaps(caster, state)

    expect(toughEnemy.currentHp).toBeLessThan(100000)   // hit landed
    expect(toughEnemy.state).not.toBe('dead')             // but did not kill
    expect(caster.currentHp).toBe(hpBefore)                // so no heal fired
  })

  it('(c) non-shiny control — a lethal hit does NOT heal the caster', () => {
    const caster = makeUnit('talonflame', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }

    const weakEnemy = makeUnit('dummy', 'enemy', 1)
    weakEnemy.maxHp = 1
    weakEnemy.currentHp = 1
    weakEnemy.defense = 0
    weakEnemy._computedStats = null
    weakEnemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [weakEnemy])
    caster.critChance = 0
    caster._computedStats = null
    caster.currentHp = Math.round(caster.maxHp / 2)
    const hpBefore = caster.currentHp

    cast(caster, state)
    advanceLeaps(caster, state)

    expect(weakEnemy.state).toBe('dead')
    expect(caster.currentHp).toBe(hpBefore)
  })

  // (d) pins the capped contract with numbers where the two formulas genuinely diverge:
  // if the clamp were removed, the heal would jump from 90 (75% of the 120 HP remaining)
  // to 184 (75% of the raw 245 damage) — the exact-heal assertion below is load-bearing.
  it('(d) shiny — overkill on a target with meaningful HP still heals only 75% of that HP, not the raw hit', () => {
    const caster = makeUnit('talonflame', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }

    const enemyHp = 120
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = enemyHp
    enemy.currentHp = enemyHp
    enemy.defense = 0
    enemy._computedStats = null
    enemy.hexPos = { col: 3, row: 2 }

    const state = createCombatState([caster], [enemy])
    caster.critChance = 0
    caster._computedStats = null
    // Headroom for the heal to land in full.
    caster.currentHp = Math.round(caster.maxHp / 2)
    const hpBefore = caster.currentHp

    cast(caster, state)
    advanceLeaps(caster, state)

    const dealt = braveBirdBase(caster, 1)
    expect(enemy.state).toBe('dead')
    expect(dealt).toBeGreaterThan(enemyHp)   // genuine overkill
    expect(caster.currentHp - hpBefore).toBe(Math.round(enemyHp * 0.75))
    expect(Math.round(enemyHp * 0.75)).toBeLessThan(Math.round(dealt * 0.75))
  })
})
