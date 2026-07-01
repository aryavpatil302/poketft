import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import { computeStats } from '../unitFactory'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function runCast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < 30; i++) tickAbilityCast(caster, state)
}

describe('Stonjourner – Power Spot', () => {
  let stonjourner: Unit
  let ally: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    stonjourner = makeUnit('stonjourner', 'player', 1)
    stonjourner.hexPos = { col: 3, row: 5 }
    ally = makeUnit('graveler', 'player', 1)
    ally.hexPos = { col: 4, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([stonjourner, ally], [enemy])
  })

  it('creates a projectile aimed at Stonjourner on cast', () => {
    runCast(stonjourner, state)
    expect(state.projectiles.size).toBe(1)
    const proj = [...state.projectiles.values()][0]
    expect(proj.targetId).toBe(stonjourner.id)
    expect(proj.abilityId).toBe('stonjourner_power_spot')
  })

  it('does NOT heal on cast — only on projectile arrival', () => {
    stonjourner.currentHp = stonjourner.maxHp - 500
    const hpBefore = stonjourner.currentHp
    runCast(stonjourner, state)
    expect(stonjourner.currentHp).toBe(hpBefore)  // no heal yet
  })

  it('heals Stonjourner when onHit fires (tier 1 = 250)', () => {
    stonjourner.currentHp = stonjourner.maxHp - 500
    const hpBefore = stonjourner.currentHp
    runCast(stonjourner, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(undefined, stonjourner, state)
    expect(stonjourner.currentHp).toBe(hpBefore + 250)
  })

  it('heal scales per tier: 250 / 350 / 450', () => {
    const healAmounts = [250, 350, 450] as const
    for (let tier = 1; tier <= 3; tier++) {
      const s = makeUnit('stonjourner', 'player', tier as 1|2|3)
      s.hexPos = { col: 3, row: 5 }
      const a = makeUnit('graveler', 'player', 1)
      a.hexPos = { col: 4, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 2 }
      const st = createCombatState([s, a], [e])
      s.currentHp = 1
      runCast(s, st)
      const proj = [...st.projectiles.values()][0]
      proj.onHit!(undefined, s, st)
      expect(s.currentHp).toBe(1 + healAmounts[tier - 1])
    }
  })

  it('onHit applies armorBuff and spDefBuff with 5-second duration', () => {
    computeStats(ally)
    const allyDef   = ally._computedStats!.defense
    const allySpDef = ally._computedStats!.spDefense
    runCast(stonjourner, state)
    const proj = [...state.projectiles.values()][0]
    proj.onHit!(undefined, stonjourner, state)

    const defBuff   = stonjourner.statusEffects.find(fx => fx.stackId === 'stonjourner_def')
    const spDefBuff = stonjourner.statusEffects.find(fx => fx.stackId === 'stonjourner_spdef')
    expect(defBuff?.magnitude).toBe(Math.round(allyDef   * 0.33))
    expect(spDefBuff?.magnitude).toBe(Math.round(allySpDef * 0.33))
    expect(defBuff?.durationTicks).toBe(5 * TICK_RATE)
  })

  it('onHit emits stonjourner_rock_hit VFX event', () => {
    runCast(stonjourner, state)
    const proj = [...state.projectiles.values()][0]
    state.events = []
    proj.onHit!(undefined, stonjourner, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as { effectId?: string }).effectId === 'stonjourner_rock_hit')).toBe(true)
  })

  it('does not create a projectile when no ally is present', () => {
    const soloState = createCombatState([stonjourner], [enemy])
    runCast(stonjourner, soloState)
    expect(soloState.projectiles.size).toBe(0)
  })
})
