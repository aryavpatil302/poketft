import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickShields } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Xatu – Magic Bounce', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('xatu', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [enemy])
  })

  it('applies a shield on cast', () => {
    cast(caster, state)
    expect(caster.shields.length).toBe(1)
    expect(caster.shields[0].sourceAbility).toBe('xatu_magic_bounce')
  })

  it('shield value scales per tier (400 / 475 / 600)', () => {
    const expected = [400, 475, 600] as const
    for (const tier of [1, 2, 3] as const) {
      const u = makeUnit('xatu', 'player', tier)
      const st = createCombatState([u], [])
      u.currentMana = u.maxMana
      triggerAbility(u, st)
      for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(u, st)
      expect(u.shields[0].value).toBe(expected[tier - 1])
    }
  })

  it('emits a shield event on cast', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'shield' && e.unitId === caster.id)).toBe(true)
  })

  it('shield has a 3-second duration (180 ticks)', () => {
    cast(caster, state)
    expect(caster.shields[0].durationTicks).toBe(180)
  })

  it('when shield expires with stored damage, queues an empowered attack modifier', () => {
    cast(caster, state)
    const shield = caster.shields[0]
    shield.value = shield.maxValue - 200  // simulate 200 absorbed
    shield.durationTicks = 1
    tickShields(new Map([[caster.id, caster]]))
    expect(caster.attackModifiers.some(m => m.id === 'xatu_bounce_shot')).toBe(true)
  })

  it('when shield breaks, queues an empowered attack modifier', () => {
    cast(caster, state)
    // Use magic damage + zero spDef so post-mitigation damage exceeds the shield
    caster.spDefense = 0; caster._computedStats = null
    applyDamage(enemy, caster, { baseAmount: 99999, damageType: 'magic', canCrit: false }, state)
    expect(caster.attackModifiers.some(m => m.id === 'xatu_bounce_shot')).toBe(true)
  })

  it('empowered attack deals 90% of stored damage (tier 1)', () => {
    cast(caster, state)
    const shield = caster.shields[0]
    shield.value = shield.maxValue - 400  // simulate 400 absorbed
    shield.durationTicks = 1
    tickShields(new Map([[caster.id, caster]]))

    const mod = caster.attackModifiers.find(m => m.id === 'xatu_bounce_shot')
    expect(mod).toBeDefined()
    enemy.spDefense = 0; enemy._computedStats = null
    const hpBefore = enemy.currentHp
    mod!.onHit!(caster, enemy, state)
    expect(hpBefore - enemy.currentHp).toBeCloseTo(360, -1)  // 90% of 400
  })

  it('empowered attack ratio scales per tier (90% / 120% / 150%)', () => {
    const ratios = [0.90, 1.20, 1.50]
    const absorbed = 300
    for (const tier of [1, 2, 3] as const) {
      const u = makeUnit('xatu', 'player', tier)
      const e = makeUnit('dummy', 'enemy', 1)
      e.spDefense = 0; e._computedStats = null
      const st = createCombatState([u], [e])
      u.currentMana = u.maxMana
      triggerAbility(u, st)
      for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(u, st)
      const s = u.shields[0]
      s.value = s.maxValue - absorbed
      s.durationTicks = 1
      tickShields(new Map([[u.id, u]]))
      const mod = u.attackModifiers.find(m => m.id === 'xatu_bounce_shot')
      expect(mod).toBeDefined()
      const hpBefore = e.currentHp
      mod!.onHit!(u, e, st)
      const expected = Math.round(absorbed * ratios[tier - 1])
      expect(hpBefore - e.currentHp).toBeCloseTo(expected, -1)
    }
  })

  it('no modifier queued if shield took no damage', () => {
    cast(caster, state)
    const shield = caster.shields[0]
    shield.durationTicks = 1
    tickShields(new Map([[caster.id, caster]]))
    expect(caster.attackModifiers.some(m => m.id === 'xatu_bounce_shot')).toBe(false)
  })

  it('empowered attack has only 1 charge', () => {
    cast(caster, state)
    const shield = caster.shields[0]
    shield.value = shield.maxValue - 200
    shield.durationTicks = 1
    tickShields(new Map([[caster.id, caster]]))
    const mod = caster.attackModifiers.find(m => m.id === 'xatu_bounce_shot')
    expect(mod?.remainingCharges).toBe(1)
  })

  it('mana resets to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })
})
