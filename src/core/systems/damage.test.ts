import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { applyDamage } from './damage'
import type { Unit, CombatState } from '../types'

// Crit rule: ONLY base auto-attack damage may critically strike. Spells never
// crit, and neither does the extra spell damage bolted onto an empowered auto.
function setup(): { src: Unit; tgt: Unit; state: CombatState } {
  const src = makeUnit('tangela', 'player', 1); src.hexPos = { col: 3, row: 5 }
  const tgt = makeUnit('dummy', 'enemy', 1);    tgt.hexPos = { col: 3, row: 4 }
  const state = createCombatState([src], [tgt])
  tgt.maxHp = 100000; tgt.currentHp = 100000
  // Guarantee a crit whenever crit is even allowed: 100% chance, 2× damage.
  src.critChance = 1; src.critDamage = 2; src._computedStats = null
  return { src, tgt, state }
}

describe('crit is limited to base auto-attack damage', () => {
  it('spell damage never crits, even at 100% crit chance', () => {
    const { src, tgt, state } = setup()
    const r = applyDamage(src, tgt, {
      baseAmount: 100, damageType: 'true', canCrit: true, abilityId: 'some_spell',
    }, state)
    expect(r.isCrit).toBe(false)
    expect(r.finalDamage).toBe(100)
  })

  it('forceCrit on a spell is ignored', () => {
    const { src, tgt, state } = setup()
    const r = applyDamage(src, tgt, {
      baseAmount: 100, damageType: 'true', canCrit: false, forceCrit: true, abilityId: 'some_spell',
    }, state)
    expect(r.isCrit).toBe(false)
    expect(r.finalDamage).toBe(100)
  })

  it('untagged damage (no ability id, no auto marker) never crits', () => {
    const { src, tgt, state } = setup()
    const r = applyDamage(src, tgt, {
      baseAmount: 100, damageType: 'true', canCrit: true,
    }, state)
    expect(r.isCrit).toBe(false)
    expect(r.finalDamage).toBe(100)
  })

  it('base auto-attack damage crits', () => {
    const { src, tgt, state } = setup()
    const critDmg = computeStats(src).critDamage
    const r = applyDamage(src, tgt, {
      baseAmount: 100, damageType: 'true', canCrit: true, abilityId: 'auto_attack',
    }, state)
    expect(r.isCrit).toBe(true)
    expect(r.finalDamage).toBe(Math.round(100 * critDmg))
  })

  it('an auto-attack replacement (isAutoAttack) crits — e.g. Drednaw / Corkscrew', () => {
    const { src, tgt, state } = setup()
    const critDmg = computeStats(src).critDamage
    const r = applyDamage(src, tgt, {
      baseAmount: 100, damageType: 'true', canCrit: true, isAutoAttack: true, abilityId: 'drednaw_razor_shell',
    }, state)
    expect(r.isCrit).toBe(true)
    expect(r.finalDamage).toBe(Math.round(100 * critDmg))
  })
})
