import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { applyDamage } from './damage'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered (required by createCombatState)
import '../systems/ability'

// Shiny Ferrothorn: Iron Barbs retaliation heals the Ferrothorn for 100% of the
// counter-hit damage that actually landed on the attacker. A non-shiny
// Ferrothorn keeps today's behavior (no self-heal) — every shiny-effect test
// in this batch pairs its shiny case with a non-shiny control to prove the
// baseline is unchanged.

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

// Attach an active Iron Barbs retaliation marker directly (bypassing the cast
// flow, same shape damage.ts reads: `magnitude` is the retaliation base damage).
function grantIronBarbs(unit: Unit, magnitude: number): void {
  unit.statusEffects.push({
    id: 'iron_barbs',
    sourceUnitId: unit.id,
    durationTicks: 4 * 30,
    magnitude,
    stackId: 'iron_barbs',
  })
}

// The attacker's own auto-attack deals baseAmount: 0 damage to Ferrothorn — this
// isolates the retaliation counter-hit (and its heal) from the incoming primary
// hit, so Ferrothorn's HP delta is attributable to exactly one thing per test.
function autoAttackHit(source: Unit, target: Unit, state: CombatState): void {
  applyDamage(source, target, {
    baseAmount: 0,
    damageType: 'physical',
    canCrit: false,
    abilityId: 'auto_attack',
  }, state)
}

describe('damage.ts — shiny Ferrothorn Iron Barbs retaliation self-heal', () => {

  it('(a) shiny Ferrothorn heals for exactly the counter-hit finalDamage', () => {
    const ferro = makeUnit('ferrothorn', 'player', 1)
    ferro.isShiny = true
    const attacker = makeUnit('dummy', 'enemy', 1)
    const state = makeState([ferro], [attacker])

    const ferroUnit = state.units.get(ferro.id)!
    const attackerUnit = state.units.get(attacker.id)!
    grantIronBarbs(ferroUnit, 75)

    // Leave plenty of headroom so the heal has room to land in full.
    ferroUnit.currentHp = Math.round(ferroUnit.maxHp / 2)
    const ferroHpBefore = ferroUnit.currentHp
    const attackerHpBefore = attackerUnit.currentHp

    autoAttackHit(attackerUnit, ferroUnit, state)

    const retaliationDamage = attackerHpBefore - attackerUnit.currentHp
    expect(retaliationDamage).toBeGreaterThan(0)
    // Primary hit dealt 0, so the entire HP delta on Ferrothorn is the heal.
    expect(ferroUnit.currentHp - ferroHpBefore).toBe(retaliationDamage)
  })

  it('(b) non-shiny control — Ferrothorn takes the same retaliation, no self-heal', () => {
    const ferro = makeUnit('ferrothorn', 'player', 1)
    const attacker = makeUnit('dummy', 'enemy', 1)
    const state = makeState([ferro], [attacker])

    const ferroUnit = state.units.get(ferro.id)!
    const attackerUnit = state.units.get(attacker.id)!
    grantIronBarbs(ferroUnit, 75)

    const ferroHpBefore = ferroUnit.currentHp
    const attackerHpBefore = attackerUnit.currentHp

    autoAttackHit(attackerUnit, ferroUnit, state)

    const retaliationDamage = attackerHpBefore - attackerUnit.currentHp
    expect(retaliationDamage).toBeGreaterThan(0)
    // No heal fired — Ferrothorn's HP is unchanged (primary hit dealt 0).
    expect(ferroUnit.currentHp).toBe(ferroHpBefore)
  })

  it('(c) overheal is clamped to maxHp, not applied past it', () => {
    const ferro = makeUnit('ferrothorn', 'player', 1)
    ferro.isShiny = true
    const attacker = makeUnit('dummy', 'enemy', 1)
    const state = makeState([ferro], [attacker])

    const ferroUnit = state.units.get(ferro.id)!
    const attackerUnit = state.units.get(attacker.id)!
    grantIronBarbs(ferroUnit, 75)

    // Leave only 1 HP of headroom — far less than the retaliation's finalDamage,
    // so the heal would overshoot maxHp if not clamped.
    ferroUnit.currentHp = ferroUnit.maxHp - 1

    autoAttackHit(attackerUnit, ferroUnit, state)

    expect(attackerUnit.currentHp).toBeLessThan(attackerUnit.maxHp)
    expect(ferroUnit.currentHp).toBe(ferroUnit.maxHp)
  })
})
