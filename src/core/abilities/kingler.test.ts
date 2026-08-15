import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

// Guard against re-firing when castTimeTicks is very short
function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < 50; i++) {
    if (caster.state !== 'casting') break
    tickAbilityCast(caster, state)
  }
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
    expect(caster.abilityCastTimer).toBe(1)
  })

  it('adds one AttackModifier with 1 charge after cast (tier 1, no SpellBuff)', () => {
    cast(caster, state)
    expect(caster.attackModifiers).toHaveLength(1)
    expect(caster.attackModifiers[0].remainingCharges).toBe(1)
    expect(caster.attackModifiers[0].bonusDamageType).toBe('physical')
  })

  it('attack modifier bonus damage is 200 at tier 1 with 0 SpellBuff stacks', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].bonusDamage).toBe(200)
  })

  it('attack modifier bonus damage is 350 at tier 2 with 0 SpellBuff stacks', () => {
    const t2 = makeUnit('kingler', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s2 = createCombatState([t2], [enemy])
    cast(t2, s2)
    expect(t2.attackModifiers[0].bonusDamage).toBe(350)
  })

  it('increments spellBuffCounters for beachy allies on cast', () => {
    // Need 2 beachy species for the threshold to activate
    const beachyAlly = makeUnit('palossand', 'player', 1)
    beachyAlly.hexPos = { col: 5, row: 5 }
    const s = createCombatState([caster, beachyAlly], [enemy])
    cast(caster, s)
    // Both beachy allies should receive +1 spell buff
    expect(s.spellBuffCounters.get(caster.id)).toBe(1)
    expect(s.spellBuffCounters.get(beachyAlly.id)).toBe(1)
  })

  it('bonus damage scales with SpellBuff stacks (5% per stack)', () => {
    // Pre-seed 4 SpellBuff stacks on caster
    state.spellBuffCounters.set(caster.id, 4)
    cast(caster, state)
    // bonusDamage = round(200 * (1 + 4 * 0.01)) = round(200 * 1.04) = 208
    expect(caster.attackModifiers[0].bonusDamage).toBe(208)
  })

  it('successive casts accumulate more SpellBuff stacks', () => {
    const beachyAlly = makeUnit('palossand', 'player', 1)
    beachyAlly.hexPos = { col: 5, row: 5 }
    const s = createCombatState([caster, beachyAlly], [enemy])
    cast(caster, s)
    const stacksAfterFirst = s.spellBuffCounters.get(caster.id) ?? 0
    cast(caster, s)
    const stacksAfterSecond = s.spellBuffCounters.get(caster.id) ?? 0
    expect(stacksAfterSecond).toBeGreaterThan(stacksAfterFirst)
  })

  it('resets mana to 0 and applies mana lock after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
    expect(caster.manaLockTimer).toBe(TICK_RATE)
  })
})
