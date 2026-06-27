import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Typhlosion - Eruption', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('typhlosion', 'player', 1)
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

  it('resets mana to 0 after cast animation completes', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('tier 1 - deals damage to exactly 1 enemy', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 4, row: 2 }
    const enemy3 = makeUnit('dummy', 'enemy', 1)
    enemy3.hexPos = { col: 5, row: 2 }
    state = createCombatState([caster], [enemy, enemy2, enemy3])

    const hpBefore2 = enemy2.currentHp
    const hpBefore3 = enemy3.currentHp

    cast(caster, state)

    // Only the nearest enemy should take damage (tier 1 = 1 target)
    const damaged = [enemy, enemy2, enemy3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(1)
  })

  it('tier 2 - deals damage to exactly 2 enemies', () => {
    const t2 = makeUnit('typhlosion', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 5, row: 2 }
    const s = createCombatState([t2], [e1, e2, e3])
    t2.currentMana = t2.maxMana
    triggerAbility(t2, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t2, s)

    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(2)
  })

  it('tier 3 - deals damage to exactly 3 enemies', () => {
    const t3 = makeUnit('typhlosion', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 5, row: 2 }
    const s = createCombatState([t3], [e1, e2, e3])
    t3.currentMana = t3.maxMana
    triggerAbility(t3, s)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(t3, s)

    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(3)
  })

  it('tier 1 - deals magic damage (emits damage event)', () => {
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('magic')
      expect(dmgEvent.targetId).toBe(enemy.id)
    }
  })

  it('tier 1 - reduces enemy HP', () => {
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(enemy.maxHp)
  })

  it('tier 1 - applies burn status effect to hit enemy', () => {
    cast(caster, state)
    const burn = enemy.statusEffects.find(e => e.id === 'burn')
    expect(burn).toBeDefined()
  })

  it('burn has correct duration (3 seconds)', () => {
    cast(caster, state)
    const burn = enemy.statusEffects.find(e => e.id === 'burn')
    expect(burn?.durationTicks).toBe(3 * TICK_RATE)
  })

  it('burn has correct magnitude (30 dmg/sec) and tickInterval (1 tick = TICK_RATE)', () => {
    cast(caster, state)
    const burn = enemy.statusEffects.find(e => e.id === 'burn')
    expect(burn?.magnitude).toBe(30)
    expect(burn?.tickInterval).toBe(TICK_RATE)
  })

  it('burn tick effect deals true damage to enemy', () => {
    cast(caster, state)
    const burn = enemy.statusEffects.find(e => e.id === 'burn')
    expect(burn?.tickEffect).toBeDefined()

    const hpBefore = enemy.currentHp
    burn!.tickEffect!(enemy, state)

    expect(enemy.currentHp).toBe(Math.max(0, hpBefore - 30))
    const burnDmgEvent = state.events.find(
      e => e.type === 'damage' && (e as any).damageType === 'true' && e.targetId === enemy.id
    )
    expect(burnDmgEvent).toBeDefined()
  })

  it('does nothing when there are no enemies', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    // No errors, no damage events
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
