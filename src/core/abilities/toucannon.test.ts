import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Toucannon - Beak Blast', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('toucannon', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.visualPos = { x: 300, y: 500 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
    caster.targetId = enemy.id
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
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

  it('fires a projectile at the target', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    expect(proj).toBeDefined()
    expect(proj!.targetId).toBe(enemy.id)
  })

  it('projectile carries physical damage payload (canCrit=true)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    expect(proj?.damagePayload?.damageType).toBe('physical')
    expect(proj?.damagePayload?.canCrit).toBe(true)
  })

  it('tier 1 base damage is 300', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    expect(proj?.damagePayload?.baseAmount).toBe(300)
  })

  it('tier 2 base damage is 475', () => {
    const t2 = makeUnit('toucannon', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.visualPos = { x: 300, y: 500 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    t2.targetId = e.id
    cast(t2, s)
    const proj = [...s.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    expect(proj?.damagePayload?.baseAmount).toBe(475)
  })

  it('projectile has an onHit callback for AoE explosion', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    expect(typeof proj?.onHit).toBe('function')
  })

  it('onHit heals allies within 1 hex of the explosion (tier 1 = 75)', () => {
    const ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 3, row: 3 }  // adjacent to enemy at row 2
    ally.maxHp = 1000
    ally.currentHp = 500
    state = createCombatState([caster, ally], [enemy])
    caster.targetId = enemy.id
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    state.events = []
    proj!.onHit!(caster, enemy, state)
    const healEvent = state.events.find(e => e.type === 'heal' && e.targetId === ally.id)
    expect(healEvent).toBeDefined()
    if (healEvent?.type === 'heal') {
      expect(healEvent.amount).toBe(75)
    }
  })

  it('onHit deals splash magic damage to enemies within 1 hex', () => {
    const splashEnemy = makeUnit('dummy', 'enemy', 1)
    splashEnemy.hexPos = { col: 3, row: 1 }  // adjacent to main target at row 2
    splashEnemy.maxHp = 10000
    splashEnemy.currentHp = 10000
    state = createCombatState([caster], [enemy, splashEnemy])
    caster.targetId = enemy.id
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    state.events = []
    proj!.onHit!(caster, enemy, state)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === splashEnemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.damageType).toBe('magic')
    }
  })

  it('onHit emits a beak_blast_explosion vfx event', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'toucannon_beak_blast')
    state.events = []
    proj!.onHit!(caster, enemy, state)
    const vfx = state.events.find(e => e.type === 'vfx' && (e as any).effectId === 'beak_blast_explosion')
    expect(vfx).toBeDefined()
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.projectiles.size).toBe(0)
  })
})
