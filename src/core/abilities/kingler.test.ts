import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks: number): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Kingler - Crabhammer', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('kingler', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state and sets correct cast timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(15)
  })

  it('adds one AttackModifier with 1 charge after cast (tier 1, no SpellBuff)', () => {
    cast(caster, state, 15)
    expect(caster.attackModifiers).toHaveLength(1)
    expect(caster.attackModifiers[0].remainingCharges).toBe(1)
    expect(caster.attackModifiers[0].bonusDamageType).toBe('physical')
  })

  it('attack modifier bonus damage is 120 at tier 1 with 0 SpellBuff stacks', () => {
    cast(caster, state, 15)
    expect(caster.attackModifiers[0].bonusDamage).toBe(120)
  })

  it('attack modifier bonus damage is 180 at tier 2 with 0 SpellBuff stacks', () => {
    const t2 = makeUnit('kingler', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s2 = createCombatState([t2], [enemy])
    cast(t2, s2, 15)
    expect(t2.attackModifiers[0].bonusDamage).toBe(180)
  })

  it('increments spellBuffCounters for beachy allies on cast', () => {
    cast(caster, state, 15)
    // Kingler is beachy; incrementSpellBuff should bump its own counter
    expect(state.spellBuffCounters.get(caster.id)).toBe(1)
  })

  it('bonus damage scales with SpellBuff stacks', () => {
    // Pre-seed 4 SpellBuff stacks on caster
    state.spellBuffCounters.set(caster.id, 4)
    cast(caster, state, 15)
    // bonusDamage = round(120 * (1 + 4 * 0.05)) = round(120 * 1.20) = 144
    expect(caster.attackModifiers[0].bonusDamage).toBe(144)
  })

  it('successive casts accumulate more SpellBuff stacks', () => {
    cast(caster, state, 15)
    const stacksAfterFirst = state.spellBuffCounters.get(caster.id) ?? 0
    cast(caster, state, 15)
    const stacksAfterSecond = state.spellBuffCounters.get(caster.id) ?? 0
    expect(stacksAfterSecond).toBeGreaterThan(stacksAfterFirst)
  })

  it('resets mana to 0 and applies mana lock after cast', () => {
    cast(caster, state, 15)
    expect(caster.currentMana).toBe(0)
    expect(caster.manaLockTimer).toBe(TICK_RATE)
  })
})
