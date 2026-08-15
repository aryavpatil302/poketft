import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 15

// Brave Bird damage = attack × dmgPct — mirrors talonflame.ts onCast dmgPcts.
const DMG_PCT = [3.5, 5.65, 7.15] as const
const braveBirdBase = (u: Unit, tier: 1 | 2 | 3) =>
  Math.round(computeStats(u).attack * DMG_PCT[tier - 1])

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Advances all visual-only leaps until the unit returns to idle.
// Mirrors the combatEngine tickLeapMovement logic.
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !(unit as any)._leap) unit.state = 'idle'
  }
}

describe('Talonflame - Brave Bird', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('talonflame', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast animation', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('starts leaping after cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('deals physical damage to the nearest enemy on landing', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    cast(caster, state)
    advanceLeaps(caster, state)

    expect(enemy.currentHp).toBeLessThan(10000)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'physical' && e.targetId === enemy.id
    )
    expect(dmgEvent).toBeDefined()
  })

  it('tier 1 — base damage scales off attack (no defense, no crit, equal HP)', () => {
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.defense = 0
    enemy._computedStats = null
    // Match caster maxHp so HP bonus does not apply (strictly greater-than required)
    enemy.maxHp = caster.maxHp
    caster.critChance = 0
    caster._computedStats = null
    cast(caster, state)
    advanceLeaps(caster, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(braveBirdBase(caster, 1))
  })

  it('tier 2 — base damage scales off attack', () => {
    const t2 = makeUnit('talonflame', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.critChance = 0
    t2._computedStats = null
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = t2.maxHp  // equal HP — no bonus
    e.currentHp = 10000
    e.defense = 0
    e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    advanceLeaps(t2, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(braveBirdBase(t2, 2))
  })

  it('tier 3 — base damage scales off attack', () => {
    const t3 = makeUnit('talonflame', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    t3.critChance = 0
    t3._computedStats = null
    const e = makeUnit('dummy', 'enemy', 1)
    e.maxHp = t3.maxHp  // equal HP — no bonus
    e.currentHp = 10000
    e.defense = 0
    e._computedStats = null
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    advanceLeaps(t3, s)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(braveBirdBase(t3, 3))
  })

  it('+60% damage vs targets with higher max HP', () => {
    enemy.maxHp = caster.maxHp + 1   // strictly higher → bonus applies
    enemy.currentHp = 10000
    enemy.defense = 0
    enemy._computedStats = null
    caster.critChance = 0
    caster._computedStats = null
    cast(caster, state)
    advanceLeaps(caster, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(Math.round(braveBirdBase(caster, 1) * 1.6))
  })

  it('does nothing when no enemies are present', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('on kill — immediately starts a new animated leap to next target', () => {
    const weakEnemy = makeUnit('dummy', 'enemy', 1)
    weakEnemy.maxHp = 1
    weakEnemy.currentHp = 1
    weakEnemy.defense = 0
    weakEnemy.hexPos = { col: 3, row: 2 }

    const strongEnemy = makeUnit('dummy', 'enemy', 1)
    strongEnemy.maxHp = 10000
    strongEnemy.currentHp = 10000
    strongEnemy.hexPos = { col: 4, row: 2 }

    state = createCombatState([caster], [weakEnemy, strongEnemy])
    cast(caster, state)
    advanceLeaps(caster, state)

    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThanOrEqual(2)
    // Second damage event hits the strong enemy
    expect(dmgEvents.some(e => e.targetId === strongEnemy.id)).toBe(true)
  })

  it('recast damage is 75% of original (no HP bonus)', () => {
    const weakEnemy = makeUnit('dummy', 'enemy', 1)
    weakEnemy.maxHp = 1
    weakEnemy.currentHp = 1
    weakEnemy.defense = 0
    weakEnemy._computedStats = null
    weakEnemy.hexPos = { col: 3, row: 2 }

    const strongEnemy = makeUnit('dummy', 'enemy', 1)
    // Equal maxHp to caster → HP bonus does not apply (strictly greater-than required)
    strongEnemy.maxHp = caster.maxHp
    strongEnemy.currentHp = 10000
    strongEnemy.defense = 0
    strongEnemy._computedStats = null
    strongEnemy.hexPos = { col: 4, row: 2 }

    caster.critChance = 0
    caster._computedStats = null
    state = createCombatState([caster], [weakEnemy, strongEnemy])
    cast(caster, state)
    advanceLeaps(caster, state)

    const bounceDmg = state.events.find(e => e.type === 'damage' && e.targetId === strongEnemy.id)
    expect(bounceDmg).toBeDefined()
    // Recast deals 75% of the original base (which is round(attack × 350%)).
    if (bounceDmg?.type === 'damage') expect(bounceDmg.amount).toBe(Math.round(braveBirdBase(caster, 1) * 0.75))
  })

  it('chain stops before damage falls below 30 (prevents infinite loop)', () => {
    const weakEnemies = Array.from({ length: 10 }, (_, i) => {
      const e = makeUnit('dummy', 'enemy', 1)
      e.maxHp = 1
      e.currentHp = 1
      e.defense = 0
      e.hexPos = { col: i % 8, row: 2 }
      return e
    })
    state = createCombatState([caster], weakEnemies)
    expect(() => { cast(caster, state); advanceLeaps(caster, state) }).not.toThrow()

    // 200→150→112→84→63→47→35 (7 kills) then 26 < 30 → stop
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    expect(dmgEvents.length).toBeLessThan(10)
  })
})
