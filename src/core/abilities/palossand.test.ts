import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

// Guard against re-firing when cast completes
function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < 50; i++) {
    if (caster.state !== 'casting') break
    tickAbilityCast(caster, state)
  }
}

describe('Palossand - Scorching Sands', () => {
  let caster: Unit
  let e1: Unit
  let e2: Unit
  let e3: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('palossand', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 1 }
    e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 4, row: 1 }
    state = createCombatState([caster], [e1, e2, e3])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(8)
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

  it('tier 1 - deals magic damage to 3 nearest enemies', () => {
    cast(caster, state)
    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(3)
  })

  it('tier 2 - deals magic damage to 3 nearest enemies', () => {
    const t2 = makeUnit('palossand', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t2], [e1, e2, e3])
    cast(t2, s)
    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(3)
  })

  it('tier 3 - deals magic damage to up to 4 nearest enemies (capped at 3 available)', () => {
    const t3 = makeUnit('palossand', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    const damaged = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    expect(damaged).toHaveLength(3)
  })

  it('damage events are magic type', () => {
    cast(caster, state)
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents.length).toBeGreaterThan(0)
    for (const ev of dmgEvents) {
      if (ev.type === 'damage') {
        expect(ev.damageType).toBe('magic')
      }
    }
  })

  it('applies burn status effect on surviving targets', () => {
    cast(caster, state)
    const damagedEnemies = [e1, e2, e3].filter(e => e.currentHp < e.maxHp)
    for (const dmgEnemy of damagedEnemies) {
      if (dmgEnemy.state !== 'dead') {
        const burn = dmgEnemy.statusEffects.find(fx => fx.id === 'burn')
        expect(burn).toBeDefined()
      }
    }
  })

  it('burn magnitude equals 1% of target maxHp per second (0 spell buff)', () => {
    cast(caster, state)
    const burn = e1.statusEffects.find(fx => fx.id === 'burn')
    if (burn) {
      expect(burn.magnitude).toBe(Math.round(e1.maxHp * 0.01))
    }
  })

  it('burn has 4-second duration (4 * TICK_RATE)', () => {
    cast(caster, state)
    const burn = e1.statusEffects.find(fx => fx.id === 'burn')
    if (burn) {
      expect(burn.durationTicks).toBe(4 * TICK_RATE)
    }
  })

  it('increments spell buff counter for beachy allies on cast', () => {
    // Need 2 beachy species for the threshold to activate
    const beachyAlly = makeUnit('kingler', 'player', 1)
    beachyAlly.hexPos = { col: 5, row: 5 }
    const s = createCombatState([caster, beachyAlly], [e1, e2, e3])
    const before = s.spellBuffCounters.get(caster.id) ?? 0
    cast(caster, s)
    const after = s.spellBuffCounters.get(caster.id) ?? 0
    expect(after).toBeGreaterThan(before)
  })

  it('tier 1 base damage is 58 after mitigation (75 raw, 30 spDefense)', () => {
    cast(caster, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    if (dmgEvent?.type === 'damage') {
      // 75 raw * 100 / (100 + 30) ≈ 58
      expect(dmgEvent.amount).toBe(Math.round(75 * 100 / (100 + e1.spDefense)))
    }
  })

  it('burn magnitude scales with spell buff stacks', () => {
    // Pre-seed 10 spell buff stacks on caster
    state.spellBuffCounters.set(caster.id, 10)
    cast(caster, state)
    const burn = e1.statusEffects.find(fx => fx.id === 'burn')
    if (burn) {
      // burnPct = 0.01 + 10 * 0.01 = 0.11 → 11% of maxHp per second
      expect(burn.magnitude).toBe(Math.max(1, Math.round(e1.maxHp * 0.11)))
    }
  })
})
