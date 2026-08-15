import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { tickProjectiles } from '../projectile'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Fire staggered launches (status onExpire) and fly all projectiles to impact.
function resolveProjectiles(state: CombatState, maxTicks = 300): void {
  for (let i = 0; i < maxTicks; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
    tickProjectiles(state)
    if (state.projectiles.size === 0 &&
        ![...state.units.values()].some(u => u.statusEffects.some(fx => fx.id === 'typhlosion_launch'))) {
      break
    }
  }
}

function typhloProjectiles(state: CombatState) {
  return [...state.projectiles.values()].filter(p => p.abilityId === 'typhlosion_eruption')
}

describe('Typhlosion - Eruption', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('typhlosion', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }  // distance 3 — inside range 4
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
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

  it('resets mana to 0 after cast animation', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('tier 1 - launches 1 fireball projectile at an in-range enemy', () => {
    cast(caster, state)
    expect(typhloProjectiles(state)).toHaveLength(1)
    expect(typhloProjectiles(state)[0].targetId).toBe(enemy.id)
  })

  it('tier 1 - fireball has 110 base physical damage (200% attack)', () => {
    cast(caster, state)
    const proj = typhloProjectiles(state)[0]
    expect(proj.damagePayload?.baseAmount).toBe(110)
    expect(proj.damagePayload?.damageType).toBe('physical')
  })

  it('tier 2 - launches fireballs at 2 enemies (staggered)', () => {
    const t2 = makeUnit('typhlosion', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 3 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 3 }
    const s = createCombatState([t2], [e1, e2])
    cast(t2, s)
    // First fireball launches immediately; second after a 5-tick stagger
    expect(typhloProjectiles(s)).toHaveLength(1)
    for (let i = 0; i < 6; i++) { s.tick++; tickStatusEffects(s.units, s) }
    expect(typhloProjectiles(s)).toHaveLength(2)
  })

  it('tier 2 - fireballs have 291 base damage (350% attack)', () => {
    const t2 = makeUnit('typhlosion', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 3 }
    const s = createCombatState([t2], [e1])
    cast(t2, s)
    expect(typhloProjectiles(s)[0].damagePayload?.baseAmount).toBe(291)
  })

  it('tier 3 - fireballs have 625 base damage (500% attack)', () => {
    const t3 = makeUnit('typhlosion', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 3 }
    const s = createCombatState([t3], [e1])
    cast(t3, s)
    expect(typhloProjectiles(s)[0].damagePayload?.baseAmount).toBe(625)
  })

  it('fireball impact reduces enemy HP', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    resolveProjectiles(state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('does not target enemies beyond attack range', () => {
    enemy.hexPos = { col: 3, row: 0 }  // distance 5 — out of range 4
    state = createCombatState([caster], [enemy])
    cast(caster, state)
    expect(typhloProjectiles(state)).toHaveLength(0)
  })

  it('does nothing when no enemies are in range', () => {
    enemy.hexPos = { col: 0, row: 0 }
    state = createCombatState([caster], [enemy])
    cast(caster, state)
    resolveProjectiles(state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
