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

describe('Spiritomb – Destiny Bond', () => {
  let caster: Unit
  let nearEnemy: Unit   // adjacent (hexDist = 1) — inside aura
  let farEnemy: Unit    // far away                — outside aura
  let state: CombatState

  beforeEach(() => {
    caster    = makeUnit('spiritomb', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 4 }  // adjacent
    farEnemy  = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos  = { col: 0, row: 0 }  // far away
    state = createCombatState([caster], [nearEnemy, farEnemy])
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

  it('adds permanent destiny aura status effect on caster', () => {
    cast(caster, state)
    const fx = caster.statusEffects.find(f => f.stackId === 'spiritomb_destiny_aura')
    expect(fx).toBeDefined()
    expect(fx!.durationTicks).toBe(-1)
    expect(fx!.tickInterval).toBe(TICK_RATE)
  })

  it('aura deals damage to adjacent enemy every second (tier 1 = 75)', () => {
    caster.spDefense = 0; caster._computedStats = null
    nearEnemy.spDefense = 0; nearEnemy._computedStats = null
    cast(caster, state)
    const fx = caster.statusEffects.find(f => f.stackId === 'spiritomb_destiny_aura')!
    const hpBefore = nearEnemy.currentHp
    fx.tickEffect!(caster, state)
    expect(hpBefore - nearEnemy.currentHp).toBeGreaterThan(0)
  })

  it('aura heals caster per enemy hit', () => {
    caster.currentHp = 500
    caster.spDefense = 0; caster._computedStats = null
    nearEnemy.spDefense = 0; nearEnemy._computedStats = null
    cast(caster, state)
    const fx = caster.statusEffects.find(f => f.stackId === 'spiritomb_destiny_aura')!
    fx.tickEffect!(caster, state)
    expect(caster.currentHp).toBeGreaterThan(500)
  })

  it('marks nearest enemy OUTSIDE 1-hex radius', () => {
    cast(caster, state)
    expect(farEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)
    expect(nearEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(false)
  })

  it('destiny mark is permanent (durationTicks = -1)', () => {
    cast(caster, state)
    const fx = farEnemy.statusEffects.find(f => f.stackId === 'spiritomb_destiny_mark')!
    expect(fx.durationTicks).toBe(-1)
  })

  it('destiny mark deals damage to target each second', () => {
    farEnemy.spDefense = 0; farEnemy._computedStats = null
    cast(caster, state)
    const fx = farEnemy.statusEffects.find(f => f.stackId === 'spiritomb_destiny_mark')!
    const hpBefore = farEnemy.currentHp
    fx.tickEffect!(farEnemy, state)
    expect(hpBefore - farEnemy.currentHp).toBeGreaterThan(0)
  })

  it('destiny mark heals Spiritomb when it ticks', () => {
    caster.currentHp = 500
    farEnemy.spDefense = 0; farEnemy._computedStats = null
    cast(caster, state)
    const fx = farEnemy.statusEffects.find(f => f.stackId === 'spiritomb_destiny_mark')!
    fx.tickEffect!(farEnemy, state)
    expect(caster.currentHp).toBeGreaterThan(500)
  })

  it('damage scales per tier', () => {
    const expected = [75, 100, 500] as const
    for (const tier of [1, 2, 3] as const) {
      const c = makeUnit('spiritomb', 'player', tier)
      c.hexPos = { col: 3, row: 5 }
      c.spDefense = 0; c._computedStats = null
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      e.spDefense = 0; e._computedStats = null
      const st = createCombatState([c], [e])
      cast(c, st)
      const fx = c.statusEffects.find(f => f.stackId === 'spiritomb_destiny_aura')!
      const hpBefore = e.currentHp
      fx.tickEffect!(c, st)
      expect(hpBefore - e.currentHp).toBeGreaterThanOrEqual(expected[tier - 1] - 1)
    }
  })

  it('emits spiritomb_mark_apply VFX when marking', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'spiritomb_mark_apply')).toBe(true)
  })

  it('recasting adds a new mark without removing the old one', () => {
    cast(caster, state)
    // Add a second far enemy closer than farEnemy
    const midEnemy = makeUnit('dummy', 'enemy', 1)
    midEnemy.hexPos = { col: 1, row: 3 }
    state.units.set(midEnemy.id, midEnemy)
    cast(caster, state)
    // farEnemy keeps its mark, midEnemy gets a new one (nearest unmarked outside range 1)
    expect(farEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)
    expect(midEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)
  })

  it('does not re-mark a unit that was already marked, even if it is nearest again', () => {
    cast(caster, state)
    expect(farEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)

    // Add a closer enemy than farEnemy — it should get the next mark, not farEnemy again.
    const midEnemy = makeUnit('dummy', 'enemy', 1)
    midEnemy.hexPos = { col: 1, row: 3 }
    state.units.set(midEnemy.id, midEnemy)
    cast(caster, state)
    expect(midEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)
    expect(farEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)

    // Recast again — both eligible enemies are already marked, so no new mark is applied,
    // but both existing marks remain active (marks are permanent and never removed).
    cast(caster, state)
    expect(midEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)
    expect(farEnemy.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(true)
  })

  it('does not mark anyone if all enemies are within 1 hex', () => {
    const closeOnly = makeUnit('dummy', 'enemy', 1)
    closeOnly.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [closeOnly])
    cast(caster, state)
    expect(closeOnly.statusEffects.some(f => f.stackId === 'spiritomb_destiny_mark')).toBe(false)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'spiritomb_mark_apply')).toBe(false)
  })
})

describe('Shiny Spiritomb — Destiny Bond amplified 1.5x', () => {
  // Every test sets unit.isShiny = true on exactly the caster that should
  // trigger the effect, and includes one explicit non-shiny control case
  // proving the effect does NOT fire without it.

  it('amplifies aura damage and heal by 1.5x (tier 1: 75 -> 113, 20 -> 30)', () => {
    const caster = makeUnit('spiritomb', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    caster.spDefense = 0; caster._computedStats = null
    const nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 4 }
    nearEnemy.spDefense = 0; nearEnemy._computedStats = null
    const state = createCombatState([caster], [nearEnemy])

    cast(caster, state)
    const fx = caster.statusEffects.find(f => f.stackId === 'spiritomb_destiny_aura')!
    caster.currentHp = 500
    const hpBefore = nearEnemy.currentHp
    fx.tickEffect!(caster, state)

    // 75 * 1.5 = 112.5 -> Math.round = 113
    expect(hpBefore - nearEnemy.currentHp).toBeGreaterThanOrEqual(113 - 1)
    // 20 * 1.5 = 30
    expect(caster.currentHp).toBeGreaterThanOrEqual(500 + 30 - 1)
  })

  it('amplifies mark damage and heal by 1.5x (tier 1: 75 -> 113, 20 -> 30)', () => {
    const caster = makeUnit('spiritomb', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 0, row: 0 }
    farEnemy.spDefense = 0; farEnemy._computedStats = null
    const state = createCombatState([caster], [farEnemy])

    cast(caster, state)
    const fx = farEnemy.statusEffects.find(f => f.stackId === 'spiritomb_destiny_mark')!
    caster.currentHp = 500
    const hpBefore = farEnemy.currentHp
    fx.tickEffect!(farEnemy, state)

    expect(hpBefore - farEnemy.currentHp).toBeGreaterThanOrEqual(113 - 1)
    expect(caster.currentHp).toBeGreaterThanOrEqual(500 + 30 - 1)
  })

  it('does NOT amplify aura damage/heal when Spiritomb is not shiny (control case)', () => {
    const caster = makeUnit('spiritomb', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.spDefense = 0; caster._computedStats = null
    const nearEnemy = makeUnit('dummy', 'enemy', 1)
    nearEnemy.hexPos = { col: 3, row: 4 }
    nearEnemy.spDefense = 0; nearEnemy._computedStats = null
    const state = createCombatState([caster], [nearEnemy])

    cast(caster, state)
    const fx = caster.statusEffects.find(f => f.stackId === 'spiritomb_destiny_aura')!
    caster.currentHp = 500
    const hpBefore = nearEnemy.currentHp
    fx.tickEffect!(caster, state)

    // Plain tier-1 values (75 dmg / 20 heal), no 1.5x amplification.
    expect(hpBefore - nearEnemy.currentHp).toBeGreaterThanOrEqual(75 - 1)
    expect(hpBefore - nearEnemy.currentHp).toBeLessThan(113 - 1)
    expect(caster.currentHp).toBe(500 + 20)
  })
})
