import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS    = 20
const TICK_INTERVAL = Math.round(TICK_RATE * 0.5)  // 30

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Advance status effects by N ticks
function tickN(state: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
  }
}

describe('Abomasnow - Blizzard', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('abomasnow', 'player', 1)
    caster.hexPos = { col: 3, row: 6 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('applies a 30-magnitude MR shred for 3 seconds', () => {
    cast(caster, state)
    const shred = enemy.statusEffects.find(fx => fx.id === 'shred')
    expect(shred).toBeDefined()
    expect(shred!.magnitude).toBe(30)
    expect(shred!.durationTicks).toBe(3 * TICK_RATE)
  })

  it('emits abomasnow_blizzard_start vfx event', () => {
    cast(caster, state)
    expect(state.events.some(e =>
      e.type === 'vfx' && (e as { effectId: string }).effectId === 'abomasnow_blizzard_start'
    )).toBe(true)
  })

  it('instant cast damage hits enemies in the best-center radius', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('instant cast damage is 300 at tier 1 (mitigated by dummy spDefense=30)', () => {
    // 300 * 100/(100+30) = 230.7 → Math.round = 231
    cast(caster, state)
    expect(enemy.currentHp).toBe(enemy.maxHp - 231)
  })

  it('applies blizzard_chill status effect to enemies in zone', () => {
    cast(caster, state)
    expect(enemy.statusEffects.some(fx => fx.id === 'blizzard_chill')).toBe(true)
  })

  it('blizzard_chill durationTicks is 240 (4 seconds)', () => {
    cast(caster, state)
    const chill = enemy.statusEffects.find(fx => fx.id === 'blizzard_chill')!
    expect(chill.durationTicks).toBe(4 * TICK_RATE)
  })

  it('tick damage fires after TICK_INTERVAL ticks (follows the enemy)', () => {
    cast(caster, state)
    const hpAfterCast = enemy.currentHp
    // Advance enough ticks for the first tick damage to fire
    tickN(state, TICK_INTERVAL)
    expect(enemy.currentHp).toBeLessThan(hpAfterCast)
  })

  it('tier 1 tick damage is 75 (shred reduces dummy spDef 30→0, no mitigation)', () => {
    cast(caster, state)
    const hpAfterCast = enemy.currentHp
    tickN(state, TICK_INTERVAL)
    expect(hpAfterCast - enemy.currentHp).toBe(75)
  })

  it('tier 2 tick damage is 100', () => {
    const c2 = makeUnit('abomasnow', 'player', 2)
    c2.hexPos = { col: 3, row: 6 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([c2], [e2])
    cast(c2, s2)
    const hpAfterCast = e2.currentHp
    tickN(s2, TICK_INTERVAL)
    expect(hpAfterCast - e2.currentHp).toBe(100)
  })

  it('tier 3 tick damage is 200', () => {
    const c3 = makeUnit('abomasnow', 'player', 3)
    c3.hexPos = { col: 3, row: 6 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([c3], [e3])
    cast(c3, s3)
    const hpAfterCast = e3.currentHp
    tickN(s3, TICK_INTERVAL)
    expect(hpAfterCast - e3.currentHp).toBe(200)
  })

  it('recasting clears old debuffs and creates fresh ones', () => {
    cast(caster, state)
    tickN(state, 10)
    // HP after first cast + 10 ticks (no tick damage yet)
    const hpBeforeRecast = enemy.currentHp
    cast(caster, state)
    // Should still have exactly one blizzard_chill
    const chills = enemy.statusEffects.filter(fx => fx.id === 'blizzard_chill')
    expect(chills).toHaveLength(1)
    expect(chills[0].durationTicks).toBe(4 * TICK_RATE)
    // Instant damage fires again on recast
    expect(enemy.currentHp).toBeLessThan(hpBeforeRecast)
  })

  it('burst centers on the largest enemy cluster (both clustered enemies chilled)', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos  = { col: 3, row: 2 }
    enemy2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [enemy, enemy2])
    cast(caster, state)
    expect(enemy.statusEffects.some(fx => fx.id === 'blizzard_chill')).toBe(true)
    expect(enemy2.statusEffects.some(fx => fx.id === 'blizzard_chill')).toBe(true)
  })
})
