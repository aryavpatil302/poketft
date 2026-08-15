import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import { tickStatusEffects } from '../systems/statusEffect'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const STRIKE_TICKS = 16  // strike animation length; damage fires at tick 8

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  tickAbilityCast(caster, state)  // castTimeTicks is 1
}

// Mirrors combatEngine tickLeapMovement — advances the leap until landing.
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !(unit as any)._leap) unit.state = 'idle'
  }
}

function tickFx(state: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
  }
}

// Full cast → dash → strike animation until the damage tick fires
function castAndStrike(caster: Unit, state: CombatState): void {
  cast(caster, state)
  advanceLeaps(caster, state)
  tickFx(state, STRIKE_TICKS)
}

describe('Barraskewda - Fishous Rend', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('barraskewda', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // within 2 hexes
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 1-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(1)
  })

  it('dashes to a hex adjacent to the target', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('deals physical damage to the target after the strike animation', () => {
    const hpBefore = enemy.currentHp
    castAndStrike(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && e.targetId === enemy.id && (e as any).damageType === 'physical'
    )
    expect(dmgEvent).toBeDefined()
  })

  it('deals 1.5x damage to targets below half HP', () => {
    // Full-HP run
    const fullState = createCombatState([caster], [enemy])
    caster.critChance = 0
    caster._computedStats = null
    castAndStrike(caster, fullState)
    const fullDmg = fullState.events.find(e => e.type === 'damage' && e.targetId === enemy.id)

    // Low-HP run
    const c2 = makeUnit('barraskewda', 'player', 1)
    c2.hexPos = { col: 3, row: 5 }
    c2.critChance = 0
    c2._computedStats = null
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 4 }
    e2.currentHp = Math.floor(e2.maxHp * 0.4)
    const s2 = createCombatState([c2], [e2])
    castAndStrike(c2, s2)
    const lowDmg = s2.events.find(e => e.type === 'damage' && e.targetId === e2.id)

    expect(fullDmg).toBeDefined()
    expect(lowDmg).toBeDefined()
    if (fullDmg?.type === 'damage' && lowDmg?.type === 'damage') {
      expect(lowDmg.amount).toBeGreaterThan(fullDmg.amount)
    }
  })

  it('reduces own maxMana by 10 on first cast', () => {
    const before = caster.maxMana
    cast(caster, state)
    expect(caster.maxMana).toBe(before - 10)
  })

  it('reduces own maxMana again on second cast (cumulative)', () => {
    const before = caster.maxMana
    cast(caster, state)
    advanceLeaps(caster, state)
    cast(caster, state)
    expect(caster.maxMana).toBe(before - 20)
  })

  it('does not reduce own maxMana below 30 (floor)', () => {
    caster.maxMana = 35
    cast(caster, state)
    expect(caster.maxMana).toBe(30)
    advanceLeaps(caster, state)
    cast(caster, state)
    expect(caster.maxMana).toBe(30)
  })

  it('does nothing when no enemies are in range and no targetId', () => {
    enemy.hexPos = { col: 0, row: 0 }
    state = createCombatState([caster], [enemy])
    caster.targetId = null
    const manaBefore = caster.maxMana
    cast(caster, state)
    advanceLeaps(caster, state)
    tickFx(state, STRIKE_TICKS)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
    expect(caster.maxMana).toBe(manaBefore)
  })
})
