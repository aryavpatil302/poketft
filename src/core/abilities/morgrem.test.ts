import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 20
const AURA_TICKS = 3 * TICK_RATE
const SLAP_DAMAGE_TICK = 10

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

describe('Morgrem - Spirit Break', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('morgrem', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // adjacent — inside the 1-hex drain aura
    state = createCombatState([caster], [enemy])
  })

  it('grants caster a shield of 350 at tier 1', () => {
    cast(caster, state)
    const shield = caster.shields.find(s => s.sourceAbility === 'morgrem_spirit_break')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(350)
    expect(shield!.durationTicks).toBe(3 * TICK_RATE)
  })

  it('shield values are 350 / 430 / 550 at tiers 1 / 2 / 3', () => {
    const expected = [350, 430, 550] as const
    for (const tier of [1, 2, 3] as const) {
      const u = makeUnit('morgrem', 'player', tier)
      u.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const s = createCombatState([u], [e])
      cast(u, s)
      const shield = u.shields.find(sh => sh.sourceAbility === 'morgrem_spirit_break')
      expect(shield?.value).toBe(expected[tier - 1])
    }
  })

  it('adds the drain aura status lasting 3 seconds (suppresses mana gain)', () => {
    cast(caster, state)
    const aura = caster.statusEffects.find(e => e.stackId === 'morgrem_spirit_break_aura')
    expect(aura).toBeDefined()
    expect(aura!.durationTicks).toBe(AURA_TICKS)
    expect(aura!.suppressManaGain).toBe(true)
  })

  it('aura drains mana from adjacent enemies (2 per 0.5s at tier 1)', () => {
    enemy.currentMana = 50
    cast(caster, state)
    tickFx(state, AURA_TICKS)
    // 6 drain pulses × 2 mana = 12 drained
    expect(enemy.currentMana).toBe(38)
  })

  it('mana does not drop below 0 from drain', () => {
    enemy.currentMana = 1
    cast(caster, state)
    tickFx(state, AURA_TICKS)
    expect(enemy.currentMana).toBeGreaterThanOrEqual(0)
  })

  it('aura expiry triggers the slap, dealing burst magic damage after 10 more ticks', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    tickFx(state, AURA_TICKS + SLAP_DAMAGE_TICK + 1)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && e.targetId === enemy.id && (e as any).damageType === 'magic'
    )
    expect(dmgEvent).toBeDefined()
  })

  it('slap damage includes drained mana (base 50 + drained at tier 1)', () => {
    enemy.currentMana = 50
    cast(caster, state)
    tickFx(state, AURA_TICKS + SLAP_DAMAGE_TICK + 1)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // base 50 + 12 drained = 62 raw → * 100/130 (dummy spDef 30) = 48
      expect(dmgEvent.amount).toBe(48)
    }
  })

  it('emits a shield event with correct amount', () => {
    cast(caster, state)
    const shieldEvent = state.events.find(e => e.type === 'shield')
    expect(shieldEvent).toBeDefined()
    if (shieldEvent?.type === 'shield') {
      expect(shieldEvent.amount).toBe(350)
    }
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })
})
