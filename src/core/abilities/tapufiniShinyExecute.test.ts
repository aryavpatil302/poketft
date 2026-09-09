import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { tickStatusEffects } from '../systems/statusEffect'
import { TapuFiniAbility } from './tapufini'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered (required by createCombatState)
import '../systems/ability'

// Shiny Tapu Fini: each Whirlpool pulse executes the target (guaranteed-lethal
// true damage, Tapu Bulu's own execute shape) if the target's HP is at or
// below 10% of max HP AFTER that pulse's own damage lands. A non-shiny Tapu
// Fini never executes — every test here pairs the shiny case with this
// non-shiny control. Boundary is required: exactly at 10% executes, just
// above 10% does not.
//
// Determinism: target.defense/spDefense are forced to 0 so Whirlpool's tier-1
// pulse deals exactly round(100 * 1.33) = 133 base magic damage every tick
// (the "both durability stats at 0" bonus in tapufini.ts), with 0%
// mitigation since mitigationFactor(0) === 0 — this lets tests pick an exact
// pre-tick HP to land the post-pulse HP precisely on or off the 10%
// boundary. The payload also carries abilityScalingStat: 'special', which
// multiplies by (caster's special / 100) — a SHINY fini's own special is
// itself boosted by the universal +5% shiny bonus (100 → 105), so a shiny
// fini's pulse lands at round(133 * 105/100) = 140, while a non-shiny fini's
// pulse lands at round(133 * 100/100) = 133. Each scene below uses the
// pulse damage that matches its own fini's shininess.
const SHINY_PULSE_DAMAGE    = 140
const NONSHINY_PULSE_DAMAGE = 133

function makeScene(finiIsShiny: boolean, targetMaxHp: number): { fini: Unit; target: Unit; state: CombatState } {
  const fini = makeUnit('tapu_fini', 'player', 1)
  fini.isShiny = finiIsShiny
  fini.hexPos = { col: 3, row: 5 }
  fini.visualPos = { x: 300, y: 500 }

  const target = makeUnit('dummy', 'enemy', 1)
  target.hexPos = { col: 3, row: 2 }
  target.visualPos = { x: 300, y: 200 }

  const state = createCombatState([fini], [target])
  const finiUnit = state.units.get(fini.id)!
  const targetUnit = state.units.get(target.id)!
  targetUnit.defense = 0
  targetUnit.spDefense = 0
  targetUnit.maxHp = targetMaxHp
  targetUnit._computedStats = null

  return { fini: finiUnit, target: targetUnit, state }
}

describe('Tapu Fini — shiny Whirlpool execute', () => {

  it('(a) shiny: target lands exactly AT 10% HP after the pulse — executed', () => {
    const MAX_HP = 10000
    const THRESHOLD = MAX_HP * 0.10   // 1000
    const { fini, target, state } = makeScene(true, MAX_HP)
    target.currentHp = THRESHOLD + SHINY_PULSE_DAMAGE   // 1140 → post-pulse: 1000 (exactly 10%)

    TapuFiniAbility.onCast(fini, state, 1)
    tickStatusEffects(state.units, state)

    expect(target.state).toBe('dead')
    expect(target.currentHp).toBe(0)
    expect(state.events.some(e => e.type === 'death' && e.unitId === target.id)).toBe(true)
  })

  it('(b) shiny: target lands just ABOVE 10% HP after the pulse — not executed', () => {
    const MAX_HP = 10000
    const THRESHOLD = MAX_HP * 0.10   // 1000
    const { fini, target, state } = makeScene(true, MAX_HP)
    target.currentHp = THRESHOLD + SHINY_PULSE_DAMAGE + 1   // 1141 → post-pulse: 1001 (just above 10%)

    TapuFiniAbility.onCast(fini, state, 1)
    tickStatusEffects(state.units, state)

    expect(target.state).not.toBe('dead')
    expect(target.currentHp).toBe(THRESHOLD + 1)
  })

  it('(c) non-shiny control: target lands exactly AT 10% HP after the pulse — NOT executed', () => {
    const MAX_HP = 10000
    const THRESHOLD = MAX_HP * 0.10
    const { fini, target, state } = makeScene(false, MAX_HP)
    target.currentHp = THRESHOLD + NONSHINY_PULSE_DAMAGE   // same exact-boundary shape as (a), fini not shiny

    TapuFiniAbility.onCast(fini, state, 1)
    tickStatusEffects(state.units, state)

    expect(target.state).not.toBe('dead')
    expect(target.currentHp).toBe(THRESHOLD)
  })

  it('(d) shiny: target dies from the pulse itself — no duplicate execute hit or death event', () => {
    const MAX_HP = 200
    const { fini, target, state } = makeScene(true, MAX_HP)
    target.currentHp = 100   // less than SHINY_PULSE_DAMAGE (140) — the periodic hit alone kills it

    TapuFiniAbility.onCast(fini, state, 1)
    tickStatusEffects(state.units, state)

    expect(target.state).toBe('dead')
    const deathEvents = state.events.filter(e => e.type === 'death' && e.unitId === target.id)
    expect(deathEvents.length).toBe(1)   // not doubled by a redundant execute hit
    const trueDamageEvents = state.events.filter(
      e => e.type === 'damage' && (e as any).damageType === 'true' && (e as any).targetId === target.id
    )
    expect(trueDamageEvents.length).toBe(0)   // the guaranteed-lethal execute hit never fired
  })
})
