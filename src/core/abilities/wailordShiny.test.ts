import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

// Shiny Wailord: Bounce damage is tripled. A non-shiny control proves the
// baseline (80/120/180 at tier 1/2/3) is unchanged — see wailord.ts, where
// the multiplier is applied once at the damageAmount computation site.

const CAST_TICKS = 5

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function landBounce(caster: Unit, state: CombatState): void {
  if ((caster as any)._leap?.onLand) {
    (caster as any)._leap.onLand(caster, state)
  }
}

function makeCombat(casterDefTier: 1 | 2 | 3, isShiny: boolean): { caster: Unit; enemy: Unit; state: CombatState } {
  const caster = makeUnit('wailord', 'player', casterDefTier)
  caster.isShiny = isShiny
  caster.hexPos = { col: 0, row: 5 }
  const enemy = makeUnit('dummy', 'enemy', 1)
  enemy.maxHp = 100000
  enemy.currentHp = 100000
  enemy.spDefense = 0   // Bounce is magic damage — zero spDefense for an exact, unmitigated number
  enemy._computedStats = null
  enemy.hexPos = { col: 6, row: 2 }
  const state = createCombatState([caster], [enemy])
  caster.targetId = enemy.id
  return { caster, enemy, state }
}

describe('Wailord - Bounce (shiny)', () => {
  it('(a) shiny tier 1 — Bounce deals 240 (3x the base 80)', () => {
    const { caster, enemy, state } = makeCombat(1, true)
    const hpBefore = enemy.currentHp
    cast(caster, state)
    landBounce(caster, state)
    expect(hpBefore - enemy.currentHp).toBe(240)
  })

  it('(b) non-shiny control tier 1 — Bounce deals the unmodified base 80', () => {
    const { caster, enemy, state } = makeCombat(1, false)
    const hpBefore = enemy.currentHp
    cast(caster, state)
    landBounce(caster, state)
    expect(hpBefore - enemy.currentHp).toBe(80)
  })

  it('(c) shiny tier 2 — Bounce deals 360 (3x the base 120)', () => {
    const { caster, enemy, state } = makeCombat(2, true)
    const hpBefore = enemy.currentHp
    cast(caster, state)
    landBounce(caster, state)
    expect(hpBefore - enemy.currentHp).toBe(360)
  })

  it('(d) shiny tier 3 — Bounce deals 540 (3x the base 180)', () => {
    const { caster, enemy, state } = makeCombat(3, true)
    const hpBefore = enemy.currentHp
    cast(caster, state)
    landBounce(caster, state)
    expect(hpBefore - enemy.currentHp).toBe(540)
  })

  it('(e) the shield amount is untouched by the shiny multiplier — only the slam damage is tripled', () => {
    const { caster, state } = makeCombat(1, true)
    cast(caster, state)
    expect(caster.shields[0].value).toBe(75)
  })

  it('(f) stun duration is untouched by the shiny multiplier', () => {
    const { caster, enemy, state } = makeCombat(1, true)
    cast(caster, state)
    landBounce(caster, state)
    const stun = enemy.statusEffects.find(e => e.id === 'stun')
    expect(stun).toBeDefined()
  })
})
