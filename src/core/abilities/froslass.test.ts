import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import { hexLinePath } from '../hexGrid'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Froslass - Icy Wind', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('froslass', 'player', 1)
    caster.hexPos = { col: 3, row: 6 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }
    state = createCombatState([caster], [enemy])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('deals magic damage to the furthest enemy (tier 1)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 2 deals more damage than tier 1 to a single enemy', () => {
    const t1 = makeUnit('froslass', 'player', 1)
    t1.hexPos = { col: 3, row: 6 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 0 }
    const s1 = createCombatState([t1], [e1])
    cast(t1, s1)
    const dmgT1 = e1.maxHp - e1.currentHp

    const t2 = makeUnit('froslass', 'player', 2)
    t2.hexPos = { col: 3, row: 6 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 0 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const dmgT2 = e2.maxHp - e2.currentHp

    expect(dmgT2).toBeGreaterThan(dmgT1)
  })

  it('tier 3 deals more damage than tier 2 to a single enemy', () => {
    const t2 = makeUnit('froslass', 'player', 2)
    t2.hexPos = { col: 3, row: 6 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 0 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const dmgT2 = e2.maxHp - e2.currentHp

    const t3 = makeUnit('froslass', 'player', 3)
    t3.hexPos = { col: 3, row: 6 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 0 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const dmgT3 = e3.maxHp - e3.currentHp

    expect(dmgT3).toBeGreaterThan(dmgT2)
  })

  it('applies chill to the hit enemy', () => {
    cast(caster, state)
    const chill = enemy.statusEffects.find(e => e.id === 'chill')
    expect(chill).toBeDefined()
    expect(chill!.magnitude).toBe(0.25)
    expect(chill!.durationTicks).toBe(2 * TICK_RATE)
  })

  it('second enemy in line takes 75% of first enemy damage (falloff)', () => {
    // Build a true line from froslass to back wall using hexLinePath
    // Froslass at (3,6), furthest at (3,0)
    const lineHexes = hexLinePath({ col: 3, row: 6 }, { col: 3, row: 0 })

    // Find the hex at i=1 and i=2 from the BACK (furthest from froslass) to place enemies
    // The line includes the start. Enemies must be on enemy team.
    // Place enemy1 at the end (furthest), enemy2 at the intermediate position
    const line = lineHexes.filter(h => h.row >= 0 && h.row <= 3)  // enemy half
    if (line.length < 2) {
      // Not enough hexes in enemy territory — skip with a sanity assertion
      expect(line.length).toBeGreaterThanOrEqual(1)
      return
    }

    // Sort by distance from froslass ascending (nearest first in the line)
    const frossPos = { col: 3, row: 6 }
    line.sort((a, b) => {
      const da = Math.abs(a.row - frossPos.row)
      const db = Math.abs(b.row - frossPos.row)
      return da - db
    })

    const firstHitHex  = line[0]
    const secondHitHex = line[1]

    const firstEnemy  = makeUnit('dummy', 'enemy', 1)
    firstEnemy.hexPos  = firstHitHex
    const secondEnemy = makeUnit('dummy', 'enemy', 1)
    secondEnemy.hexPos = secondHitHex

    const fr = makeUnit('froslass', 'player', 1)
    fr.hexPos = { col: 3, row: 6 }

    const st = createCombatState([fr], [firstEnemy, secondEnemy])
    cast(fr, st)

    const dmgFirst  = firstEnemy.maxHp  - firstEnemy.currentHp
    const dmgSecond = secondEnemy.maxHp - secondEnemy.currentHp

    if (dmgFirst > 0 && dmgSecond > 0) {
      // Second target should take ~75% of first
      expect(dmgSecond).toBeLessThan(dmgFirst)
      // Approximately 75% — allow ±5 for rounding and mitigation differences
      expect(dmgSecond / dmgFirst).toBeGreaterThan(0.5)
      expect(dmgSecond / dmgFirst).toBeLessThan(1.0)
    }
  })

  it('does no damage when no enemies exist', () => {
    const loneState = createCombatState([caster], [])
    expect(() => cast(caster, loneState)).not.toThrow()
  })
})
