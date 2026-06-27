import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks: number): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Blastoise - Hydro Cannons', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('blastoise', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 20-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('adds a passive attack handler after cast', () => {
    cast(caster, state, 20)
    expect(caster.passiveAttackHandlers).toHaveLength(1)
    expect(caster.passiveAttackHandlers[0].id).toBe('blastoise_hydro')
  })

  it('adds blastoise_mode status effect lasting 5 seconds', () => {
    cast(caster, state, 20)
    const mode = caster.statusEffects.find(e => e.id === 'blastoise_mode')
    expect(mode).toBeDefined()
    expect(mode!.durationTicks).toBe(5 * TICK_RATE)
    expect(mode!.stackId).toBe('blastoise_mode')
  })

  it('handler fires a projectile for ranged Blastoise (range=2)', () => {
    cast(caster, state, 20)
    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)
    // Blastoise range is 2, so a projectile should have been added
    expect(state.projectiles.size).toBe(1)
    const proj = [...state.projectiles.values()][0]
    expect(proj.abilityId).toBe('blastoise_hydro_cannons')
  })

  it('handler removes itself when blastoise_mode status is absent', () => {
    cast(caster, state, 20)
    caster.statusEffects = caster.statusEffects.filter(e => e.id !== 'blastoise_mode')

    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)

    expect(caster.passiveAttackHandlers).toHaveLength(0)
  })

  it('handler is removed when mode expires via onExpire callback', () => {
    cast(caster, state, 20)
    const mode = caster.statusEffects.find(e => e.id === 'blastoise_mode')!
    if (mode.onExpire) mode.onExpire(caster, state)
    expect(caster.passiveAttackHandlers).toHaveLength(0)
  })

  it('incrementSpellBuff increments counter for beachy Blastoise', () => {
    cast(caster, state, 20)
    expect(state.spellBuffCounters.get(caster.id)).toBe(1)
  })

  it('recasting replaces existing handler rather than adding a second one', () => {
    cast(caster, state, 20)
    cast(caster, state, 20)
    expect(caster.passiveAttackHandlers).toHaveLength(1)
  })
})
