import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects, addStatusEffect } from '../systems/statusEffect'
import { tickLeapPixel } from '../systems/movement'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 10

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Drives the full phased sequence: status ticks + leap movement, like the engine.
function run(caster: Unit, state: CombatState, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    state.tick++
    if (caster.state === 'leaping') {
      const arrived = tickLeapPixel(caster, state)
      if (arrived && !(caster as any)._leap) caster.state = 'idle'
    }
    tickStatusEffects(state.units, state)
  }
}

// Evo (36) + rumble (24) + leap + hold (5) + fly off (14) + wait (30) + fly in (16)
// with generous headroom for the leap portion.
const FULL_SEQUENCE_TICKS = 300

describe('Rayquaza - Dragon Ascent', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('rayquaza', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('first cast starts the mega evolution shake (ascended + invulnerable)', () => {
    cast(caster, state)
    expect(caster.state).toBe('ascended')
    expect(caster.incomingDamageMult).toBe(0)
    expect(caster.statusEffects.some(e => e.stackId === 'rayquaza_evo_shake')).toBe(true)
  })

  it('becomes mega with a permanent attack bonus after the evo shake', () => {
    cast(caster, state)
    run(caster, state, 37)
    expect(caster.statusEffects.some(e => e.id === 'rayquaza_is_mega')).toBe(true)
    const atkBuff = caster.statusEffects.find(e => e.stackId === 'rayquaza_mega_atk')
    expect(atkBuff).toBeDefined()
    expect(atkBuff!.magnitude).toBe(50)  // tier 1
    expect(atkBuff!.durationTicks).toBe(-1)
  })

  it('grabs the target after the pre-grab rumble (target ascended + grabbed)', () => {
    cast(caster, state)
    run(caster, state, 37 + 24)
    expect(enemy.state).toBe('ascended')
    expect(enemy.statusEffects.some(e => e.stackId === 'rayquaza_grabbed')).toBe(true)
    expect(enemy.incomingDamageMult).toBe(0)
  })

  it('full sequence slams and deals physical damage to the grabbed enemy', () => {
    enemy.defense = 0
    enemy._computedStats = null
    caster.critChance = 0
    caster._computedStats = null
    cast(caster, state)
    run(caster, state, FULL_SEQUENCE_TICKS)

    const dmgEvent = state.events.find(
      e => e.type === 'damage' && e.targetId === enemy.id && (e as any).damageType === 'physical'
    )
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // tier 1: 300 + 2% of grabbed max HP (1500) = 330
      expect(dmgEvent.amount).toBe(330)
    }
  })

  it('tier 2 slam deals 450 + 5% of grabbed max HP', () => {
    const t2 = makeUnit('rayquaza', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    t2.critChance = 0
    t2._computedStats = null
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 2 }
    e.defense = 0
    e._computedStats = null
    const s = createCombatState([t2], [e])
    cast(t2, s)
    run(t2, s, FULL_SEQUENCE_TICKS)

    const dmgEvent = s.events.find(ev => ev.type === 'damage' && ev.targetId === e.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 450 + 0.05 * 1500 = 525
      expect(dmgEvent.amount).toBe(525)
    }
  })

  it('restores both units to playable state after the slam', () => {
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    cast(caster, state)
    run(caster, state, FULL_SEQUENCE_TICKS)

    expect(caster.state).toBe('idle')
    expect(caster.incomingDamageMult).toBe(1.0)
    expect(caster.statusEffects.some(e => e.id === 'rayquaza_flying')).toBe(false)
    if (enemy.state !== 'dead') {
      expect(enemy.state).toBe('idle')
      expect(enemy.incomingDamageMult).toBe(1.0)
      expect(enemy.statusEffects.some(e => e.stackId === 'rayquaza_grabbed')).toBe(false)
    }
  })

  it('rayquaza targets the grabbed enemy after depositing', () => {
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    cast(caster, state)
    run(caster, state, FULL_SEQUENCE_TICKS)
    if (enemy.state !== 'dead') {
      expect(caster.targetId).toBe(enemy.id)
    }
  })

  it('second cast (already mega) skips the evolution and grabs immediately', () => {
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    cast(caster, state)
    run(caster, state, FULL_SEQUENCE_TICKS)

    // Recast: no new evo shake; grab starts right away
    cast(caster, state)
    expect(caster.statusEffects.some(e => e.stackId === 'rayquaza_evo_shake')).toBe(false)
    expect(enemy.statusEffects.some(e => e.stackId === 'rayquaza_grabbed')).toBe(true)
  })

  it('is CC-immune while mega (stun blocked)', () => {
    cast(caster, state)
    run(caster, state, 37)
    expect(caster.statusEffects.some(e => e.id === 'rayquaza_is_mega')).toBe(true)
    addStatusEffect(caster, { id: 'stun', sourceUnitId: 'x', durationTicks: 60 })
    expect(caster.statusEffects.some(e => e.id === 'stun')).toBe(false)
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    caster.targetId = null
    cast(caster, state)
    run(caster, state, FULL_SEQUENCE_TICKS)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
