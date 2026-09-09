import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../../systems/ability'
import type { Unit, CombatState } from '../../types'
import '../../systems/ability'

// Shiny Vikavolt is Category B: the +33% bonus damage to the highest-HP unit
// in the targeted row lives inside src/core/abilities/vikavolt.ts's onCast,
// not in this directory's vikavolt.ts (which only registers a description).
//
// NOTE: every shiny-effect test file in this batch includes one explicit
// non-shiny control case proving the effect does NOT fire without isShiny.

// Tier-1 base damage for Discharge — must match damageValues[0] in
// src/core/abilities/vikavolt.ts's onCast. Not imported directly since that
// array is a local const inside onCast, not exported; keep this in sync if
// Discharge's own balance tuning changes.
const TIER1_BASE = 250

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Zero mitigation on targets so the emitted 'damage' event amount equals the
// exact baseAmount passed to applyDamage.
function noMitigate(u: Unit): void {
  u.defense = 0
  u.spDefense = 0
  u.maxHp = 1e6
  u.currentHp = 1e6
  u._computedStats = null   // makeUnit() pre-caches _computedStats; must invalidate after mutating base fields
}

function setup(isShiny: boolean) {
  const caster = makeUnit('vikavolt', 'player', 1)
  caster.hexPos = { col: 3, row: 5 }
  caster.isShiny = isShiny
  // Two enemies in the same row (most populated → targeted row); differing HP.
  const lowHp  = makeUnit('dummy', 'enemy', 1); lowHp.hexPos  = { col: 2, row: 2 }; noMitigate(lowHp)
  const highHp = makeUnit('dummy', 'enemy', 1); highHp.hexPos = { col: 4, row: 2 }; noMitigate(highHp)
  const state = createCombatState([caster], [lowHp, highHp])
  // Normalize special to 100 AFTER combat start (post universal shiny +5%
  // bump, if any) so damage.ts's abilityScalingStat multiplier (base *
  // special / 100) is a no-op and the emitted event equals the raw baseAmount.
  caster.special = 100
  caster._computedStats = null
  // Set distinct currentHp AFTER combat start (createCombatState doesn't reset it further for non-shiny targets).
  lowHp.currentHp  = 100
  highHp.currentHp = 900
  return { caster, lowHp, highHp, state }
}

describe('Shiny Vikavolt - Discharge +33% bonus to highest-HP unit in row', () => {
  it('gives the highest-current-HP enemy in the row +33% bonus damage when shiny', () => {
    const { caster, lowHp, highHp, state } = setup(true)
    cast(caster, state)

    const lowDmg  = state.events.find(e => e.type === 'damage' && e.targetId === lowHp.id)
    const highDmg = state.events.find(e => e.type === 'damage' && e.targetId === highHp.id)
    expect(lowDmg?.type === 'damage' ? lowDmg.amount : undefined).toBe(TIER1_BASE)   // tier 1 base, no bonus
    expect(highDmg?.type === 'damage' ? highDmg.amount : undefined).toBe(TIER1_BASE + Math.round(TIER1_BASE * 0.33))
  })

  it('does NOT give any bonus damage when the caster is not shiny (control)', () => {
    const { caster, lowHp, highHp, state } = setup(false)
    cast(caster, state)

    const lowDmg  = state.events.find(e => e.type === 'damage' && e.targetId === lowHp.id)
    const highDmg = state.events.find(e => e.type === 'damage' && e.targetId === highHp.id)
    expect(lowDmg?.type === 'damage' ? lowDmg.amount : undefined).toBe(TIER1_BASE)
    expect(highDmg?.type === 'damage' ? highDmg.amount : undefined).toBe(TIER1_BASE)
  })

  it('edge case: a single enemy in the row is both lowest and highest — still gets the bonus when shiny', () => {
    const caster = makeUnit('vikavolt', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    caster.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    noMitigate(enemy)
    const state = createCombatState([caster], [enemy])
    caster.special = 100
    caster._computedStats = null
    enemy.currentHp = 500

    cast(caster, state)

    const dmg = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmg?.type === 'damage' ? dmg.amount : undefined).toBe(TIER1_BASE + Math.round(TIER1_BASE * 0.33))
  })
})
