import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickProjectiles } from '../projectile'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

// Froslass at {col:4, row:5} with target at {col:4, row:4}:
// cube direction = (0,-1,1), line hexes (from Froslass outward):
//   {col:4, row:4}, {col:3, row:3}, {col:3, row:2}, {col:2, row:1}, {col:2, row:0}
const FROSLASS_POS = { col: 4, row: 5 }
const LINE_HEX_1   = { col: 4, row: 4 }  // nearest in line
const LINE_HEX_2   = { col: 3, row: 3 }  // second in line

// Full cast: trigger + cast animation + tick status effects + drain all projectiles.
// Runs up to 150 combined ticks to cover 3 staggered shots (20 ticks apart).
function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
  for (let i = 0; i < 150; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
    tickProjectiles(state)
    if (state.projectiles.size === 0 && !caster.statusEffects.some(fx => fx.stackId === 'froslass_volley')) break
  }
}

describe('Froslass - Icy Wind', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('froslass', 'player', 1)
    caster.hexPos = { ...FROSLASS_POS }
    caster.critChance = 0; caster._computedStats = null  // deterministic, no crits
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { ...LINE_HEX_1 }
    state = createCombatState([caster], [enemy])
    caster.targetId = enemy.id
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('spawns a projectile with the correct abilityId', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    for (let i = 0; i < 20; i++) tickAbilityCast(caster, state)
    const proj = [...state.projectiles.values()].find(p => p.abilityId === 'froslass_icy_wind')
    expect(proj).toBeDefined()
  })

  it('deals magic damage to the enemy in the line (tier 1)', () => {
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(enemy.maxHp)
  })

  it('tier 2 deals more damage than tier 1 to a single enemy', () => {
    const t1 = makeUnit('froslass', 'player', 1)
    t1.hexPos = { ...FROSLASS_POS }; t1.critChance = 0; t1._computedStats = null
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { ...LINE_HEX_1 }
    const s1 = createCombatState([t1], [e1])
    t1.targetId = e1.id
    cast(t1, s1)
    const dmgT1 = e1.maxHp - e1.currentHp

    const t2 = makeUnit('froslass', 'player', 2)
    t2.hexPos = { ...FROSLASS_POS }; t2.critChance = 0; t2._computedStats = null
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { ...LINE_HEX_1 }
    const s2 = createCombatState([t2], [e2])
    t2.targetId = e2.id
    cast(t2, s2)
    const dmgT2 = e2.maxHp - e2.currentHp

    expect(dmgT2).toBeGreaterThan(dmgT1)
  })

  it('tier 3 deals more damage than tier 2 to a single enemy', () => {
    const t2 = makeUnit('froslass', 'player', 2)
    t2.hexPos = { ...FROSLASS_POS }; t2.critChance = 0; t2._computedStats = null
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { ...LINE_HEX_1 }
    const s2 = createCombatState([t2], [e2])
    t2.targetId = e2.id
    cast(t2, s2)
    const dmgT2 = e2.maxHp - e2.currentHp

    const t3 = makeUnit('froslass', 'player', 3)
    t3.hexPos = { ...FROSLASS_POS }; t3.critChance = 0; t3._computedStats = null
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { ...LINE_HEX_1 }
    const s3 = createCombatState([t3], [e3])
    t3.targetId = e3.id
    cast(t3, s3)
    const dmgT3 = e3.maxHp - e3.currentHp

    expect(dmgT3).toBeGreaterThan(dmgT2)
  })

  it('applies chill to the hit enemy', () => {
    cast(caster, state)
    const chill = enemy.statusEffects.find(e => e.id === 'chill')
    expect(chill).toBeDefined()
    expect(chill!.magnitude).toBe(0.25)
    // Duration ticks down during the volley; just verify it was set to 2s and is still active
    expect(chill!.durationTicks).toBeGreaterThan(0)
    expect(chill!.durationTicks).toBeLessThanOrEqual(2 * TICK_RATE)
  })

  it('second enemy in line takes 75% of first enemy damage (falloff)', () => {
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { ...LINE_HEX_1 }  // nearest
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { ...LINE_HEX_2 }  // second in line

    const fr = makeUnit('froslass', 'player', 1)
    fr.hexPos = { ...FROSLASS_POS }
    fr.critChance = 0; fr._computedStats = null

    const st = createCombatState([fr], [e1, e2])
    fr.targetId = e1.id
    cast(fr, st)

    const dmg1 = e1.maxHp - e1.currentHp
    const dmg2 = e2.maxHp - e2.currentHp

    expect(dmg1).toBeGreaterThan(0)
    expect(dmg2).toBeGreaterThan(0)
    expect(dmg2).toBeLessThan(dmg1)
    // Second target takes ~75% of first (allow small rounding variance from mitigation)
    expect(dmg2 / dmg1).toBeGreaterThan(0.65)
    expect(dmg2 / dmg1).toBeLessThan(0.85)
  })

  it('fires 3 shots total — enemy takes 3x the single-shot damage', () => {
    // One shot deals baseDamage mitigated. Three shots = 3×.
    const single = makeUnit('froslass', 'player', 1)
    single.hexPos = { ...FROSLASS_POS }; single.critChance = 0; single._computedStats = null
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { ...LINE_HEX_1 }
    const s1 = createCombatState([single], [e1])
    single.targetId = e1.id
    // Manually fire one shot only
    single.currentMana = single.maxMana
    triggerAbility(single, s1)
    for (let i = 0; i < 20; i++) tickAbilityCast(single, s1)
    // Remove the volley status so only shot 1 fires
    single.statusEffects = single.statusEffects.filter(fx => fx.stackId !== 'froslass_volley')
    for (let i = 0; i < 200 && s1.projectiles.size > 0; i++) tickProjectiles(s1)
    const oneShotDmg = e1.maxHp - e1.currentHp

    // Full 3-shot cast
    const fr3 = makeUnit('froslass', 'player', 1)
    fr3.hexPos = { ...FROSLASS_POS }; fr3.critChance = 0; fr3._computedStats = null
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { ...LINE_HEX_1 }
    const s3 = createCombatState([fr3], [e3])
    fr3.targetId = e3.id
    cast(fr3, s3)
    const threesShotDmg = e3.maxHp - e3.currentHp

    expect(threesShotDmg).toBe(oneShotDmg * 3)
  })

  it('does not deal damage when no targetId is set', () => {
    caster.targetId = null
    const hpBefore = enemy.currentHp
    cast(caster, state)
    expect(enemy.currentHp).toBe(hpBefore)
  })

  it('spawns a projectile but deals no damage when no enemies are in the line', () => {
    // Place the only enemy OFF the line path (far corner)
    enemy.hexPos = { col: 0, row: 0 }
    const offState = createCombatState([caster], [enemy])
    caster.targetId = enemy.id
    const hpBefore = enemy.currentHp

    caster.currentMana = caster.maxMana
    triggerAbility(caster, offState)
    for (let i = 0; i < 20; i++) tickAbilityCast(caster, offState)

    // A visual projectile is always spawned even when the line is empty
    expect(offState.projectiles.size).toBe(1)
    expect(enemy.currentHp).toBe(hpBefore)
  })
})
