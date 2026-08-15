import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickAttack } from '../systems/attack'
import { gainManaOnDamageTaken } from '../systems/mana'
import { tickLeapPixel } from '../systems/movement'
import { addStatusEffect, tickStatusEffects } from '../systems/statusEffect'
import { getNeighbors, hexDistance, hexId } from '../hexGrid'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 10): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

// Mirrors combatEngine tickLeapMovement — advances the leap until landing.
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !(unit as any)._leap) unit.state = 'idle'
  }
}

describe('Excadrill - Drill Run', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('excadrill', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    // Place enemy within 3 hexes
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 3 }
    state = createCombatState([caster], [enemy])
  })

  it('sets unit state to leaping after cast', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('is invulnerable while tunnelling (incomingDamageMult 0)', () => {
    cast(caster, state)
    expect(caster.incomingDamageMult).toBe(0)
  })

  it('restores vulnerability after landing', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(caster.incomingDamageMult).toBe(1.0)
  })

  it('restores vulnerability when the dash is interrupted mid-tunnel (stun/knockup)', () => {
    cast(caster, state)
    expect(caster.state).toBe('leaping')
    expect(caster.incomingDamageMult).toBe(0)   // invulnerable mid-tunnel

    // Advance partway, then a CC lands and interrupts the dash before it arrives.
    tickLeapPixel(caster, state)
    addStatusEffect(caster, { id: 'knockUp', sourceUnitId: 'x', durationTicks: 20, stackId: 'knockUp' })
    tickStatusEffects(state.units, state)

    expect(caster.state).toBe('knockedUp')
    expect(caster._leap).toBeUndefined()
    expect(caster.incomingDamageMult).toBe(1.0)   // no longer immune — the bug
  })

  it('applies knockUp status to the enemy on landing', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    const hasKnockUp = enemy.statusEffects.some(e => e.id === 'knockUp')
    expect(hasKnockUp).toBe(true)
  })

  it('knockUp duration is 0.5 seconds at all tiers', () => {
    for (const tier of [1, 2, 3] as const) {
      const u = makeUnit('excadrill', 'player', tier)
      u.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 3 }
      const s = createCombatState([u], [e])
      cast(u, s)
      advanceLeaps(u, s)
      const ku = e.statusEffects.find(fx => fx.id === 'knockUp')
      expect(ku).toBeDefined()
      expect(ku!.durationTicks).toBe(Math.round(0.5 * TICK_RATE))
    }
  })

  it('deals physical damage to the enemy on landing', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('adds exactly 3 attack modifiers after landing', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(caster.attackModifiers).toHaveLength(3)
  })

  it('each attack modifier has 1 remaining charge and correct bonus damage (tier 1 = 111)', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    for (const mod of caster.attackModifiers) {
      expect(mod.id).toBe('excadrill_drill')
      expect(mod.remainingCharges).toBe(1)
      expect(mod.bonusDamage).toBe(111)
      expect(mod.bonusDamageType).toBe('physical')
    }
  })

  it('attack modifiers have bonus damage of 245 at tier 2', () => {
    const t2 = makeUnit('excadrill', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 3 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    advanceLeaps(t2, s2)
    expect(t2.attackModifiers[0].bonusDamage).toBe(245)
  })

  it('attack modifiers have bonus damage of 676 at tier 3', () => {
    const t3 = makeUnit('excadrill', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 3 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    advanceLeaps(t3, s3)
    expect(t3.attackModifiers[0].bonusDamage).toBe(676)
  })

  it('target is set to the enemy after landing', () => {
    cast(caster, state)
    advanceLeaps(caster, state)
    expect(caster.targetId).toBe(enemy.id)
  })

  it('empowered attack splash only hits enemies adjacent to Excadrill, not adjacent to his attack target', () => {
    cast(caster, state)
    advanceLeaps(caster, state)  // caster now lands adjacent to `enemy` with 3 attackModifiers queued

    const casterNeighbors = getNeighbors(caster.hexPos)
    const targetNeighbors = getNeighbors(enemy.hexPos)

    // Adjacent to Excadrill himself, but not adjacent to his attack target — should be hit after the fix
    const nearCasterOnlyHex = casterNeighbors.find(h =>
      hexDistance(h, enemy.hexPos) !== 0 &&
      !targetNeighbors.some(t => t.col === h.col && t.row === h.row)
    )
    // Adjacent to his attack target, but not adjacent to Excadrill — must NOT be hit (this was the bug)
    const nearTargetOnlyHex = targetNeighbors.find(h =>
      hexDistance(h, caster.hexPos) !== 0 &&
      !casterNeighbors.some(c => c.col === h.col && c.row === h.row)
    )
    expect(nearCasterOnlyHex).toBeDefined()
    expect(nearTargetOnlyHex).toBeDefined()

    const nearCaster = makeUnit('dummy', 'enemy', 1)
    nearCaster.hexPos = nearCasterOnlyHex!
    state.units.set(nearCaster.id, nearCaster)
    state.hexOccupancy.set(hexId(nearCaster.hexPos), nearCaster.id)

    const nearTarget = makeUnit('dummy', 'enemy', 1)
    nearTarget.hexPos = nearTargetOnlyHex!
    state.units.set(nearTarget.id, nearTarget)
    state.hexOccupancy.set(hexId(nearTarget.hexPos), nearTarget.id)

    const hpNearCaster = nearCaster.currentHp
    const hpNearTarget = nearTarget.currentHp

    // Run one full empowered auto-attack cycle (stop once the first charge is consumed)
    caster.state = 'attacking'
    for (let i = 0; i < 300 && caster.attackModifiers.length === 3; i++) {
      tickAttack(caster, state)
    }

    expect(nearCaster.currentHp).toBeLessThan(hpNearCaster)  // adjacent to Excadrill → hit
    expect(nearTarget.currentHp).toBe(hpNearTarget)          // adjacent to target only → not hit
  })

  it('blocks all mana gain during the empowered sequence, including damage taken', () => {
    cast(caster, state)
    advanceLeaps(caster, state)

    const fx = caster.statusEffects.find(f => f.stackId === 'excadrill_empowered')
    expect(fx?.suppressManaGain).toBe(true)

    // gainManaOnDamageTaken respects the effect, so getting hit can't re-charge him
    caster.currentMana = 0
    gainManaOnDamageTaken(caster, 500)
    expect(caster.currentMana).toBe(0)
  })

  it('clears the mana lock after the third empowered auto, so autos resume normally', () => {
    cast(caster, state)
    advanceLeaps(caster, state)

    caster.state = 'attacking'
    for (let i = 0; i < 900 && caster.attackModifiers.length > 0; i++) {
      tickAttack(caster, state)
    }

    expect(caster.attackModifiers).toHaveLength(0)
    expect(caster.statusEffects.some(f => f.stackId === 'excadrill_empowered')).toBe(false)

    // Mana gain works again (clear the post-cast 1s mana lock, which nothing
    // ticks down in this harness)
    caster.currentMana = 0
    caster.manaLockTimer = 0
    gainManaOnDamageTaken(caster, 500)
    expect(caster.currentMana).toBeGreaterThan(0)
  })
})
