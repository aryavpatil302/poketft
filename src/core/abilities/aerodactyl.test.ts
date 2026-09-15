import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import { acquireTarget } from '../systems/targeting'
import { hexDistance } from '../hexGrid'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Aerodactyl - Ancient Power', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('aerodactyl', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('applies ancient_power_stats status effect at tier 1 magnitude 0.30', () => {
    cast(caster, state)
    const fx = caster.statusEffects.find(e => e.id === 'ancient_power_stats')
    expect(fx).toBeDefined()
    expect(fx?.magnitude).toBeCloseTo(0.30)
    expect(fx?.durationTicks).toBe(-1)
  })

  it('applies ancient_power_stats with magnitude 0.45 at tier 2', () => {
    const t2 = makeUnit('aerodactyl', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    const fx = t2.statusEffects.find(e => e.id === 'ancient_power_stats')
    expect(fx?.magnitude).toBeCloseTo(0.45)
  })

  it('applies ancient_power_stats with magnitude 0.80 at tier 3', () => {
    const t3 = makeUnit('aerodactyl', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    const fx = t3.statusEffects.find(e => e.id === 'ancient_power_stats')
    expect(fx?.magnitude).toBeCloseTo(0.80)
  })

  it('ancient_power_stats multiplies attack in computeStats', () => {
    const baseAtk = caster.attack
    cast(caster, state)
    const cs = computeStats(caster)
    expect(cs.attack).toBe(Math.round(baseAtk * 1.30))
  })

  it('ancient_power_stats multiplies attackSpeed in computeStats', () => {
    const baseSpd = caster.attackSpeed
    cast(caster, state)
    const cs = computeStats(caster)
    expect(cs.attackSpeed).toBeCloseTo(baseSpd * 1.30)
  })

  it('ancient_power_stats multiplies moveSpeed in computeStats', () => {
    const baseMs = caster.moveSpeed
    cast(caster, state)
    const cs = computeStats(caster)
    expect(cs.moveSpeed).toBeCloseTo(baseMs * 1.30)
  })

  it('applies 25% omnivamp', () => {
    cast(caster, state)
    const cs = computeStats(caster)
    expect(cs.omnivamp).toBeCloseTo(0.25)
  })

  it('increases range by 1', () => {
    const baseRange = caster.range
    cast(caster, state)
    expect(caster.range).toBe(baseRange + 1)
  })

  it('does not stack buff on second cast', () => {
    cast(caster, state)
    const rangeAfterFirst = caster.range
    caster.currentMana = caster.maxMana
    cast(caster, state)
    expect(caster.range).toBe(rangeAfterFirst)
    const statFxCount = caster.statusEffects.filter(e => e.id === 'ancient_power_stats').length
    expect(statFxCount).toBe(1)
  })

  it('adds a passiveAttackHandler with id aerodactyl_rock', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'aerodactyl_rock')
    expect(handler).toBeDefined()
  })

  it('does not add duplicate passiveAttackHandler on second cast', () => {
    cast(caster, state)
    caster.currentMana = caster.maxMana
    cast(caster, state)
    const handlers = caster.passiveAttackHandlers.filter(h => h.id === 'aerodactyl_rock')
    expect(handlers).toHaveLength(1)
  })

  it('rock handler adds a projectile starting at the target position (fires on projectile hit)', () => {
    cast(caster, state)
    // Need a second enemy to be the "farthest from the main target"
    const far = makeUnit('dummy', 'enemy', 1)
    far.hexPos = { col: 5, row: 0 }
    state.units.set(far.id, far)

    const handler = caster.passiveAttackHandlers.find(h => h.id === 'aerodactyl_rock')!
    // Rock fires via onProjectileHit (when the auto projectile lands), not onAttack
    handler.onProjectileHit!(caster, enemy, state)
    expect(state.projectiles.size).toBeGreaterThan(0)
    const proj = [...state.projectiles.values()][0]
    // Projectile starts at target's visual position
    expect(proj.startPos.x).toBeCloseTo(enemy.visualPos.x)
    expect(proj.startPos.y).toBeCloseTo(enemy.visualPos.y)
    // Target is the far unit, not the original target
    expect(proj.targetId).toBe(far.id)
  })

  it('rock projectile has aerodactyl_ancient_power_rock abilityId', () => {
    cast(caster, state)
    const far = makeUnit('dummy', 'enemy', 1)
    far.hexPos = { col: 5, row: 0 }
    state.units.set(far.id, far)

    const handler = caster.passiveAttackHandlers.find(h => h.id === 'aerodactyl_rock')!
    handler.onProjectileHit!(caster, enemy, state)
    const proj = [...state.projectiles.values()][0]
    expect(proj.abilityId).toBe('aerodactyl_ancient_power_rock')
  })

  it('invalidates _computedStats after cast', () => {
    cast(caster, state)
    expect(caster._computedStats).toBeNull()
  })

  it('suppresses mana gain permanently after first cast', () => {
    cast(caster, state)
    const fx = caster.statusEffects.find(e => e.stackId === 'aerodactyl_no_mana')
    expect(fx).toBeDefined()
    expect(fx?.suppressManaGain).toBe(true)
    expect(fx?.durationTicks).toBe(-1)
  })

  describe('dash + drop aggro', () => {
    beforeEach(() => {
      // Adjacent placement so the dash's 1-hex "behind" destination stays on-board.
      caster.hexPos = { col: 3, row: 3 }
      enemy.hexPos  = { col: 3, row: 4 }
      state = createCombatState([caster], [enemy])
      caster.targetId = enemy.id
    })

    it('enters leaping state and applies suppressTargeting on cast', () => {
      cast(caster, state)
      expect(caster.state).toBe('leaping')
      const fx = caster.statusEffects.find(e => e.stackId === 'aerodactyl_dash_evade')
      expect(fx).toBeDefined()
      expect(fx?.suppressTargeting).toBe(true)
    })

    it('cannot be acquired as a target by an enemy while dashing', () => {
      cast(caster, state)
      const attacker = makeUnit('dummy', 'enemy', 1)
      attacker.hexPos = { col: 3, row: 6 }
      state.units.set(attacker.id, attacker)
      expect(acquireTarget(attacker, state)).toBeNull()
    })

    function driveLeapToCompletion(): void {
      for (let i = 0; i < 200 && tickLeapPixel(caster, state) === false; i++) { /* keep ticking */ }
    }

    it('lands 1 hex further from the target than his original position', () => {
      const startDist = hexDistance(caster.hexPos, enemy.hexPos)
      cast(caster, state)
      driveLeapToCompletion()
      expect(hexDistance(caster.hexPos, enemy.hexPos)).toBe(startDist + 1)
    })

    it('clears suppressTargeting and becomes targetable again on landing', () => {
      cast(caster, state)
      driveLeapToCompletion()
      expect(caster.statusEffects.some(e => e.stackId === 'aerodactyl_dash_evade')).toBe(false)

      const attacker = makeUnit('dummy', 'enemy', 1)
      attacker.hexPos = { col: 3, row: 6 }
      state.units.set(attacker.id, attacker)
      expect(acquireTarget(attacker, state)).toBe(caster.id)
    })

    it('clears targetId on landing so he re-acquires from the new hex', () => {
      cast(caster, state)
      driveLeapToCompletion()
      expect(caster.targetId).toBeNull()
    })
  })
})
