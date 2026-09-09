import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

// Shiny A-Exeggutor: the egg bounces one EXTRA time (at 25% damage) after
// the first bounce lands, chained off that bounce's landing target. A
// non-shiny caster keeps today's behavior — exactly one unconditional
// bounce. Every test here pairs the shiny case with this non-shiny control.

const CAST_TICKS = 40  // > castTimeTicks (35) so the cast always completes

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) {
    if (caster.state !== 'casting') break
    tickAbilityCast(caster, state)
  }
}

// Two enemies, adjacent hexes, so both the first-bounce candidate set (from
// enemy1, excluding enemy1) and the second-bounce candidate set (from
// enemy2, excluding enemy2) each contain exactly one member — deterministic
// target selection with no need to mock combatRng.
function makeScene(casterIsShiny: boolean): { caster: Unit; enemy1: Unit; enemy2: Unit; state: CombatState } {
  const caster = makeUnit('a_exeggutor', 'player', 1)
  caster.isShiny = casterIsShiny
  caster.hexPos = { col: 3, row: 5 }
  caster.visualPos = { x: 300, y: 500 }

  const enemy1 = makeUnit('dummy', 'enemy', 1)
  enemy1.hexPos = { col: 3, row: 2 }
  enemy1.visualPos = { x: 300, y: 200 }

  const enemy2 = makeUnit('dummy', 'enemy', 1)
  enemy2.hexPos = { col: 4, row: 2 }
  enemy2.visualPos = { x: 400, y: 200 }

  const state = createCombatState([caster], [enemy1, enemy2])
  return { caster, enemy1, enemy2, state }
}

describe('A-Exeggutor — shiny extra egg bounce', () => {

  it('(a) non-shiny control: exactly ONE bounce fires, no second bounce', () => {
    const { caster, enemy1, enemy2, state } = makeScene(false)
    cast(caster, state)
    const primary = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')!
    const casterUnit = state.units.get(caster.id)!
    const t1 = state.units.get(enemy1.id)!
    const t2 = state.units.get(enemy2.id)!

    const projsBefore = state.projectiles.size
    primary.onHit!(casterUnit, t1, state)
    // Exactly one new projectile fires from this hit: the first bounce.
    expect(state.projectiles.size).toBe(projsBefore + 1)
    const bounce1 = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bounce')
    expect(bounce1).toBeDefined()
    expect(bounce1?.targetId).toBe(t2.id)
    // No onHit attached — a non-shiny caster's bounce cannot chain further.
    expect(bounce1?.onHit).toBeUndefined()
  })

  it('(b) shiny: the first bounce lands, then chains exactly one more bounce at 25% damage', () => {
    const { caster, enemy1, enemy2, state } = makeScene(true)
    cast(caster, state)
    const primary = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')!
    const casterUnit = state.units.get(caster.id)!
    const t1 = state.units.get(enemy1.id)!
    const t2 = state.units.get(enemy2.id)!

    primary.onHit!(casterUnit, t1, state)
    const bounce1 = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bounce')!
    expect(bounce1).toBeDefined()
    expect(bounce1.targetId).toBe(t2.id)
    expect(bounce1.damagePayload?.baseAmount).toBe(300)  // tier 1: 600 * 0.5
    expect(bounce1.onHit).toBeDefined()

    // Simulate bounce 1 landing on t2 — should chain a second bounce back onto t1
    // (the only candidate within 2 hexes of t2, excluding t2 itself).
    const projsBefore = state.projectiles.size
    bounce1.onHit!(casterUnit, t2, state)
    expect(state.projectiles.size).toBe(projsBefore + 1)

    const bounces = [...state.projectiles.values()].filter(p => p.abilityId === 'a_exeggutor_egg_bounce')
    // bounce1 is still present in the map (this test drives onHit manually,
    // it does not remove the projectile — that's tickProjectiles' job) plus
    // the new second bounce: two total.
    expect(bounces.length).toBe(2)
    const bounce2 = bounces.find(p => p.id !== bounce1.id)!
    expect(bounce2.targetId).toBe(t1.id)
    expect(bounce2.damagePayload?.baseAmount).toBe(150)  // tier 1: 600 * 0.25
    // The second bounce does not chain a third — no onHit attached.
    expect(bounce2.onHit).toBeUndefined()
  })

  it('(c) shiny with no valid second-bounce target: exactly one bounce, no crash', () => {
    const caster = makeUnit('a_exeggutor', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    caster.visualPos = { x: 300, y: 500 }
    // Only one enemy on the board — after it becomes the primary hit target,
    // no candidate remains for the first bounce (own-id excluded), let alone
    // a chained second bounce.
    const enemy1 = makeUnit('dummy', 'enemy', 1)
    enemy1.hexPos = { col: 3, row: 2 }
    enemy1.visualPos = { x: 300, y: 200 }
    const state = createCombatState([caster], [enemy1])

    cast(caster, state)
    const primary = [...state.projectiles.values()].find(p => p.abilityId === 'a_exeggutor_egg_bomb')!
    const casterUnit = state.units.get(caster.id)!
    const t1 = state.units.get(enemy1.id)!

    expect(() => primary.onHit!(casterUnit, t1, state)).not.toThrow()
    const bounces = [...state.projectiles.values()].filter(p => p.abilityId === 'a_exeggutor_egg_bounce')
    expect(bounces.length).toBe(0)
  })
})
