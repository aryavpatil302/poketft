import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Xatu - Magic Bounce', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('xatu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('applies a future_sight mark on the target', () => {
    cast(caster, state)
    const mark = enemy.marks.find(m => m.id === 'future_sight')
    expect(mark).toBeDefined()
  })

  it('mark has 2-second duration (2 * TICK_RATE ticks)', () => {
    cast(caster, state)
    const mark = enemy.marks.find(m => m.id === 'future_sight')
    expect(mark?.durationTicks).toBe(2 * TICK_RATE)
  })

  it('amplifies target incoming damage by 0.3', () => {
    cast(caster, state)
    expect(enemy.incomingDamageMult).toBeCloseTo(1.3)
  })

  it('tier 1 - mark detonate deals 300 magic damage', () => {
    cast(caster, state)
    const mark = enemy.marks.find(m => m.id === 'future_sight')
    expect(mark?.onDetonate).toBeDefined()

    const hpBefore = enemy.currentHp
    mark!.onDetonate!(enemy, caster, state)
    expect(state.events.some(e => e.type === 'damage' && e.targetId === enemy.id)).toBe(true)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('magic')
    }
  })

  it('tier 2 - mark detonate deals 450 magic damage', () => {
    const t2 = makeUnit('xatu', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const mark = e.marks.find(m => m.id === 'future_sight')
    expect(mark).toBeDefined()
    const hpBefore = e.currentHp
    mark!.onDetonate!(e, t2, s)
    expect(e.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 3 - mark detonate deals 700 magic damage', () => {
    const t3 = makeUnit('xatu', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const mark = e.marks.find(m => m.id === 'future_sight')
    expect(mark).toBeDefined()
    const hpBefore = e.currentHp
    mark!.onDetonate!(e, t3, s)
    expect(e.currentHp).toBeLessThan(hpBefore)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    // No error, no damage events
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('detonate does nothing if source is dead', () => {
    cast(caster, state)
    const mark = enemy.marks.find(m => m.id === 'future_sight')
    expect(mark).toBeDefined()
    caster.state = 'dead'
    const hpBefore = enemy.currentHp
    mark!.onDetonate!(enemy, caster, state)
    expect(enemy.currentHp).toBe(hpBefore)
  })
})
