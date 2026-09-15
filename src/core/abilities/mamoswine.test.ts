import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { tickAttack, startAttacking } from '../systems/attack'
import { initTraitEffects } from '../systems/traitEffects'
import { computeStats } from '../unitFactory'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS    = 20
const BUFF_DURATION = 5 * TICK_RATE  // 300

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function tickN(state: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
  }
}

describe('Mamoswine - Thick Fat', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('mamoswine', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('applies thick_fat status effect', () => {
    cast(caster, state)
    expect(caster.statusEffects.some(fx => fx.stackId === 'thick_fat')).toBe(true)
  })

  it('buff lasts 5 seconds (300 ticks)', () => {
    cast(caster, state)
    const fx = caster.statusEffects.find(fx => fx.stackId === 'thick_fat')!
    expect(fx.durationTicks).toBe(BUFF_DURATION)
  })

  it('tier 1 adds 50 armor and MR via computeStats', () => {
    cast(caster, state)
    const stats = computeStats(caster)
    expect(stats.defense).toBe(caster.defense + 50)
    expect(stats.spDefense).toBe(caster.spDefense + 50)
  })

  it('tier 2 adds 75 armor and MR', () => {
    const c2 = makeUnit('mamoswine', 'player', 2)
    c2.hexPos = { col: 3, row: 5 }
    const s2 = createCombatState([c2], [makeUnit('dummy', 'enemy', 1)])
    cast(c2, s2)
    const stats = computeStats(c2)
    expect(stats.defense).toBe(c2.defense + 75)
    expect(stats.spDefense).toBe(c2.spDefense + 75)
  })

  it('tier 3 adds 200 armor and MR', () => {
    const c3 = makeUnit('mamoswine', 'player', 3)
    c3.hexPos = { col: 3, row: 5 }
    const s3 = createCombatState([c3], [makeUnit('dummy', 'enemy', 1)])
    cast(c3, s3)
    const stats = computeStats(c3)
    expect(stats.defense).toBe(c3.defense + 200)
    expect(stats.spDefense).toBe(c3.spDefense + 200)
  })

  it('suppressManaGain is active during buff', () => {
    cast(caster, state)
    const fx = caster.statusEffects.find(fx => fx.stackId === 'thick_fat')!
    expect(fx.suppressManaGain).toBe(true)
  })

  it('emits mamoswine_thick_fat_start vfx event on cast', () => {
    cast(caster, state)
    expect(state.events.some(e =>
      e.type === 'vfx' && (e as { effectId: string }).effectId === 'mamoswine_thick_fat_start'
    )).toBe(true)
  })

  it('heals for 30% of damage taken at tier 1 when buff expires', () => {
    cast(caster, state)
    // Simulate 200 damage taken during the buff window
    caster.damageTakenThisCombat += 200
    const hpBefore = caster.currentHp
    tickN(state, BUFF_DURATION)
    // Heal should be 30% of 200 = 60
    expect(caster.currentHp).toBe(Math.min(caster.maxHp, hpBefore + 60))
  })

  it('heal at tier 2 is 45% of damage taken', () => {
    const c2 = makeUnit('mamoswine', 'player', 2)
    c2.hexPos = { col: 3, row: 5 }
    const s2 = createCombatState([c2], [makeUnit('dummy', 'enemy', 1)])
    cast(c2, s2)
    c2.damageTakenThisCombat += 200
    const hpBefore = c2.currentHp
    tickN(s2, BUFF_DURATION)
    expect(c2.currentHp).toBe(Math.min(c2.maxHp, hpBefore + 90))
  })

  it('heal at tier 3 is 100% of damage taken', () => {
    const c3 = makeUnit('mamoswine', 'player', 3)
    c3.hexPos = { col: 3, row: 5 }
    const s3 = createCombatState([c3], [makeUnit('dummy', 'enemy', 1)])
    cast(c3, s3)
    c3.damageTakenThisCombat += 200
    const hpBefore = c3.currentHp
    tickN(s3, BUFF_DURATION)
    expect(c3.currentHp).toBe(Math.min(c3.maxHp, hpBefore + 200))
  })

  it('does not heal if no damage was taken during the buff', () => {
    cast(caster, state)
    const hpBefore = caster.currentHp
    tickN(state, BUFF_DURATION)
    expect(caster.currentHp).toBe(hpBefore)
  })

  it('recasting replaces the existing buff (single thick_fat effect)', () => {
    cast(caster, state)
    tickN(state, 10)
    cast(caster, state)
    const fxList = caster.statusEffects.filter(fx => fx.stackId === 'thick_fat')
    expect(fxList).toHaveLength(1)
    expect(fxList[0].durationTicks).toBe(BUFF_DURATION)
  })
})

describe('Mamoswine - Froststone mark interaction while empowered', () => {
  // Froststone activates at 2+ species — Mamoswine alone isn't enough.
  let caster: Unit
  let ally: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('mamoswine', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    ally = makeUnit('weavile', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster, ally], [enemy])
    initTraitEffects(state)
    computeStats(caster)
  })

  function driveAutos(count: number): number[] {
    caster.targetId = enemy.id
    startAttacking(caster)
    const stacksAfterEachAuto: number[] = []
    let seen = 0
    let lastCount = caster.attackCount
    for (let t = 0; t < 2000 && seen < count; t++) {
      state.tick++
      tickStatusEffects(state.units, state)
      tickAttack(caster, state)
      if (caster.attackCount > lastCount) {
        seen++
        lastCount = caster.attackCount
        stacksAfterEachAuto.push(enemy.statusEffects.find(fx => fx.stackId === 'froststone_mark')?.magnitude ?? 0)
      }
    }
    return stacksAfterEachAuto
  }

  it('empowered autos build marks one at a time (no double-counting from the bonus damage instance)', () => {
    cast(caster, state)
    const stacks = driveAutos(4)
    expect(stacks).toEqual([1, 2, 3, 4])
  })

  it('an empowered auto consumes an already-5-stacked mark', () => {
    cast(caster, state)
    enemy.statusEffects.push({ id: 'froststone_mark', sourceUnitId: ally.id, durationTicks: -1, magnitude: 5, stackId: 'froststone_mark' })
    const [afterFirstAuto] = driveAutos(1)
    expect(afterFirstAuto).toBe(0)
  })

  it('a non-empowered auto cannot consume an already-5-stacked mark', () => {
    // No cast() — caster never gained the thick_fat_auto modifier.
    enemy.statusEffects.push({ id: 'froststone_mark', sourceUnitId: ally.id, durationTicks: -1, magnitude: 5, stackId: 'froststone_mark' })
    const [afterFirstAuto] = driveAutos(1)
    expect(afterFirstAuto).toBe(5)
  })
})
