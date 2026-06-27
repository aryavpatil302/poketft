import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Aerodactyl - Ancient Power', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('aerodactyl', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('permanently increases attack by 8% at tier 1', () => {
    const atkBefore = caster.attack
    cast(caster, state)
    expect(caster.attack).toBe(Math.round(atkBefore * 1.08))
  })

  it('permanently increases special by 8% at tier 1', () => {
    const specBefore = caster.special
    cast(caster, state)
    expect(caster.special).toBe(Math.round(specBefore * 1.08))
  })

  it('permanently increases defense by 8% at tier 1', () => {
    const defBefore = caster.defense
    cast(caster, state)
    expect(caster.defense).toBe(Math.round(defBefore * 1.08))
  })

  it('permanently increases spDefense by 8% at tier 1', () => {
    const spDefBefore = caster.spDefense
    cast(caster, state)
    expect(caster.spDefense).toBe(Math.round(spDefBefore * 1.08))
  })

  it('permanently increases maxHp by 8% at tier 1', () => {
    const maxHpBefore = caster.maxHp
    cast(caster, state)
    expect(caster.maxHp).toBe(Math.round(maxHpBefore * 1.08))
  })

  it('all stats increase by 12% at tier 2', () => {
    const t2 = makeUnit('aerodactyl', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    const atkBefore = t2.attack
    const specBefore = t2.special
    cast(t2, s2)
    expect(t2.attack).toBe(Math.round(atkBefore * 1.12))
    expect(t2.special).toBe(Math.round(specBefore * 1.12))
  })

  it('all stats increase by 20% at tier 3', () => {
    const t3 = makeUnit('aerodactyl', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    const atkBefore = t3.attack
    cast(t3, s3)
    expect(t3.attack).toBe(Math.round(atkBefore * 1.20))
  })

  it('adds a passiveAttackHandler with id aerodactyl_rock', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'aerodactyl_rock')
    expect(handler).toBeDefined()
  })

  it('does not add duplicate passiveAttackHandler on second cast', () => {
    cast(caster, state)
    caster.currentMana = caster.maxMana
    cast(caster, state)
    const handlers = caster.passiveAttackHandlers.filter(h => h.id === 'aerodactyl_rock')
    expect(handlers).toHaveLength(1)
  })

  it('passiveAttackHandler adds a projectile to state when called', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'aerodactyl_rock')!
    handler.onAttack(caster, enemy, state)
    expect(state.projectiles.size).toBeGreaterThan(0)
  })

  it('invalidates _computedStats after cast', () => {
    cast(caster, state)
    // _computedStats should be null after permanent stat change
    expect(caster._computedStats).toBeNull()
  })
})
