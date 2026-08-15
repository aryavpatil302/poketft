import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickProjectiles } from '../projectile'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 45  // LATIOS_CHANNEL_TICKS

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function landOrb(state: CombatState): void {
  for (let i = 0; i < 400 && state.projectiles.size > 0; i++) tickProjectiles(state)
}

describe('Latios - Luster Purge', () => {
  let caster: Unit
  let e1: Unit   // cluster member
  let e2: Unit   // cluster member, adjacent to e1
  let far: Unit  // far away — outside the 3-hex blast
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('latios', 'player', 1)
    caster.hexPos = { col: 3, row: 6 }
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 1 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 0 }
    far = makeUnit('dummy', 'enemy', 1)
    far.hexPos = { col: 6, row: 6 }
    state = createCombatState([caster], [e1, e2, far])
  })

  it('channels for 45 ticks', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('resets mana after the cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('launches the orb at the largest enemy cluster (fixed position, arcing)', () => {
    cast(caster, state)
    const orb = [...state.projectiles.values()].find(p => p.abilityId === 'latios_luster_purge_orb')
    expect(orb).toBeDefined()
    expect(orb!.targetPos).toBeDefined()
    expect(orb!.arcHeight).toBeGreaterThan(0)
  })

  it('on landing, damages all enemies within 3 hexes of the cluster center', () => {
    cast(caster, state)
    const hp1 = e1.currentHp, hp2 = e2.currentHp, hpFar = far.currentHp
    landOrb(state)
    expect(e1.currentHp).toBeLessThan(hp1)
    expect(e2.currentHp).toBeLessThan(hp2)
    expect(far.currentHp).toBe(hpFar)
  })

  it('halves Sp. Defense of enemies hit for 3 seconds', () => {
    const baseSpDef = computeStats(e1).spDefense
    cast(caster, state)
    landOrb(state)
    const shred = e1.statusEffects.find(fx => fx.stackId === 'luster_purge_shred')
    expect(shred).toBeDefined()
    expect(shred!.magnitude).toBeCloseTo(0.5)
    expect(shred!.durationTicks).toBeLessThanOrEqual(3 * TICK_RATE)
    expect(computeStats(e1).spDefense).toBe(Math.round(baseSpDef * 0.5))
    expect(far.statusEffects.some(fx => fx.stackId === 'luster_purge_shred')).toBe(false)
  })

  it('emits the luster_purge_burst vfx on landing', () => {
    cast(caster, state)
    state.events = []
    landOrb(state)
    expect(state.events.some(e => e.type === 'vfx' && e.effectId === 'luster_purge_burst')).toBe(true)
  })
})

describe('Soul Bonded trait', () => {
  it('Latios fielded: team gains 10% attack and 10% special', () => {
    const latios = makeUnit('latios', 'player', 1)
    latios.hexPos = { col: 3, row: 6 }
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 0, row: 7 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }

    const allyBaseAtk = ally.attack
    const allyBaseSp  = ally.special
    const state = createCombatState([latios, ally], [enemy])

    const a = state.units.get(ally.id)!
    expect(computeStats(a).attack).toBe(allyBaseAtk + Math.round(allyBaseAtk * 0.10))
    expect(computeStats(a).special).toBe(allyBaseSp + Math.round(allyBaseSp * 0.10))
    // Enemy team unaffected
    expect(enemy.statusEffects.some(fx => fx.stackId === 'soul_bonded_atk')).toBe(false)
  })

  it('both bonded: both team buffs apply and Latios gains 1.5x special and spDef', () => {
    const latios = makeUnit('latios', 'player', 1)
    latios.hexPos = { col: 3, row: 6 }
    // Latias doesn't exist as a unit yet — stand-in with a renamed unit
    const latias = makeUnit('tangela', 'player', 1)
    latias.definitionId = 'latias'
    latias.hexPos = { col: 0, row: 7 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }

    const state = createCombatState([latios, latias], [enemy])
    const l = state.units.get(latios.id)!

    expect(l.statusEffects.some(fx => fx.stackId === 'soul_bonded_apex')).toBe(true)
    // special: 100 → +10% = 110 → ×1.5 = 165 ; spDef: 70 + 10 = 80 → ×1.5 = 120
    expect(computeStats(l).special).toBe(165)
    expect(computeStats(l).spDefense).toBe(120)
  })

  it('no Soul Bonded buffs without latios or latias', () => {
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 3, row: 6 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }
    const state = createCombatState([ally], [enemy])
    const a = state.units.get(ally.id)!
    expect(a.statusEffects.some(fx => fx.stackId?.startsWith('soul_bonded'))).toBe(false)
  })
})
