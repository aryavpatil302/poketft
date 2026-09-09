import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../ability'
import type { Unit, CombatState } from '../../types'

// Shiny Sableye: each cast has an independent 30% chance to grant the
// caster's team 1 gold, rolled via combatRng() (which reads Math.random()
// fresh each call, per rng.ts) in abilities/sableye.ts's onCast. RNG is
// mocked directly on Math.random in a try/finally, per the established
// convention (itemPassives.test.ts), never via setCombatRng. Every
// shiny-effect test in this batch pairs its shiny case with a non-shiny
// control to prove the baseline is unchanged.

// Ensure all abilities are registered (required by createCombatState)
import '../ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function makeScenario(shiny: boolean): { caster: Unit; state: CombatState } {
  const caster = makeUnit('sableye', 'player', 1)
  caster.hexPos = { col: 3, row: 5 }
  caster.isShiny = shiny
  const ally = makeUnit('tangela', 'player', 1)
  ally.hexPos = { col: 4, row: 5 }
  ally.currentHp = 1   // low HP so Sableye's shield-cast branch has a valid target
  const enemy = makeUnit('dummy', 'enemy', 1)
  enemy.hexPos = { col: 3, row: 2 }
  const state = createCombatState([caster, ally], [enemy])
  return { caster: state.units.get(caster.id)!, state }
}

describe('Sableye shiny — gold on cast', () => {

  it('(a) guaranteed proc (mocked roll = 0) grants exactly 1 gold to the caster\'s team', () => {
    const { caster, state } = makeScenario(true)
    const orig = Math.random
    Math.random = () => 0   // 0 < 0.30 → proc
    try {
      cast(caster, state)
    } finally { Math.random = orig }
    expect(state.shinyGoldEarned.get('player')).toBe(1)
  })

  it('(b) guaranteed no-proc (mocked roll = 0.99) grants no gold', () => {
    const { caster, state } = makeScenario(true)
    const orig = Math.random
    Math.random = () => 0.99   // 0.99 >= 0.30 → no proc
    try {
      cast(caster, state)
    } finally { Math.random = orig }
    expect(state.shinyGoldEarned.get('player')).toBeUndefined()
  })

  it('(c) non-shiny control — never rolls, no gold granted even with a guaranteed-proc mock', () => {
    const { caster, state } = makeScenario(false)
    const orig = Math.random
    Math.random = () => 0   // would guarantee a proc if a shiny roll happened
    try {
      cast(caster, state)
    } finally { Math.random = orig }
    expect(state.shinyGoldEarned.get('player')).toBeUndefined()
  })

  it('(d) repeated casts accumulate gold — two guaranteed-proc casts grant 2 total', () => {
    const { caster, state } = makeScenario(true)
    const orig = Math.random
    Math.random = () => 0
    try {
      cast(caster, state)
      caster.currentMana = 0
      cast(caster, state)
    } finally { Math.random = orig }
    expect(state.shinyGoldEarned.get('player')).toBe(2)
  })

  it('(e) gold is granted to the caster\'s own team only — enemy team counter stays unset', () => {
    const { caster, state } = makeScenario(true)
    const orig = Math.random
    Math.random = () => 0
    try {
      cast(caster, state)
    } finally { Math.random = orig }
    expect(state.shinyGoldEarned.get('enemy')).toBeUndefined()
  })
})
