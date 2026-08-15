import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { tickLeapPixel } from '../systems/movement'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

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

function raichuProjectiles(state: CombatState) {
  return [...state.projectiles.values()].filter(p => p.abilityId === 'a_raichu_surge_surfer')
}

describe('A-Raichu - Surge Surfer', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('a_raichu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
    caster.targetId = enemy.id
  })

  it('enters casting state with 1-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(1)
  })

  it('dashes (leaping state) on cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('fires 1 bolt on the first dash with a single enemy (1 bolt/target)', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    tickFx(state, 6)
    expect(raichuProjectiles(state).length).toBe(1)
  })

  it('bolts target the nearest enemies', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    tickFx(state, 6)
    for (const proj of raichuProjectiles(state)) {
      expect(proj.targetId).toBe(enemy.id)
    }
  })

  it('bolts-per-target grows +2 on each successive dash (1, then 3, then 5)', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 5, row: 2 }
    state = createCombatState([caster], [enemy, enemy2])
    caster.targetId = enemy.id

    // Dash 1: 1 bolt/target * 2 targets = 2
    cast(caster, state)
    advanceLeaps(caster, state)
    tickFx(state, 20)
    expect(raichuProjectiles(state).length).toBe(2)
    state.projectiles.clear()
    caster.manaLockTimer = 0
    caster.state = 'idle'

    // Dash 2: 3 bolts/target * 2 targets = 6 (last bolt queued at i=5 * 5 ticks = 25)
    cast(caster, state)
    advanceLeaps(caster, state)
    tickFx(state, 30)
    expect(raichuProjectiles(state).length).toBe(6)
    state.projectiles.clear()
    caster.manaLockTimer = 0
    caster.state = 'idle'

    // Dash 3: 5 bolts/target * 2 targets = 10 (last bolt queued at i=9 * 5 ticks = 45)
    cast(caster, state)
    advanceLeaps(caster, state)
    tickFx(state, 50)
    expect(raichuProjectiles(state).length).toBe(10)
  })

  it('bolts have magic damage payload (tier 1 = 60)', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    const proj = raichuProjectiles(state)[0]
    expect(proj).toBeDefined()
    expect(proj.damagePayload?.damageType).toBe('magic')
    expect(proj.damagePayload?.baseAmount).toBe(60)
  })

  it('tier 2 bolts have 80 base damage', () => {
    const t2 = makeUnit('a_raichu', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.targetId = e.id
    cast(t2, s)
    advanceLeaps(t2, s)
    expect(raichuProjectiles(s)[0]?.damagePayload?.baseAmount).toBe(80)
  })

  it('tier 3 bolts have 100 base damage', () => {
    const t3 = makeUnit('a_raichu', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    t3.targetId = e.id
    cast(t3, s)
    advanceLeaps(t3, s)
    expect(raichuProjectiles(s)[0]?.damagePayload?.baseAmount).toBe(100)
  })

  it('adds +1% special damage per Beachy SpellBuff stack, applied on the next cast', () => {
    const ally = makeUnit('palossand', 'player', 1)  // 2nd Beachy species → SpellBuff threshold active
    ally.hexPos = { col: 2, row: 5 }
    state = createCombatState([caster, ally], [enemy])
    caster.targetId = enemy.id

    // First cast: 0 stacks going in, but increments SpellBuff to 1 for next time.
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(raichuProjectiles(state)[0]?.damagePayload?.baseAmount).toBe(60)
    state.projectiles.clear()
    caster.manaLockTimer = 0
    caster.state = 'idle'

    // Second cast: reads the 1 stack banked by the first cast → 60 + 1 = 61.
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(raichuProjectiles(state)[0]?.damagePayload?.baseAmount).toBe(61)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    caster.targetId = null
    cast(caster, state)
    advanceLeaps(caster, state)
    tickFx(state, 10)
    expect(raichuProjectiles(state)).toHaveLength(0)
  })
})
