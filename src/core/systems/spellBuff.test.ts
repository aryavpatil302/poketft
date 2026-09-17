import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { getSpellBuff, incrementSpellBuff } from './spellBuff'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered (required by createCombatState → initAbilityPassives)
import '../systems/ability'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  return createCombatState(players, enemies)
}

// ─── Baseline: plain species counting (no shiny involved) ────────────────────

describe('Beachy vibes (spellBuff) — plain species counting', () => {
  it('below threshold (1 real Beachy species): a cast grants no stacks', () => {
    const kingler = makeUnit('kingler', 'player', 1)   // beachy
    const ally    = makeUnit('tangela', 'player', 1)   // not beachy
    const enemy   = makeUnit('dummy', 'enemy', 1)
    const state = makeState([kingler, ally], [enemy])

    incrementSpellBuff(state.units.get(kingler.id)!, state)
    expect(getSpellBuff(state.units.get(kingler.id)!, state)).toBe(0)
  })

  it('at threshold (2 real Beachy species): a cast grants +1 to every living Beachy ally', () => {
    const kingler   = makeUnit('kingler', 'player', 1)    // beachy
    const araichu   = makeUnit('a_raichu', 'player', 1)   // beachy
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state = makeState([kingler, araichu], [enemy])

    incrementSpellBuff(state.units.get(kingler.id)!, state)
    expect(getSpellBuff(state.units.get(kingler.id)!, state)).toBe(1)
    expect(getSpellBuff(state.units.get(araichu.id)!, state)).toBe(1)
  })

  it('a species dying mid-combat drops the live count below threshold — later casts stop granting stacks', () => {
    const kingler = makeUnit('kingler', 'player', 1)
    const araichu = makeUnit('a_raichu', 'player', 1)
    const enemy   = makeUnit('dummy', 'enemy', 1)
    const state = makeState([kingler, araichu], [enemy])

    const kinglerUnit = state.units.get(kingler.id)!
    const araichuUnit = state.units.get(araichu.id)!

    incrementSpellBuff(kinglerUnit, state)
    expect(getSpellBuff(kinglerUnit, state)).toBe(1)

    araichuUnit.state = 'dead'   // only 1 living Beachy species left
    incrementSpellBuff(kinglerUnit, state)
    expect(getSpellBuff(kinglerUnit, state)).toBe(1)   // unchanged — threshold no longer met
  })
})

// ─── Regression: shiny Chosen-trait bonus must count here too ────────────────
// Bug: activeBeachyIncrement (spellBuff.ts) re-implements its own species
// count instead of reusing traitEffects.ts's traitMemberCount (it has to,
// since it needs a LIVE recount that respects mid-fight deaths), and in
// doing so it dropped traitMemberCount's shiny Chosen-trait +1 bonus — so a
// team relying on a shiny unit's chosenTrait to cross the Beachy threshold
// showed "Beachy: active" in the sidebar (and got the real HP bonus, which
// DOES go through traitMemberCount) while cast stacks silently never accrued.

describe('Beachy vibes (spellBuff) — shiny Chosen-trait bonus', () => {
  it('a shiny unit whose chosenTrait is "beachy" crosses the threshold on its own, even with only 1 real Beachy species', () => {
    const kingler = makeUnit('kingler', 'player', 1)      // 1 real beachy species
    const shinyAlly = makeUnit('tangela', 'player', 1)    // NOT beachy-typed
    shinyAlly.isShiny = true
    shinyAlly.chosenTrait = 'beachy'                      // +1 toward beachy, chosen at shop time
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([kingler, shinyAlly], [enemy])

    // Real species = {kingler} = 1, below the 2-species threshold on its own —
    // the shiny unit's chosen-trait +1 is what crosses it.
    incrementSpellBuff(state.units.get(kingler.id)!, state)
    expect(getSpellBuff(state.units.get(kingler.id)!, state)).toBe(1)
  })

  it('the shiny Beachy unit itself choosing "beachy" also counts as 2 (its own species membership + the chosen bonus)', () => {
    const shinyKingler = makeUnit('kingler', 'player', 1)
    shinyKingler.isShiny = true
    shinyKingler.chosenTrait = 'beachy'   // chosen its own primary trait for extra credit
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([shinyKingler], [enemy])

    // 1 real species + 1 chosen bonus = 2, crossing the threshold alone.
    incrementSpellBuff(state.units.get(shinyKingler.id)!, state)
    expect(getSpellBuff(state.units.get(shinyKingler.id)!, state)).toBe(1)
  })

  it('a shiny unit whose chosenTrait is something OTHER than "beachy" grants no bonus toward beachy', () => {
    const kingler = makeUnit('kingler', 'player', 1)
    const shinyAlly = makeUnit('tangela', 'player', 1)
    shinyAlly.isShiny = true
    shinyAlly.chosenTrait = 'stalwart'   // a real trait of tangela's, but not beachy
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([kingler, shinyAlly], [enemy])

    incrementSpellBuff(state.units.get(kingler.id)!, state)
    expect(getSpellBuff(state.units.get(kingler.id)!, state)).toBe(0)
  })

  it('a shiny Chosen-Beachy unit that has since died no longer contributes its bonus', () => {
    const kingler = makeUnit('kingler', 'player', 1)
    const shinyAlly = makeUnit('tangela', 'player', 1)
    shinyAlly.isShiny = true
    shinyAlly.chosenTrait = 'beachy'
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([kingler, shinyAlly], [enemy])

    const kinglerUnit = state.units.get(kingler.id)!
    const shinyUnit = state.units.get(shinyAlly.id)!

    incrementSpellBuff(kinglerUnit, state)
    expect(getSpellBuff(kinglerUnit, state)).toBe(1)   // chosen bonus crossed the threshold

    shinyUnit.state = 'dead'
    incrementSpellBuff(kinglerUnit, state)
    expect(getSpellBuff(kinglerUnit, state)).toBe(1)   // unchanged — dead unit's chosen bonus no longer counts
  })

  it('the higher thresholds (4/6 species) also honor the chosen-trait bonus, scaling the increment to +2/+3', () => {
    const kingler  = makeUnit('kingler', 'player', 1)
    const araichu  = makeUnit('a_raichu', 'player', 1)
    const palossand = makeUnit('palossand', 'player', 1)
    const shinyAlly = makeUnit('tangela', 'player', 1)
    shinyAlly.isShiny = true
    shinyAlly.chosenTrait = 'beachy'
    const enemy = makeUnit('dummy', 'enemy', 1)
    // Real species = {kingler, a_raichu, palossand} = 3, chosen bonus = +1 → 4, hits the +2 tier.
    const state = makeState([kingler, araichu, palossand, shinyAlly], [enemy])

    incrementSpellBuff(state.units.get(kingler.id)!, state)
    expect(getSpellBuff(state.units.get(kingler.id)!, state)).toBe(2)
    expect(getSpellBuff(state.units.get(araichu.id)!, state)).toBe(2)
    expect(getSpellBuff(state.units.get(palossand.id)!, state)).toBe(2)
  })
})
