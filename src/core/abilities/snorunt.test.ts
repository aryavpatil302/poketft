import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { applyDamage } from '../systems/damage'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Snorunt - Ice Body', () => {
  let caster: Unit
  let attacker: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('snorunt', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    attacker = makeUnit('dummy', 'enemy', 1)
    attacker.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [attacker])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('emits a shield event after cast', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'shield')).toBe(true)
  })

  it('applies a shield to caster after cast (tier 1 = 150)', () => {
    cast(caster, state)
    expect(caster.shields).toHaveLength(1)
    expect(caster.shields[0].value).toBe(150)
    expect(caster.shields[0].sourceAbility).toBe('snorunt_ice_body')
  })

  it('shield duration is 3 * TICK_RATE', () => {
    cast(caster, state)
    expect(caster.shields[0].durationTicks).toBe(3 * TICK_RATE)
  })

  it('tier 2 shield value is 200', () => {
    const t2 = makeUnit('snorunt', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 4 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    expect(t2.shields[0].value).toBe(200)
  })

  it('tier 3 shield value is 300', () => {
    const t3 = makeUnit('snorunt', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 4 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    expect(t3.shields[0].value).toBe(300)
  })

  it('attacker hitting active Ice Body shield is chilled', () => {
    cast(caster, state)
    expect(caster.shields.some(s => s.sourceAbility === 'snorunt_ice_body')).toBe(true)

    // attacker hits Snorunt while shield is up
    applyDamage(attacker, caster, {
      baseAmount: 50,
      damageType: 'physical',
      canCrit: false,
      abilityId: 'auto_attack',
    }, state)

    const chill = attacker.statusEffects.find(fx => fx.id === 'chill')
    expect(chill).toBeDefined()
    expect(chill!.magnitude).toBe(0.30)
  })

  it('attacker NOT chilled when shield is already depleted', () => {
    cast(caster, state)
    // Deplete the shield first with a large hit
    applyDamage(attacker, caster, {
      baseAmount: 9999,
      damageType: 'true',
      canCrit: false,
      abilityId: 'auto_attack',
    }, state)

    // Verify shield is gone, attacker was chilled on the hit that broke it
    // Now hit again — this second hit should NOT re-chill (shield is gone)
    attacker.statusEffects = attacker.statusEffects.filter(fx => fx.id !== 'chill')
    applyDamage(attacker, caster, {
      baseAmount: 50,
      damageType: 'physical',
      canCrit: false,
      abilityId: 'auto_attack',
    }, state)

    const chill = attacker.statusEffects.find(fx => fx.id === 'chill')
    expect(chill).toBeUndefined()
  })

  it('shield has no onExpire callback', () => {
    cast(caster, state)
    expect(caster.shields[0].onExpire).toBeUndefined()
  })
})
