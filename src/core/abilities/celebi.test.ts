import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickMarks } from '../systems/marks'
import { applyDamage } from '../systems/damage'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function tickAllMarks(state: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    tickMarks(state.units, state)
  }
}

describe('Celebi - Future Sight', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('celebi', 'player', 1)
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

  it('marks the nearest unmarked enemy', () => {
    cast(caster, state)
    expect(enemy.marks.some(m => m.id === `celebi_mark_${enemy.id}`)).toBe(true)
  })

  it('subsequent casts mark a different (unmarked) enemy', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [enemy, enemy2])
    cast(caster, state)
    cast(caster, state)
    expect(enemy.marks.length + enemy2.marks.length).toBe(2)
  })

  it('amplifies incoming damage on the marked target (tier 1 = 1.1)', () => {
    cast(caster, state)
    expect(enemy.incomingDamageMult).toBeCloseTo(1.1)
  })

  it('tier 2 - amplifies incoming damage mult to 1.2', () => {
    const t2 = makeUnit('celebi', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    expect(e.incomingDamageMult).toBeCloseTo(1.2)
  })

  it('tier 3 - amplifies incoming damage mult to 1.3', () => {
    const t3 = makeUnit('celebi', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    expect(e.incomingDamageMult).toBeCloseTo(1.3)
  })

  it('mark detonates after 2 seconds dealing amplified magic damage (tier 1 = 381)', () => {
    cast(caster, state)
    tickAllMarks(state, 2 * TICK_RATE + 1)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 450 raw * 1.1 amp = 495 → * 100/130 (dummy spDef 30) = 381
      expect(dmgEvent.amount).toBe(381)
      expect(dmgEvent.damageType).toBe('magic')
    }
  })

  it('detonation resets incoming damage mult to 1.0', () => {
    cast(caster, state)
    tickAllMarks(state, 2 * TICK_RATE + 1)
    expect(enemy.incomingDamageMult).toBe(1.0)
  })

  it('adds a hop animation status on cast', () => {
    cast(caster, state)
    expect(caster.statusEffects.some(e => e.stackId === 'celebi_hop')).toBe(true)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    tickAllMarks(state, 2 * TICK_RATE + 1)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('transfers the mark to the nearest enemy, with remaining timing, if the carrier dies first', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [enemy, enemy2])
    cast(caster, state)
    expect(enemy.marks.some(m => m.id === `celebi_mark_${enemy.id}`)).toBe(true)

    // Tick the mark partway down, then kill the carrier before it detonates.
    tickAllMarks(state, TICK_RATE)
    const remaining = enemy.marks.find(m => m.id === `celebi_mark_${enemy.id}`)?.durationTicks
    expect(remaining).toBeGreaterThan(0)
    applyDamage(caster, enemy, { baseAmount: 99999, damageType: 'true', canCrit: false }, state)
    expect(enemy.state).toBe('dead')

    // Mark should have jumped to enemy2 with the same remaining duration,
    // and the damage amp should follow it (not linger on the corpse).
    expect(enemy.incomingDamageMult).toBe(1.0)
    const transferred = enemy2.marks.find(m => m.id === `celebi_mark_${enemy2.id}`)
    expect(transferred).toBeDefined()
    expect(transferred?.durationTicks).toBe(remaining)
    expect(enemy2.incomingDamageMult).toBeCloseTo(1.1)

    // Ticking the rest of the way down should now detonate on enemy2.
    tickAllMarks(state, remaining!)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy2.id)
    expect(dmgEvent).toBeDefined()
    expect(enemy2.incomingDamageMult).toBe(1.0)
  })
})
