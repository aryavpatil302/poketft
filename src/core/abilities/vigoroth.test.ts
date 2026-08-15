import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 15

function makeTestState(player: Unit, enemy: Unit): CombatState {
  player.hexPos = { col: 3, row: 4 }
  enemy.hexPos  = { col: 3, row: 1 }
  return createCombatState([player], [enemy])
}

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Mirrors combatEngine tickLeapMovement — advances the leap until landing.
function advanceLeaps(unit: Unit, state: CombatState, maxTicks = 3000): void {
  for (let t = 0; t < maxTicks; t++) {
    if (unit.state !== 'leaping') break
    const arrived = tickLeapPixel(unit, state)
    if (arrived && !(unit as any)._leap) unit.state = 'idle'
  }
}

describe('Vigoroth - Fury Swipes', () => {
  let vigoroth: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    vigoroth = makeUnit('vigoroth', 'player', 1)
    enemy    = makeUnit('tangela', 'enemy', 1)
    state    = makeTestState(vigoroth, enemy)
    vigoroth.targetId = enemy.id
  })

  it('triggers ability cast animation', () => {
    vigoroth.currentMana = vigoroth.maxMana
    triggerAbility(vigoroth, state)
    expect(vigoroth.state).toBe('casting')
    expect(vigoroth.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('resets mana to 0 after cast', () => {
    cast(vigoroth, state)
    expect(vigoroth.currentMana).toBe(0)
  })

  it('enters leaping state after cast', () => {
    cast(vigoroth, state)
    expect(vigoroth.state).toBe('leaping')
    expect(vigoroth.targetId).toBe(enemy.id)
  })

  // Shield = base[tier-1] scaled by special/100 — mirrors vigoroth.ts onCast.
  const SHIELD_BASE = [200, 350, 500] as const

  it('applies a shield on landing (6-second duration)', () => {
    cast(vigoroth, state)
    advanceLeaps(vigoroth, state)
    const spMult = computeStats(vigoroth).special / 100
    expect(vigoroth.shields).toHaveLength(1)
    expect(vigoroth.shields[0].value).toBe(Math.round(SHIELD_BASE[0] * spMult))
    expect(vigoroth.shields[0].durationTicks).toBe(6 * TICK_RATE)
  })

  it('shield scales by tier and special attack', () => {
    for (const tier of [1, 2, 3] as const) {
      const v = makeUnit('vigoroth', 'player', tier)
      const e = makeUnit('tangela', 'enemy', 1)
      const s = makeTestState(v, e)
      v.targetId = e.id
      cast(v, s)
      advanceLeaps(v, s)
      const spMult = computeStats(v).special / 100
      expect(v.shields[0].value).toBe(Math.round(SHIELD_BASE[tier - 1] * spMult))
    }
  })

  it('applies atkSpd_buff status effect on landing', () => {
    cast(vigoroth, state)
    advanceLeaps(vigoroth, state)
    const buff = vigoroth.statusEffects.find(e => e.id === 'atkSpd_buff')
    expect(buff).toBeDefined()
    expect(buff?.magnitude).toBeCloseTo(0.20)  // tier 1 = 20%
    expect(buff?.durationTicks).toBe(-1)        // removed when shield expires
  })

  it('applies dmg_buff status effect on landing (tier 1 = +50 flat attack)', () => {
    cast(vigoroth, state)
    advanceLeaps(vigoroth, state)
    const buff = vigoroth.statusEffects.find(e => e.id === 'dmg_buff')
    expect(buff).toBeDefined()
    expect(buff?.magnitude).toBe(50)
  })

  it('atkSpd buff reflects in computeStats', () => {
    const baseAs = vigoroth.attackSpeed
    cast(vigoroth, state)
    advanceLeaps(vigoroth, state)
    computeStats(vigoroth)
    expect(vigoroth._computedStats!.attackSpeed).toBeCloseTo(baseAs + baseAs * 0.20)
  })

  it('dmg_buff reflects in computeStats', () => {
    const baseAtk = vigoroth.attack
    cast(vigoroth, state)
    advanceLeaps(vigoroth, state)
    computeStats(vigoroth)
    expect(vigoroth._computedStats!.attack).toBe(baseAtk + 50)
  })

  it('removing the shield via onExpire removes both buffs', () => {
    cast(vigoroth, state)
    advanceLeaps(vigoroth, state)

    const shield = vigoroth.shields[0]
    if (shield.onExpire) shield.onExpire(vigoroth, shield)

    expect(vigoroth.statusEffects.find(e => e.id === 'atkSpd_buff')).toBeUndefined()
    expect(vigoroth.statusEffects.find(e => e.id === 'dmg_buff')).toBeUndefined()
  })
})
