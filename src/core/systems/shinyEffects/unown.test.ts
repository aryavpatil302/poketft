import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import type { CombatState } from '../../types'
import '../../systems/ability'

// This batch's first shiny-conditional combat-behavior test file: every test
// sets unit.isShiny = true on exactly the caster that should trigger the
// effect, and includes one explicit non-shiny control case proving the
// effect does NOT fire without it.

const SHINY_MULT = 1.05  // universal shiny +5% base-stat bump (shinyEffects.ts), runs before this effect

describe('Shiny Unown — team stat boost', () => {
  function setup(shiny: boolean) {
    const caster = makeUnit('unown', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = shiny
    const ally1 = makeUnit('tangela', 'player', 1)
    ally1.hexPos = { col: 2, row: 5 }
    const ally2 = makeUnit('venusaur', 'player', 1)
    ally2.hexPos = { col: 4, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    return { caster, ally1, ally2, enemy }
  }

  it('grants +3 to a shared random pick of 2 distinct stats to every living ally', () => {
    const { caster, ally1, ally2, enemy } = setup(true)

    const baseCasterAtk = caster.attack
    const baseCasterDef = caster.defense
    const baseAlly1Atk = ally1.attack, baseAlly1Def = ally1.defense
    const baseAlly1Spc = ally1.special, baseAlly1Spd = ally1.spDefense
    const baseAlly2Atk = ally2.attack, baseAlly2Def = ally2.defense
    const baseAlly2Spc = ally2.special, baseAlly2Spd = ally2.spDefense
    const baseEnemyAtk = enemy.attack

    // pool = ['attack','special','defense','spDefense']; idx 0 -> 'attack' (pool len 4),
    // remaining pool = ['special','defense','spDefense']; idx 1 -> 'defense' (pool len 3)
    const seq = [0.1, 0.4]
    let i = 0
    const orig = Math.random
    Math.random = () => seq[i++]
    let state: CombatState
    try {
      state = createCombatState([caster, ally1, ally2], [enemy])
    } finally {
      Math.random = orig
    }
    expect(state).toBeDefined()

    // Non-shiny allies isolate the +3 grant cleanly from the universal +5% bonus.
    expect(ally1.attack).toBe(baseAlly1Atk + 3)
    expect(ally1.defense).toBe(baseAlly1Def + 3)
    expect(ally1.special).toBe(baseAlly1Spc)
    expect(ally1.spDefense).toBe(baseAlly1Spd)

    // Both allies received the SAME shared pick — not an independent roll each.
    expect(ally2.attack).toBe(baseAlly2Atk + 3)
    expect(ally2.defense).toBe(baseAlly2Def + 3)
    expect(ally2.special).toBe(baseAlly2Spc)
    expect(ally2.spDefense).toBe(baseAlly2Spd)

    // Caster (shiny) gets the universal +5% first, then +3 on the same 2 picked stats.
    expect(caster.attack).toBe(Math.round(baseCasterAtk * SHINY_MULT) + 3)
    expect(caster.defense).toBe(Math.round(baseCasterDef * SHINY_MULT) + 3)

    // Enemy team is never touched.
    expect(enemy.attack).toBe(baseEnemyAtk)
  })

  it('does NOT grant any stat bonus when Unown is not shiny (control case)', () => {
    const { caster, ally1, enemy } = setup(false)
    const baseAlly1Atk = ally1.attack, baseAlly1Def = ally1.defense
    const baseAlly1Spc = ally1.special, baseAlly1Spd = ally1.spDefense
    const baseCasterAtk = caster.attack

    createCombatState([caster, ally1], [enemy])

    expect(caster.attack).toBe(baseCasterAtk)  // no universal bonus, no effect
    expect(ally1.attack).toBe(baseAlly1Atk)
    expect(ally1.defense).toBe(baseAlly1Def)
    expect(ally1.special).toBe(baseAlly1Spc)
    expect(ally1.spDefense).toBe(baseAlly1Spd)
  })

  it('never picks the same stat twice (2 distinct stats every roll)', () => {
    const caster = makeUnit('unown', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }

    const base = { attack: ally.attack, special: ally.special, defense: ally.defense, spDefense: ally.spDefense }

    createCombatState([caster, ally], [enemy])

    const deltas = [
      ally.attack - base.attack,
      ally.special - base.special,
      ally.defense - base.defense,
      ally.spDefense - base.spDefense,
    ]
    const boosted = deltas.filter(d => d === 3)
    const untouched = deltas.filter(d => d === 0)
    expect(boosted).toHaveLength(2)
    expect(untouched).toHaveLength(2)
  })
})
