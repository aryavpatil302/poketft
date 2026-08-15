import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickProjectiles } from '../projectile'
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

function resolveProjectiles(state: CombatState, maxTicks = 300): void {
  for (let i = 0; i < maxTicks && state.projectiles.size > 0; i++) {
    tickProjectiles(state)
  }
}

describe('Sableye - Power Gem', () => {
  let caster: Unit
  let ally: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('sableye', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    ally = makeUnit('sableye', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster, ally], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('first cast fires a shield gem at the lowest-HP ally', () => {
    ally.currentHp = Math.floor(ally.maxHp / 2)
    cast(caster, state)
    const shieldProjs = [...state.projectiles.values()].filter(p => p.abilityId === 'sableye_power_gem_shield')
    expect(shieldProjs.length).toBeGreaterThan(0)
    expect(shieldProjs[0].targetId).toBe(ally.id)
  })

  it('shield gem grants a 250 shield at tier 1 (3 seconds)', () => {
    cast(caster, state)
    resolveProjectiles(state)
    const shield = ally.shields.find(s => s.sourceAbility === 'sableye_power_gem')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(250)
    expect(shield!.durationTicks).toBeLessThanOrEqual(3 * TICK_RATE)
  })

  it('second cast fires damage gems at up to 2 nearest enemies', () => {
    cast(caster, state)
    resolveProjectiles(state)
    cast(caster, state)
    const dmgProjs = [...state.projectiles.values()].filter(p => p.abilityId === 'sableye_power_gem_damage')
    expect(dmgProjs.length).toBeGreaterThan(0)
    expect(dmgProjs[0].targetId).toBe(enemy.id)
    expect(dmgProjs[0].damagePayload?.damageType).toBe('magic')
  })

  it('damage gem deals 200 base magic damage at tier 1 (154 after dummy spDef)', () => {
    cast(caster, state)
    resolveProjectiles(state)
    state.events = []
    cast(caster, state)
    resolveProjectiles(state)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 200 raw * 100/130 = 154
      expect(dmgEvent.amount).toBe(154)
    }
  })

  it('third cast is a shield cast again (parity toggles)', () => {
    cast(caster, state)
    resolveProjectiles(state)
    cast(caster, state)
    resolveProjectiles(state)
    ally.shields = []
    cast(caster, state)
    resolveProjectiles(state)
    expect(ally.shields.some(s => s.sourceAbility === 'sableye_power_gem')).toBe(true)
  })

  it('with no allies, first cast fires damage gems instead', () => {
    const solo = makeUnit('sableye', 'player', 1)
    solo.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([solo], [e])
    cast(solo, s)
    const dmgProjs = [...s.projectiles.values()].filter(p => p.abilityId === 'sableye_power_gem_damage')
    expect(dmgProjs.length).toBeGreaterThan(0)
  })

  it('tier 2 shield gem grants 325 shield', () => {
    const t2 = makeUnit('sableye', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const a2 = makeUnit('sableye', 'player', 1)
    a2.hexPos = { col: 4, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2, a2], [e2])
    cast(t2, s2)
    resolveProjectiles(s2)
    const shield = a2.shields.find(sh => sh.sourceAbility === 'sableye_power_gem')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(325)
  })

  it('tier 3 shield gem grants 425 shield', () => {
    const t3 = makeUnit('sableye', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const a3 = makeUnit('sableye', 'player', 1)
    a3.hexPos = { col: 4, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3, a3], [e3])
    cast(t3, s3)
    resolveProjectiles(s3)
    const shield = a3.shields.find(sh => sh.sourceAbility === 'sableye_power_gem')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(425)
  })

  it('adds a brief launch rumble on cast', () => {
    cast(caster, state)
    expect(caster.statusEffects.some(e => e.stackId === 'sableye_rumble')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })
})
