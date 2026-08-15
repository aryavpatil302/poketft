import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('A-Marowak – Shadow Bone', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('a_marowak', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos  = { col: 3, row: 3 }  // 2 rows above — gives a clear direction
    enemy.maxHp   = 10000
    enemy.currentHp = 10000
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state on trigger', () => {
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

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('adds exactly 3 attack modifiers', () => {
    cast(caster, state)
    expect(caster.attackModifiers).toHaveLength(3)
  })

  it('modifiers have correct IDs and 1 charge each', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].id).toBe('a_marowak_bone')
    expect(caster.attackModifiers[1].id).toBe('a_marowak_bone')
    expect(caster.attackModifiers[2].id).toBe('a_marowak_bone_3')
    expect(caster.attackModifiers[0].remainingCharges).toBe(1)
    expect(caster.attackModifiers[1].remainingCharges).toBe(1)
    expect(caster.attackModifiers[2].remainingCharges).toBe(1)
  })

  it('swing modifier swingDir flips between -1 and +1', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0].swingDir).toBe(-1)
    expect(caster.attackModifiers[1].swingDir).toBe(1)
  })

  it('first swing onHit deals magic damage to target (tier 1 = 300 base)', () => {
    cast(caster, state)
    enemy.spDefense = 0; enemy._computedStats = null
    const hpBefore = enemy.currentHp
    caster.attackModifiers[0].onHit!(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent?.type === 'damage' && dmgEvent.damageType).toBe('magic')
  })

  it('swing damage scales per tier: 300 / 450 / 700', () => {
    const tiers = [1, 2, 3] as const
    const expected = [300, 450, 700]
    for (const tier of tiers) {
      const s = makeUnit('a_marowak', 'player', tier)
      s.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 3 }; e.maxHp = 10000; e.currentHp = 10000; e.spDefense = 0; e._computedStats = null
      const st = createCombatState([s], [e])
      s.currentMana = s.maxMana; triggerAbility(s, st)
      for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(s, st)
      st.events = []
      s.attackModifiers[0].onHit!(s, e, st)
      const dmgEvent = st.events.find(ev => ev.type === 'damage')
      if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(expected[tier - 1])
    }
  })

  it('finisher onHit deals magic damage to the primary target', () => {
    cast(caster, state)
    const hpBefore = enemy.currentHp
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent?.type === 'damage' && dmgEvent.damageType).toBe('magic')
  })

  it('finisher damage scales per tier: 450 / 600 / 850 base', () => {
    const tiers = [1, 2, 3] as const
    const expected = [450, 600, 850]
    for (const tier of tiers) {
      const s = makeUnit('a_marowak', 'player', tier)
      s.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 3 }; e.maxHp = 10000; e.currentHp = 10000; e.spDefense = 0; e._computedStats = null
      const st = createCombatState([s], [e])
      s.currentMana = s.maxMana; triggerAbility(s, st)
      for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(s, st)
      st.events = []
      s.attackModifiers[2].onHit!(s, e, st)
      const dmgEvent = st.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
      if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(expected[tier - 1])
    }
  })

  it('finisher hits enemies adjacent to primary target', () => {
    // Any neighbor of enemy (3,3) should be hit — (4,3) is a direct neighbor
    const coneEnemy = makeUnit('dummy', 'enemy', 1)
    coneEnemy.hexPos = { col: 4, row: 3 }
    coneEnemy.maxHp = 10000; coneEnemy.currentHp = 10000
    state = createCombatState([caster], [enemy, coneEnemy])
    cast(caster, state)
    coneEnemy.spDefense = 0; coneEnemy._computedStats = null
    const hpBefore = coneEnemy.currentHp
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(coneEnemy.currentHp).toBeLessThan(hpBefore)
  })

  it('finisher heals Marowak for 50% of total damage dealt', () => {
    cast(caster, state)
    enemy.spDefense = 0; enemy._computedStats = null
    caster.currentHp = 1
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(caster.currentHp).toBeGreaterThan(1)
    expect(state.events.some(e => e.type === 'heal')).toBe(true)
  })

  it('finisher emits marowak_shadow_bone_cone VFX event', () => {
    cast(caster, state)
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'marowak_shadow_bone_cone')).toBe(true)
  })

  it('finisher does not hit allies', () => {
    const ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 4, row: 3 }  // adjacent to enemy — must not be hit
    state = createCombatState([caster, ally], [enemy])
    cast(caster, state)
    const allyHpBefore = ally.currentHp
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(ally.currentHp).toBe(allyHpBefore)
  })

  it('chains through connected enemies even if not adjacent to primary target', () => {
    // enemy at (3,3), chain1 at (4,3) adjacent to enemy, chain2 at (5,3) adjacent to chain1 only
    const chain1 = makeUnit('dummy', 'enemy', 1)
    chain1.hexPos = { col: 4, row: 3 }
    chain1.maxHp = 10000; chain1.currentHp = 10000
    const chain2 = makeUnit('dummy', 'enemy', 1)
    chain2.hexPos = { col: 5, row: 3 }
    chain2.maxHp = 10000; chain2.currentHp = 10000
    state = createCombatState([caster], [enemy, chain1, chain2])
    cast(caster, state)
    chain1.spDefense = 0; chain1._computedStats = null
    chain2.spDefense = 0; chain2._computedStats = null
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(chain1.currentHp).toBeLessThan(10000)
    expect(chain2.currentHp).toBeLessThan(10000)
  })

  it('chains to at most 3 other enemies beyond the primary target', () => {
    // A straight line of 4 connected enemies beyond the primary — only the
    // nearest 3 (chain1-3) should be hit; chain4 is one hop too far.
    const chain1 = makeUnit('dummy', 'enemy', 1); chain1.hexPos = { col: 4, row: 3 }; chain1.maxHp = 10000; chain1.currentHp = 10000
    const chain2 = makeUnit('dummy', 'enemy', 1); chain2.hexPos = { col: 5, row: 3 }; chain2.maxHp = 10000; chain2.currentHp = 10000
    const chain3 = makeUnit('dummy', 'enemy', 1); chain3.hexPos = { col: 6, row: 3 }; chain3.maxHp = 10000; chain3.currentHp = 10000
    const chain4 = makeUnit('dummy', 'enemy', 1); chain4.hexPos = { col: 7, row: 3 }; chain4.maxHp = 10000; chain4.currentHp = 10000
    state = createCombatState([caster], [enemy, chain1, chain2, chain3, chain4])
    cast(caster, state)
    for (const u of [chain1, chain2, chain3, chain4]) { u.spDefense = 0; u._computedStats = null }
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(chain1.currentHp).toBeLessThan(10000)
    expect(chain2.currentHp).toBeLessThan(10000)
    expect(chain3.currentHp).toBeLessThan(10000)
    expect(chain4.currentHp).toBe(10000)   // 4th chained enemy is beyond the cap — untouched
  })

  it('does not chain to isolated enemies not touching any hit enemy', () => {
    const isolated = makeUnit('dummy', 'enemy', 1)
    isolated.hexPos = { col: 0, row: 0 }  // far away, no connection
    isolated.maxHp = 10000; isolated.currentHp = 10000
    state = createCombatState([caster], [enemy, isolated])
    cast(caster, state)
    isolated.spDefense = 0; isolated._computedStats = null
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    expect(isolated.currentHp).toBe(10000)
  })

  it('finisher does not hit the same unit twice', () => {
    cast(caster, state)
    enemy.spDefense = 0; enemy._computedStats = null
    state.events = []
    caster.attackModifiers[2].onHit!(caster, enemy, state)
    const dmgCount = state.events.filter(e => e.type === 'damage' && e.targetId === enemy.id).length
    expect(dmgCount).toBe(1)
  })
})
