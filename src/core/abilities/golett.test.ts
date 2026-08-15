import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  tickAbilityCast(caster, state)
}

describe('Golett - Shadow Punch', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('golett', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('registers passive handler golett_special_passive after cast', () => {
    cast(caster, state)
    expect(caster.passiveAttackHandlers.some(h => h.id === 'golett_special_passive')).toBe(true)
  })

  it('does not duplicate passive handler on second cast', () => {
    cast(caster, state)
    cast(caster, state)
    expect(caster.passiveAttackHandlers.filter(h => h.id === 'golett_special_passive')).toHaveLength(1)
  })

  it('passive deals 30% of special as magic damage on every auto', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'golett_special_passive')!
    const hpBefore = enemy.currentHp
    handler.onAttack(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('grants a shield of 200/250/325 by tier', () => {
    const shields = [200, 250, 325] as const
    for (const tier of [1, 2, 3] as const) {
      const c = makeUnit('golett', 'player', tier)
      c.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const s = createCombatState([c], [e])
      cast(c, s)
      const sh = c.shields.find(x => x.sourceAbility === 'golett_shadow_punch')
      expect(sh?.value).toBe(shields[tier - 1])
      expect(sh?.durationTicks).toBe(4 * TICK_RATE)
    }
  })

  it('pushes shadow_punch_empowered attack modifier with 1 charge and correct bonus damage', () => {
    const dmgs = [200, 375, 791] as const  // attack% scaling: [400,500,700]% of attack
    for (const tier of [1, 2, 3] as const) {
      const c = makeUnit('golett', 'player', tier)
      c.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const s = createCombatState([c], [e])
      cast(c, s)
      const mod = c.attackModifiers.find(m => m.id === 'shadow_punch_empowered')
      expect(mod).toBeDefined()
      expect(mod!.remainingCharges).toBe(1)
      expect(mod!.bonusDamage).toBe(dmgs[tier - 1])
      expect(mod!.bonusDamageType).toBe('physical')
    }
  })

  it('modifier onHit emits shadow_punch_appear vfx event', () => {
    cast(caster, state)
    const mod = caster.attackModifiers.find(m => m.id === 'shadow_punch_empowered')!
    mod.onHit!(caster, enemy, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'shadow_punch_appear')).toBe(true)
  })

  it('modifier onHit registers the follow-up timer status effect', () => {
    cast(caster, state)
    const mod = caster.attackModifiers.find(m => m.id === 'shadow_punch_empowered')!
    mod.onHit!(caster, enemy, state)
    expect(caster.statusEffects.some(fx => fx.stackId === 'golett_follow_up_timer')).toBe(true)
  })

  it('follow-up deals 100/150/200 magic damage after 2 seconds', () => {
    const followDmgs = [100, 150, 200] as const
    for (const tier of [1, 2, 3] as const) {
      const c = makeUnit('golett', 'player', tier)
      c.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      e.defense = 0; (e as any)._computedStats = null
      const s = createCombatState([c], [e])
      cast(c, s)
      const mod = c.attackModifiers.find(m => m.id === 'shadow_punch_empowered')!
      mod.onHit!(c, e, s)

      const hpAfterHit = e.currentHp
      // Tick down the 2-second follow-up timer
      const units = new Map([[c.id, c], [e.id, e]])
      for (let i = 0; i < 2 * TICK_RATE; i++) tickStatusEffects(units, s)

      expect(s.events.some(ev => ev.type === 'vfx' && (ev as any).effectId === 'shadow_punch_fly')).toBe(true)
      expect(e.currentHp).toBeLessThan(hpAfterHit)
    }
  })
})
