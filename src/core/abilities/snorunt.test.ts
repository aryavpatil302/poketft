import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { applyDamage } from '../systems/damage'
import { tickStatusEffects } from '../systems/statusEffect'
import { tickAttack, startAttacking } from '../systems/attack'
import { initTraitEffects } from '../systems/traitEffects'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Snorunt - Ice Body', () => {
  let caster: Unit
  let attacker: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('snorunt', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    attacker = makeUnit('dummy', 'enemy', 1)
    attacker.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster], [attacker])
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

  it('emits a shield event after cast', () => {
    cast(caster, state)
    expect(state.events.some(e => e.type === 'shield')).toBe(true)
  })

  it('applies a shield to caster after cast (tier 1 = 150)', () => {
    cast(caster, state)
    expect(caster.shields).toHaveLength(1)
    expect(caster.shields[0].value).toBe(150)
    expect(caster.shields[0].sourceAbility).toBe('snorunt_ice_body')
  })

  it('shield duration is 3 * TICK_RATE', () => {
    cast(caster, state)
    expect(caster.shields[0].durationTicks).toBe(3 * TICK_RATE)
  })

  it('tier 2 shield value is 200', () => {
    const t2 = makeUnit('snorunt', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 4 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)
    expect(t2.shields[0].value).toBe(200)
  })

  it('tier 3 shield value is 300', () => {
    const t3 = makeUnit('snorunt', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 4 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    expect(t3.shields[0].value).toBe(300)
  })

  it('attacker hitting active Ice Body shield is chilled', () => {
    cast(caster, state)
    expect(caster.shields.some(s => s.sourceAbility === 'snorunt_ice_body')).toBe(true)

    // attacker hits Snorunt while shield is up
    applyDamage(attacker, caster, {
      baseAmount: 50,
      damageType: 'physical',
      canCrit: false,
      abilityId: 'auto_attack',
    }, state)

    const chill = attacker.statusEffects.find(fx => fx.id === 'chill')
    expect(chill).toBeDefined()
    expect(chill!.magnitude).toBe(0.30)
  })

  it('attacker NOT chilled when shield is already depleted', () => {
    cast(caster, state)
    // Deplete the shield first with a large hit
    applyDamage(attacker, caster, {
      baseAmount: 9999,
      damageType: 'true',
      canCrit: false,
      abilityId: 'auto_attack',
    }, state)

    // Verify shield is gone, attacker was chilled on the hit that broke it
    // Now hit again — this second hit should NOT re-chill (shield is gone)
    attacker.statusEffects = attacker.statusEffects.filter(fx => fx.id !== 'chill')
    applyDamage(attacker, caster, {
      baseAmount: 50,
      damageType: 'physical',
      canCrit: false,
      abilityId: 'auto_attack',
    }, state)

    const chill = attacker.statusEffects.find(fx => fx.id === 'chill')
    expect(chill).toBeUndefined()
  })

  it('shield has no onExpire callback', () => {
    cast(caster, state)
    expect(caster.shields[0].onExpire).toBeUndefined()
  })
})

describe('Snorunt - Froststone mark interaction while shielded', () => {
  // Froststone activates at 2+ species — Snorunt alone isn't enough. Ice Body
  // is a pure self-shield (deals no damage), so Snorunt never reaches the
  // ability-damage "spell hit" consume gate in damage.ts the way every other
  // Froststone unit's damaging ability does. Without the isSnoruntShielded
  // carve-out, his marks build to 5 via autos and then sit capped forever.
  let caster: Unit
  let ally: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('snorunt', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    ally = makeUnit('weavile', 'player', 1)   // a second froststone species
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

  it('autos build marks one at a time regardless of shield state', () => {
    const stacks = driveAutos(4)
    expect(stacks).toEqual([1, 2, 3, 4])
  })

  it('an auto consumes an already-5-stacked mark while the Ice Body shield is active', () => {
    cast(caster, state)
    expect(caster.shields.some(s => s.sourceAbility === 'snorunt_ice_body' && s.value > 0)).toBe(true)
    enemy.statusEffects.push({ id: 'froststone_mark', sourceUnitId: ally.id, durationTicks: -1, magnitude: 5, stackId: 'froststone_mark' })
    const [afterFirstAuto] = driveAutos(1)
    expect(afterFirstAuto).toBe(0)
  })

  it('an auto cannot consume an already-5-stacked mark when the shield is NOT active', () => {
    // No cast() — Snorunt never gained the Ice Body shield.
    enemy.statusEffects.push({ id: 'froststone_mark', sourceUnitId: ally.id, durationTicks: -1, magnitude: 5, stackId: 'froststone_mark' })
    const [afterFirstAuto] = driveAutos(1)
    expect(afterFirstAuto).toBe(5)
  })

  it('once the shield breaks, autos stop being able to consume', () => {
    cast(caster, state)
    // Deplete the shield with a large hit before driving autos.
    applyDamage(enemy, caster, { baseAmount: 9999, damageType: 'true', canCrit: false, abilityId: 'auto_attack' }, state)
    expect(caster.shields.some(s => s.sourceAbility === 'snorunt_ice_body' && s.value > 0)).toBe(false)

    enemy.statusEffects.push({ id: 'froststone_mark', sourceUnitId: ally.id, durationTicks: -1, magnitude: 5, stackId: 'froststone_mark' })
    const [afterFirstAuto] = driveAutos(1)
    expect(afterFirstAuto).toBe(5)
  })
})
