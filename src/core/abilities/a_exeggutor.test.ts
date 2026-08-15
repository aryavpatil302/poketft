import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 40  // > castTimeTicks (35) so the cast always completes

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) {
    if (caster.state !== 'casting') break
    tickAbilityCast(caster, state)
  }
}

describe('A-Exeggutor - Egg Bomb', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('a_exeggutor', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.visualPos = { x: 300, y: 500 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    enemy.visualPos = { x: 300, y: 200 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
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

  it('creates a projectile targeting nearest enemy', () => {
    const projsBefore = state.projectiles.size
    cast(caster, state)
    expect(state.projectiles.size).toBeGreaterThan(projsBefore)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj).toBeDefined()
    expect(proj?.targetId).toBe(enemy.id)
  })

  it('tier 1 projectile has 600 base magic damage', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.damagePayload?.baseAmount).toBe(600)
    expect(proj?.damagePayload?.damageType).toBe('magic')
  })

  it('tier 2 projectile has 800 base damage', () => {
    const t2 = makeUnit('a_exeggutor', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.visualPos = { x: 300, y: 500 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    e.visualPos = { x: 300, y: 200 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const proj = [...s.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.damagePayload?.baseAmount).toBe(800)
  })

  it('tier 3 projectile has 1000 base damage', () => {
    const t3 = makeUnit('a_exeggutor', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    t3.visualPos = { x: 300, y: 500 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    e.visualPos = { x: 300, y: 200 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const proj = [...s.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.damagePayload?.baseAmount).toBe(1000)
  })

  it('onHit always applies true damage (10% of base at 0 spell buff)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.onHit).toBeDefined()
    state.events = []
    // Give enemy full HP so it survives the simulated hit
    enemy.currentHp = 99999
    proj!.onHit!(caster, enemy, state)
    const trueDmgEvent = state.events.find(e => e.type === 'damage' && (e as any).damageType === 'true')
    expect(trueDmgEvent).toBeDefined()
    // 10% of 600 = 60
    expect((trueDmgEvent as any)?.amount).toBe(60)
  })

  it('spell buff increases true damage: (10 + spellBuff)% of base', () => {
    state.spellBuffCounters.set(caster.id, 5)
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    state.events = []
    enemy.currentHp = 99999
    proj!.onHit!(caster, enemy, state)
    const trueDmgEvent = state.events.find(e => e.type === 'damage' && (e as any).damageType === 'true')
    // (10 + 5)% of 600 = 90
    expect((trueDmgEvent as any)?.amount).toBe(90)
  })

  it('increments spell buff counter after cast (beachy trait)', () => {
    const ally = makeUnit('palossand', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }
    ally.visualPos = { x: 200, y: 500 }
    const s = createCombatState([caster, ally], [enemy])
    const before = s.spellBuffCounters.get(caster.id) ?? 0
    cast(caster, s)
    const after = s.spellBuffCounters.get(caster.id) ?? 0
    expect(after).toBeGreaterThan(before)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.projectiles.size).toBe(0)
  })
})
