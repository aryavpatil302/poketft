import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { tickProjectiles } from '../projectile'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 75  // LATIAS_CHANNEL_TICKS

// Full channel including per-tick status effects (heal-over-channel pulses)
function castWithTicks(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
    tickAbilityCast(caster, state)
  }
}

function landOrb(state: CombatState): void {
  for (let i = 0; i < 400 && state.projectiles.size > 0; i++) tickProjectiles(state)
}

describe('Latias - Mist Ball', () => {
  let caster: Unit
  let e1: Unit   // cluster member
  let e2: Unit   // cluster member, adjacent to e1
  let far: Unit  // outside the 2-hex blast
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('latias', 'player', 1)
    caster.hexPos = { col: 3, row: 6 }
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 1 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 0 }
    far = makeUnit('dummy', 'enemy', 1)
    far.hexPos = { col: 0, row: 0 }
    state = createCombatState([caster], [e1, e2, far])
  })

  it('channels for 75 ticks (longer than Latios)', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('heals 300 over the channel duration at tier 1', () => {
    caster.currentHp -= 600
    const hpBefore = caster.currentHp
    castWithTicks(caster, state)
    expect(caster.currentHp).toBe(hpBefore + 300)
  })

  it('heal pulses DURING the channel, not all at the end', () => {
    caster.currentHp -= 600
    const hpBefore = caster.currentHp
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    // Advance only a third of the channel
    for (let i = 0; i < 30; i++) {
      state.tick++
      tickStatusEffects(state.units, state)
      tickAbilityCast(caster, state)
    }
    const healedSoFar = caster.currentHp - hpBefore
    expect(healedSoFar).toBeGreaterThan(0)
    expect(healedSoFar).toBeLessThan(300)
  })

  it('launches a red orb at the largest cluster and damages a 2-hex radius', () => {
    castWithTicks(caster, state)
    const orb = [...state.projectiles.values()].find(p => p.abilityId === 'latias_mist_ball_orb')
    expect(orb).toBeDefined()

    const hp1 = e1.currentHp, hp2 = e2.currentHp, hpFar = far.currentHp
    landOrb(state)
    expect(e1.currentHp).toBeLessThan(hp1)
    expect(e2.currentHp).toBeLessThan(hp2)
    expect(far.currentHp).toBe(hpFar)
  })

  it('halves Sp. Attack of enemies hit for 3 seconds', () => {
    const baseSp = computeStats(e1).special
    castWithTicks(caster, state)
    landOrb(state)
    const shred = e1.statusEffects.find(fx => fx.stackId === 'mist_ball_shred')
    expect(shred).toBeDefined()
    expect(shred!.magnitude).toBeCloseTo(0.5)
    expect(shred!.durationTicks).toBeLessThanOrEqual(3 * TICK_RATE)
    expect(computeStats(e1).special).toBe(Math.round(baseSp * 0.5))
    expect(far.statusEffects.some(fx => fx.stackId === 'mist_ball_shred')).toBe(false)
  })

  it('emits the mist_ball_burst vfx on landing', () => {
    castWithTicks(caster, state)
    state.events = []
    landOrb(state)
    expect(state.events.some(e => e.type === 'vfx' && e.effectId === 'mist_ball_burst')).toBe(true)
  })
})

describe('Soul Bonded — both real units fielded', () => {
  it('Latios + Latias: team gets both buffs, each gains 1.5x special and spDef', () => {
    const latios = makeUnit('latios', 'player', 1)
    latios.hexPos = { col: 3, row: 6 }
    const latias = makeUnit('latias', 'player', 1)
    latias.hexPos = { col: 0, row: 7 }
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 6, row: 7 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }

    const allyBaseAtk = ally.attack
    const state = createCombatState([latios, latias, ally], [enemy])

    // Team gets both halves of the bond
    const a = state.units.get(ally.id)!
    expect(a.statusEffects.some(fx => fx.stackId === 'soul_bonded_atk')).toBe(true)
    expect(a.statusEffects.some(fx => fx.stackId === 'soul_bonded_def')).toBe(true)
    expect(computeStats(a).attack).toBe(allyBaseAtk + Math.round(allyBaseAtk * 0.10))

    // Both bonded units get the apex multiplier
    const l1 = state.units.get(latios.id)!
    const l2 = state.units.get(latias.id)!
    expect(l1.statusEffects.some(fx => fx.stackId === 'soul_bonded_apex')).toBe(true)
    expect(l2.statusEffects.some(fx => fx.stackId === 'soul_bonded_apex')).toBe(true)
    // Latias: special 100 → +10% = 110 → ×1.5 = 165 ; spDef 85 + 10 = 95 → ×1.5 ≈ 143
    expect(computeStats(l2).special).toBe(165)
    expect(computeStats(l2).spDefense).toBe(Math.round(95 * 1.5))
  })
})
