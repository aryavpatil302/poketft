import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

// New shape being introduced by this batch: shiny-conditional combat
// behavior tests. Every test below sets `isShiny = true` on exactly the
// caster that should be affected, and includes a non-shiny control proving
// the effect does NOT fire without it.

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Mirrors combatEngine tickLeapMovement — advances the leap until landing.
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !(unit as any)._leap) unit.state = 'idle'
  }
}

describe('Shiny Gible — Bite reduces target durability by 5%/5%', () => {
  it('(a) applies sunder_pct and shred_pct at magnitude 0.05, permanent, on landing', () => {
    const caster = makeUnit('gible', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])

    cast(caster, state)
    advanceLeaps(caster, state)

    const sunder = enemy.statusEffects.find(e => e.id === 'sunder_pct' && e.sourceUnitId === caster.id)
    const shred = enemy.statusEffects.find(e => e.id === 'shred_pct' && e.sourceUnitId === caster.id)
    expect(sunder).toBeDefined()
    expect(sunder?.magnitude).toBeCloseTo(0.05)
    expect(sunder?.durationTicks).toBe(-1)
    expect(shred).toBeDefined()
    expect(shred?.magnitude).toBeCloseTo(0.05)
    expect(shred?.durationTicks).toBe(-1)
  })

  it('(b) non-shiny control — a non-shiny Gible\'s Bite applies no durability debuff', () => {
    const caster = makeUnit('gible', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])

    cast(caster, state)
    advanceLeaps(caster, state)

    expect(enemy.statusEffects.some(e => e.id === 'sunder_pct')).toBe(false)
    expect(enemy.statusEffects.some(e => e.id === 'shred_pct')).toBe(false)
  })

  it('(c) reduces defense and spDefense by 5% each via computeStats', () => {
    const caster = makeUnit('gible', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])
    const baseDef = enemy.defense
    const baseSpDef = enemy.spDefense

    cast(caster, state)
    advanceLeaps(caster, state)

    const stats = computeStats(enemy)
    // computeStats rounds defense/spDefense to whole numbers at the end.
    expect(stats.defense).toBe(Math.round(baseDef * 0.95))
    expect(stats.spDefense).toBe(Math.round(baseSpDef * 0.95))
  })

  it('(d) stacks across repeated bites within one fight — distinct stackIds compound the reduction', () => {
    const caster = makeUnit('gible', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])
    const baseDef = enemy.defense

    cast(caster, state)
    advanceLeaps(caster, state)
    caster.state = 'idle'
    state.tick += 1 // ensure a distinct stackId (stackId includes s.tick) for the second bite
    cast(caster, state)
    advanceLeaps(caster, state)

    const sunderStacks = enemy.statusEffects.filter(e => e.id === 'sunder_pct' && e.sourceUnitId === caster.id)
    expect(sunderStacks.length).toBe(2)

    const stats = computeStats(enemy)
    // Two independent 5% multiplicative reductions: base * 0.95 * 0.95,
    // rounded to a whole number at the end of computeStats.
    expect(stats.defense).toBe(Math.round(baseDef * 0.95 * 0.95))
  })

  it('(e) edge case — no durability debuff is applied if the target is already dead on landing', () => {
    const caster = makeUnit('gible', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    enemy.currentHp = 1
    enemy.maxHp = 1
    const state = createCombatState([caster], [enemy])

    cast(caster, state)
    advanceLeaps(caster, state)

    expect(enemy.state).toBe('dead')
    expect(enemy.statusEffects.some(e => e.id === 'sunder_pct')).toBe(false)
    expect(enemy.statusEffects.some(e => e.id === 'shred_pct')).toBe(false)
  })
})
