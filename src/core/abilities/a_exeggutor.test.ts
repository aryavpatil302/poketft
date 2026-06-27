import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
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

  it('projectile has magic damage payload (tier 1 = 300)', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.damagePayload?.baseAmount).toBe(300)
    expect(proj?.damagePayload?.damageType).toBe('magic')
  })

  it('tier 2 projectile has 450 base damage', () => {
    const t2 = makeUnit('a_exeggutor', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.visualPos = { x: 300, y: 500 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t2], [e])
    cast(t2, s)
    const proj = [...s.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.damagePayload?.baseAmount).toBe(450)
  })

  it('tier 3 projectile has 700 base damage', () => {
    const t3 = makeUnit('a_exeggutor', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    t3.visualPos = { x: 300, y: 500 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    const s = createCombatState([t3], [e])
    cast(t3, s)
    const proj = [...s.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.damagePayload?.baseAmount).toBe(700)
  })

  it('projectile has an onHit callback', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.onHit).toBeDefined()
  })

  it('onHit applies true damage bonus when spellBuff > 0', () => {
    // Set spell buff before cast so the closure captures it
    state.spellBuffCounters.set(caster.id, 5)
    caster.traits = ['beachy']
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    expect(proj?.onHit).toBeDefined()
    const hpBefore = enemy.currentHp
    // Manually trigger onHit to verify true damage
    proj!.onHit!(caster, enemy, state)
    // Should have dealt additional true damage
    const trueDmgEvent = state.events.find(e => e.type === 'damage' && (e as any).damageType === 'true')
    expect(trueDmgEvent).toBeDefined()
  })

  it('onHit does NOT apply true damage when spellBuff is 0', () => {
    cast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')
    state.events = []
    proj!.onHit!(caster, enemy, state)
    const trueDmgEvent = state.events.find(e => e.type === 'damage' && (e as any).damageType === 'true')
    expect(trueDmgEvent).toBeUndefined()
  })

  it('increments spell buff counter after cast (beachy trait)', () => {
    caster.traits = ['beachy']
    const before = state.spellBuffCounters.get(caster.id) ?? 0
    cast(caster, state)
    const after = state.spellBuffCounters.get(caster.id) ?? 0
    expect(after).toBeGreaterThan(before)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.projectiles.size).toBe(0)
  })
})
