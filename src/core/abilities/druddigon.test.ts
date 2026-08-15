import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS  = 32
const SLIDE_TICKS = 25

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function tickFx(state: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
  }
}

describe('Druddigon - Dragon Tail', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('druddigon', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('enters casting state with 32-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('deals physical damage to nearest enemy (tier 1, non-killing blow)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('deals more damage at tier 2', () => {
    const t1 = makeUnit('druddigon', 'player', 1)
    t1.hexPos = { col: 3, row: 5 }
    t1.critChance = 0
    t1._computedStats = null
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const s1 = createCombatState([t1], [e1])
    cast(t1, s1)
    const dmgT1 = e1.maxHp - e1.currentHp

    const t2 = makeUnit('druddigon', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.critChance = 0
    t2._computedStats = null
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const dmgT2 = e2.maxHp - e2.currentHp

    expect(dmgT2).toBeGreaterThan(dmgT1)
  })

  it('deals more damage at tier 3 than tier 2', () => {
    const t2 = makeUnit('druddigon', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.critChance = 0
    t2._computedStats = null
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const dmgT2 = e2.maxHp - e2.currentHp

    const t3 = makeUnit('druddigon', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    t3.critChance = 0
    t3._computedStats = null
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const dmgT3 = e3.maxHp - e3.currentHp

    expect(dmgT3).toBeGreaterThan(dmgT2)
  })

  it('non-killing blow does NOT start the knockback slide', () => {
    // Enemy at full HP — damage won't kill
    cast(caster, state)
    expect(enemy.statusEffects.some(e => e.id === 'druddigon_knockback')).toBe(false)
    expect(enemy.statusEffects.some(e => e.id === 'stun')).toBe(false)
  })

  it('killing blow stuns the target and starts the knockback slide', () => {
    enemy.currentHp = 50  // will die to the blow
    cast(caster, state)
    expect(enemy.statusEffects.some(e => e.id === 'stun')).toBe(true)
    expect(enemy.statusEffects.some(e => e.id === 'druddigon_knockback')).toBe(true)
    // Invulnerable during the slide so intermediate ticks can't kill early
    expect(enemy.incomingDamageMult).toBe(0)
  })

  it('killing blow kills the target after the slide completes', () => {
    enemy.currentHp = 50
    cast(caster, state)
    tickFx(state, SLIDE_TICKS)
    expect(enemy.state).toBe('dead')
  })

  it('emits damage event after cast', () => {
    cast(caster, state)
    const dmgEvt = state.events.find(e => e.type === 'damage')
    expect(dmgEvt).toBeDefined()
  })
})
