import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { addStatusEffect } from '../systems/statusEffect'
import { gainManaOnHit } from '../systems/mana'
import { applyDamage } from '../systems/damage'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 24  // SALAMENCE_RUMBLE_TICKS

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Salamence - Outrage', () => {
  let caster: Unit
  let e1: Unit
  let e2: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('salamence', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 4, row: 2 }
    state = createCombatState([caster], [e1, e2])
  })

  it('enters casting state with the 24-tick rumble timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('applies a permanent Enraged status that suppresses mana gain', () => {
    cast(caster, state)
    const enraged = caster.statusEffects.find(fx => fx.id === 'salamence_enraged')
    expect(enraged).toBeDefined()
    expect(enraged!.durationTicks).toBe(-1)
    expect(enraged!.suppressManaGain).toBe(true)
    expect(caster.currentMana).toBe(0)
  })

  it('never gains mana again after casting', () => {
    cast(caster, state)
    for (let i = 0; i < 20; i++) gainManaOnHit(caster)
    expect(caster.currentMana).toBe(0)
  })

  it('gains 150% move speed while Enraged', () => {
    const before = computeStats(caster).moveSpeed
    cast(caster, state)
    // Outrage move-speed multiplier — mirrors unitFactory 'salamence_enraged' case
    expect(computeStats(caster).moveSpeed).toBeCloseTo(before * 2.5)
  })

  it('resumes attacking immediately after the rumble (attackTimer = 0)', () => {
    cast(caster, state)
    expect(caster.attackTimer).toBe(0)
  })

  // ─── 50% damage reduction from everyone but the current target ────────────

  it('takes half damage from enemies he is not attacking', () => {
    cast(caster, state)
    caster.targetId = e1.id
    caster.shields = []  // strip the Rogue isolation shield so HP drops are measurable

    const hpBefore = caster.currentHp
    applyDamage(e1, caster, { baseAmount: 200, damageType: 'magic', canCrit: false }, state)
    const dropFromTarget = hpBefore - caster.currentHp

    const hpBefore2 = caster.currentHp
    applyDamage(e2, caster, { baseAmount: 200, damageType: 'magic', canCrit: false }, state)
    const dropFromOther = hpBefore2 - caster.currentHp

    expect(dropFromTarget).toBeGreaterThan(0)
    expect(dropFromOther).toBeGreaterThan(0)
    expect(dropFromTarget / dropFromOther).toBeCloseTo(2, 1)
  })

  it('takes full damage from everyone before casting', () => {
    caster.targetId = e1.id
    caster.shields = []  // strip the Rogue isolation shield so HP drops are measurable
    const hpBefore = caster.currentHp
    applyDamage(e2, caster, { baseAmount: 200, damageType: 'magic', canCrit: false }, state)
    const drop1 = hpBefore - caster.currentHp

    const hpBefore2 = caster.currentHp
    applyDamage(e1, caster, { baseAmount: 200, damageType: 'magic', canCrit: false }, state)
    const drop2 = hpBefore2 - caster.currentHp
    expect(drop1).toBe(drop2)
  })

  // ─── Attack-reduction immunity ─────────────────────────────────────────────

  it('is immune to atk_reduction while Enraged', () => {
    cast(caster, state)
    const attackBefore = computeStats(caster).attack
    addStatusEffect(caster, {
      id: 'atk_reduction', sourceUnitId: e1.id,
      durationTicks: -1, magnitude: 50, stackId: 'test_atkred',
    })
    expect(computeStats(caster).attack).toBe(attackBefore)
  })

  it('atk_reduction works normally before casting', () => {
    const attackBefore = computeStats(caster).attack
    addStatusEffect(caster, {
      id: 'atk_reduction', sourceUnitId: e1.id,
      durationTicks: -1, magnitude: 50, stackId: 'test_atkred',
    })
    expect(computeStats(caster).attack).toBe(attackBefore - 50)
  })

  it('charm no longer lowers his attack while Enraged (special still drops)', () => {
    cast(caster, state)
    const before = computeStats(caster)
    addStatusEffect(caster, {
      id: 'charm', sourceUnitId: e1.id,
      durationTicks: -1, magnitude: 0.33, stackId: 'test_charm',
    })
    const after = computeStats(caster)
    expect(after.attack).toBe(before.attack)
    expect(after.special).toBeLessThan(before.special)
  })

  // ─── Outrage ramp ──────────────────────────────────────────────────────────

  it('each auto on the same target grants stacking 5% attack and attack speed', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'salamence_outrage_ramp')!
    expect(handler).toBeDefined()

    const baseStats = computeStats(caster)
    handler.onAttack(caster, e1, state)
    handler.onAttack(caster, e1, state)
    handler.onAttack(caster, e1, state)

    const atk = caster.statusEffects.find(fx => fx.stackId === 'salamence_outrage_atk')
    const as  = caster.statusEffects.find(fx => fx.stackId === 'salamence_outrage_as')
    expect(atk?.magnitude).toBeCloseTo(0.15)
    expect(as?.magnitude).toBeCloseTo(0.15)

    const ramped = computeStats(caster)
    expect(ramped.attack).toBeGreaterThan(baseStats.attack)
    expect(ramped.attackSpeed).toBeGreaterThan(baseStats.attackSpeed)
  })

  it('ramp persists across target switches (keeps stacking until death)', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'salamence_outrage_ramp')!

    handler.onAttack(caster, e1, state)
    handler.onAttack(caster, e1, state)
    handler.onAttack(caster, e1, state)
    handler.onAttack(caster, e2, state)  // switch → 4th stack, no reset

    const atk = caster.statusEffects.find(fx => fx.stackId === 'salamence_outrage_atk')
    const as  = caster.statusEffects.find(fx => fx.stackId === 'salamence_outrage_as')
    expect(atk?.magnitude).toBeCloseTo(0.20)
    expect(as?.magnitude).toBeCloseTo(0.20)
  })

  it('does not stack a duplicate ramp handler if cast twice', () => {
    cast(caster, state)
    cast(caster, state)
    const handlers = caster.passiveAttackHandlers.filter(h => h.id === 'salamence_outrage_ramp')
    expect(handlers).toHaveLength(1)
  })
})

describe('Rogue trait — isolation shield', () => {
  it('grants a 500 HP shield when starting combat with no adjacent allies', () => {
    const sal = makeUnit('salamence', 'player', 1)
    sal.hexPos = { col: 3, row: 5 }
    const farAlly = makeUnit('tangela', 'player', 1)
    farAlly.hexPos = { col: 0, row: 7 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }
    const state = createCombatState([sal, farAlly], [enemy])

    const unit = state.units.get(sal.id)!
    const shield = unit.shields.find(s => s.sourceAbility === 'rogue_trait')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(500)
  })

  it('no shield when an ally starts adjacent', () => {
    const sal = makeUnit('salamence', 'player', 1)
    sal.hexPos = { col: 3, row: 5 }
    const ally = makeUnit('tangela', 'player', 1)
    ally.hexPos = { col: 2, row: 5 }  // adjacent to (3,5)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }
    const state = createCombatState([sal, ally], [enemy])

    const unit = state.units.get(sal.id)!
    expect(unit.shields.some(s => s.sourceAbility === 'rogue_trait')).toBe(false)
  })

  it('adjacent ENEMIES do not prevent the shield', () => {
    const sal = makeUnit('salamence', 'player', 1)
    sal.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // adjacent, but an enemy
    const state = createCombatState([sal], [enemy])

    const unit = state.units.get(sal.id)!
    expect(unit.shields.some(s => s.sourceAbility === 'rogue_trait')).toBe(true)
  })

  it('non-rogue units never get the shield', () => {
    const lone = makeUnit('tangela', 'player', 1)
    lone.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 0 }
    const state = createCombatState([lone], [enemy])

    const unit = state.units.get(lone.id)!
    expect(unit.shields.some(s => s.sourceAbility === 'rogue_trait')).toBe(false)
  })
})
