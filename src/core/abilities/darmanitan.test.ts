import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import { tickStatusEffects } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'
import { gainManaOnDamageTaken } from '../systems/mana'
import { hexId } from '../hexGrid'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 12

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Advance all visual-only blitz leaps until the unit returns to idle.
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !unit._leap) unit.state = 'idle'
  }
}

describe('Darmanitan - Flair Blitz', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('darmanitan', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [enemy])
  })

  it('enters leaping state and consumes mana when cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
    expect(caster.currentMana).toBe(0)
  })

  it('deals physical damage to the primary target', () => {
    const before = enemy.currentHp
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(enemy.currentHp).toBeLessThan(before)
  })

  it('hits the two closest enemies within 2 hexes, but not a distant one', () => {
    const near1 = makeUnit('dummy', 'enemy', 1); near1.hexPos = { col: 4, row: 4 }
    const near2 = makeUnit('dummy', 'enemy', 1); near2.hexPos = { col: 2, row: 4 }
    const far   = makeUnit('dummy', 'enemy', 1); far.hexPos   = { col: 3, row: 0 }
    for (const u of [near1, near2, far]) {
      state.units.set(u.id, u)
      state.hexOccupancy.set(hexId(u.hexPos), u.id)
    }
    const hp = { near1: near1.currentHp, near2: near2.currentHp, far: far.currentHp }

    cast(caster, state)
    advanceLeaps(caster, state)

    expect(near1.currentHp).toBeLessThan(hp.near1)
    expect(near2.currentHp).toBeLessThan(hp.near2)
    expect(far.currentHp).toBe(hp.far)   // outside 2-hex radius → untouched
  })

  it('at tier 3, blitzes EVERY living enemy regardless of range or count', () => {
    const c3 = makeUnit('darmanitan', 'player', 3); c3.hexPos = { col: 3, row: 5 }
    const s3 = createCombatState([c3], [])
    // Primary + 4 others, one far out of the tier-1/2 radius and beyond the 2-extra cap
    const primary = makeUnit('dummy', 'enemy', 1); primary.hexPos = { col: 3, row: 4 }
    const e2 = makeUnit('dummy', 'enemy', 1); e2.hexPos = { col: 5, row: 3 }
    const e3 = makeUnit('dummy', 'enemy', 1); e3.hexPos = { col: 1, row: 2 }
    const e4 = makeUnit('dummy', 'enemy', 1); e4.hexPos = { col: 6, row: 0 }   // far corner
    const e5 = makeUnit('dummy', 'enemy', 1); e5.hexPos = { col: 0, row: 1 }
    const enemies = [primary, e2, e3, e4, e5]
    for (const u of enemies) { s3.units.set(u.id, u); s3.hexOccupancy.set(hexId(u.hexPos), u.id) }
    const hp = enemies.map(u => u.currentHp)

    cast(c3, s3)
    advanceLeaps(c3, s3)

    enemies.forEach((u, i) => expect(u.currentHp, `enemy ${i}`).toBeLessThan(hp[i]))
  })

  it('returns to idle at its home hex after the blitz', () => {
    const home = { ...caster.hexPos }
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(caster.state).toBe('idle')
    expect(caster.hexPos).toEqual(home)
    expect(state.hexOccupancy.get(hexId(home))).toBe(caster.id)
  })

  it('flags flair_blitz_active during the dash and clears it on return', () => {
    cast(caster, state)
    expect(caster.statusEffects.some(fx => fx.stackId === 'flair_blitz_active')).toBe(true)
    advanceLeaps(caster, state)
    expect(caster.statusEffects.some(fx => fx.stackId === 'flair_blitz_active')).toBe(false)
  })

  it('scales damage with tier (tier 3 hits harder than tier 1)', () => {
    // Tanky dummy so neither cast one-shots it
    const bigEnemy = () => { const d = makeUnit('dummy', 'enemy', 1); d.maxHp = 1_000_000; d.currentHp = 1_000_000; d.hexPos = { col: 3, row: 4 }; return d }

    const c1 = makeUnit('darmanitan', 'player', 1); c1.hexPos = { col: 3, row: 5 }
    const e1 = bigEnemy(); const s1 = createCombatState([c1], [e1])
    cast(c1, s1); advanceLeaps(c1, s1)
    const dmg1 = e1.maxHp - e1.currentHp

    const c3 = makeUnit('darmanitan', 'player', 3); c3.hexPos = { col: 3, row: 5 }
    const e3 = bigEnemy(); const s3 = createCombatState([c3], [e3])
    cast(c3, s3); advanceLeaps(c3, s3)
    const dmg3 = e3.maxHp - e3.currentHp

    expect(dmg3).toBeGreaterThan(dmg1)
  })
})

describe('Darmanitan - Zen trait', () => {
  function makeZenScenario(tier: 1 | 2 | 3 = 1) {
    const dar = makeUnit('darmanitan', 'player', tier)
    dar.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }
    const state = createCombatState([dar], [enemy])
    return { dar, enemy, state }
  }

  it('gives every Zen unit a monitor at combat start', () => {
    const { dar } = makeZenScenario()
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_monitor')).toBe(true)
  })

  it('does not enter Zen above 50% health', () => {
    const { dar, state } = makeZenScenario()
    dar.currentHp = Math.floor(dar.maxHp * 0.6)
    tickStatusEffects(state.units, state)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(false)
  })

  it('finishes a dash before entering Zen if it drops below 50% mid-blitz', () => {
    const { dar, state } = makeZenScenario()
    // Start Flair Blitz, then drop below the threshold while it's still dashing.
    cast(dar, state)
    expect(dar.state).toBe('leaping')
    dar.currentHp = Math.floor(dar.maxHp * 0.4)

    // Ticking while mid-dash must NOT freeze him into Zen — the attack finishes.
    for (let i = 0; i < 10; i++) { state.tick++; tickStatusEffects(state.units, state) }
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(false)
    expect(['leaping', 'casting']).toContain(dar.state)

    // Let the blitz complete, then one more tick — now Zen triggers.
    advanceLeaps(dar, state)
    expect(dar.statusEffects.some(fx => fx.stackId === 'flair_blitz_active')).toBe(false)
    state.tick++; tickStatusEffects(state.units, state)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(true)
  })

  it('enters Zen at 50% health: shield + heal + empower marker + rumble', () => {
    const { dar, state } = makeZenScenario()
    dar.currentHp = Math.floor(dar.maxHp * 0.5)
    tickStatusEffects(state.units, state)

    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(true)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_empower_cast')).toBe(true)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_shift')).toBe(true)
    const zenShield = dar.shields.find(s => s.sourceAbility === 'zen')
    expect(zenShield).toBeDefined()
    expect(zenShield!.value).toBe(1200)   // no healShieldPower on a lone Darmanitan
  })

  it('freezes him (ascended, cannot act) and grants +10% durability while in Zen', () => {
    const { dar, state } = makeZenScenario()
    const baseDef   = computeStats(dar).defense
    const baseSpDef = computeStats(dar).spDefense

    dar.currentHp = Math.floor(dar.maxHp * 0.5)
    tickStatusEffects(state.units, state)

    expect(dar.state).toBe('ascended')   // tickUnit skips ascended → no move/attack/cast
    const stats = computeStats(dar)
    expect(stats.defense).toBe(Math.round(baseDef * 1.1))
    expect(stats.spDefense).toBe(Math.round(baseSpDef * 1.1))
  })

  it('cannot gain mana while in Zen (suppressManaGain)', () => {
    const { dar, state } = makeZenScenario()
    dar.currentHp = Math.floor(dar.maxHp * 0.5)
    tickStatusEffects(state.units, state)

    dar.currentMana = 0
    gainManaOnDamageTaken(dar, 1000)
    expect(dar.currentMana).toBe(0)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form' && fx.suppressManaGain)).toBe(true)
  })

  it('drops max mana from 80 to 60 and unfreezes on exiting Zen', () => {
    const { dar, state } = makeZenScenario()
    expect(dar.maxMana).toBe(80)
    dar.currentHp = Math.floor(dar.maxHp * 0.5)
    tickStatusEffects(state.units, state)     // enter Zen (ascended)

    dar.currentHp = dar.maxHp                 // full-heal exit
    state.tick++; tickStatusEffects(state.units, state)

    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(false)
    expect(dar.state).toBe('idle')            // released from the freeze
    expect(dar.maxMana).toBe(60)
  })

  it('heals smoothly every tick in Zen (200/sec total) and reverts at full health', () => {
    const { dar, state } = makeZenScenario()
    dar.currentHp = Math.floor(dar.maxHp * 0.5)
    tickStatusEffects(state.units, state)  // enter Zen
    const afterEnter = dar.currentHp

    // Heals per tick, not in a once-a-second lump: HP rises after just a few
    // ticks (under the old code it stayed flat until tick 60).
    for (let t = 0; t < 5; t++) { state.tick++; tickStatusEffects(state.units, state) }
    const afterFewTicks = dar.currentHp
    expect(afterFewTicks).toBeGreaterThan(afterEnter)

    // Over a full second the total gain is exactly 200 (heal from the 5 ticks
    // above + the remaining 55 ticks = 200).
    for (let t = 5; t < TICK_RATE; t++) { state.tick++; tickStatusEffects(state.units, state) }
    expect(dar.currentHp - afterEnter).toBe(200)

    // Jump to full — next monitor tick reverts him
    dar.currentHp = dar.maxHp
    state.tick++; tickStatusEffects(state.units, state)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(false)
  })

  it('only enters Zen once per combat — dropping below 50% again does not re-trigger', () => {
    const { dar, state } = makeZenScenario()
    dar.currentHp = Math.floor(dar.maxHp * 0.5)
    tickStatusEffects(state.units, state)   // first entry
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(true)

    // Exit by reaching full health
    dar.currentHp = dar.maxHp
    state.tick++; tickStatusEffects(state.units, state)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(false)

    // Drop low again — Zen must NOT come back
    dar.currentHp = Math.floor(dar.maxHp * 0.3)
    state.tick++; tickStatusEffects(state.units, state)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(false)
    expect(dar.shields.some(s => s.sourceAbility === 'zen')).toBe(false)
  })

  it('reverts to angry form when the Zen shield is broken by damage', () => {
    const { dar, state } = makeZenScenario()
    dar.currentHp = Math.floor(dar.maxHp * 0.5)
    tickStatusEffects(state.units, state)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(true)

    const attacker = makeUnit('dummy', 'enemy', 1)
    applyDamage(attacker, dar, { baseAmount: 5000, damageType: 'true', canCrit: false }, state)

    expect(dar.shields.some(s => s.sourceAbility === 'zen')).toBe(false)
    expect(dar.statusEffects.some(fx => fx.stackId === 'zen_form')).toBe(false)
  })

  it('first cast after entering Zen deals 50% more and consumes the marker', () => {
    const bigEnemyState = (empowered: boolean) => {
      const dar = makeUnit('darmanitan', 'player', 1); dar.hexPos = { col: 3, row: 5 }
      dar.critChance = 0   // deterministic damage — assert the exact 1.5× ratio
      const e = makeUnit('dummy', 'enemy', 1)
      e.maxHp = 1_000_000; e.currentHp = 1_000_000; e.hexPos = { col: 3, row: 4 }
      const state = createCombatState([dar], [e])
      if (empowered) {
        dar.currentHp = Math.floor(dar.maxHp * 0.5)
        tickStatusEffects(state.units, state)  // enter Zen → adds empower marker
        dar.shields = []  // clear shield so it doesn't interfere; keep the marker
      }
      cast(dar, state); advanceLeaps(dar, state)
      return { dar, dmg: e.maxHp - e.currentHp }
    }

    const plain     = bigEnemyState(false)
    const empowered = bigEnemyState(true)

    expect(empowered.dmg).toBeCloseTo(plain.dmg * 1.5, -1)
    expect(empowered.dar.statusEffects.some(fx => fx.stackId === 'zen_empower_cast')).toBe(false)
  })
})
