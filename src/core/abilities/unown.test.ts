import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, getAbility } from '../systems/ability'
import type { Unit, CombatState } from '../types'

describe('Unown – Hidden Power', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('unown', 'player', 1)
    enemy  = makeUnit('dummy',  'enemy',  1)
    state  = createCombatState([caster], [enemy])
  })

  it('fires a projectile at the nearest enemy on cast', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')

    const handler = getAbility('unown_hidden_power')!
    handler.onCast(caster, state, 1)

    expect(state.projectiles.size).toBe(1)
    const proj = [...state.projectiles.values()][0]
    expect(proj.targetId).toBe(enemy.id)
    expect(['unown_hidden_power_ice', 'unown_hidden_power_fire', 'unown_hidden_power_electric'])
      .toContain(proj.abilityId)
  })

  it('fire type deals 50% more damage (tier 1: 225, tier 2: 300, tier 3: 450)', () => {
    const expected = [225, 300, 450]
    for (let tier = 1; tier <= 3; tier++) {
      const u = makeUnit('unown', 'player', tier as 1|2|3)
      const e = makeUnit('dummy', 'enemy', 1)
      const s = createCombatState([u], [e])
      const handler = getAbility('unown_hidden_power')!

      vi.spyOn(Math, 'random').mockReturnValue(1 / 3 + 0.01) // picks index 1 = 'fire'
      handler.onCast(u, s, tier as 1|2|3)
      vi.restoreAllMocks()

      const proj = [...s.projectiles.values()][0]
      expect(proj.damagePayload?.baseAmount).toBe(expected[tier - 1])
    }
  })

  it('base damage is 150/200/300 for ice and electric (tier scaling)', () => {
    const expected = [150, 200, 300]
    for (let tier = 1; tier <= 3; tier++) {
      const u = makeUnit('unown', 'player', tier as 1|2|3)
      const e = makeUnit('dummy', 'enemy', 1)
      const s = createCombatState([u], [e])
      const handler = getAbility('unown_hidden_power')!

      vi.spyOn(Math, 'random').mockReturnValue(0) // index 0 = 'ice'
      handler.onCast(u, s, tier as 1|2|3)
      vi.restoreAllMocks()

      const proj = [...s.projectiles.values()][0]
      expect(proj.damagePayload?.baseAmount).toBe(expected[tier - 1])
    }
  })

  it('ice type stuns the target on hit', () => {
    const handler = getAbility('unown_hidden_power')!
    vi.spyOn(Math, 'random').mockReturnValue(0) // ice
    handler.onCast(caster, state, 1)
    vi.restoreAllMocks()

    const proj = [...state.projectiles.values()][0]
    proj.onHit!(caster, enemy, state)
    expect(enemy.statusEffects.some(fx => fx.id === 'stun')).toBe(true)
  })

  it('electric type emits electric ring VFX on hit', () => {
    const handler = getAbility('unown_hidden_power')!
    vi.spyOn(Math, 'random').mockReturnValue(2 / 3 + 0.01) // electric
    handler.onCast(caster, state, 1)
    vi.restoreAllMocks()

    const proj = [...state.projectiles.values()][0]
    state.events = []
    proj.onHit!(caster, enemy, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as { effectId?: string }).effectId === 'unown_hp_electric_ring')).toBe(true)
  })
})
