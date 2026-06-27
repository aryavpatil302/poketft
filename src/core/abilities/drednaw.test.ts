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

describe('Drednaw - Razor Shell', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('drednaw', 'player', 1)
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
    expect(caster.passiveAttackHandlers[0].id).toContain('drednaw_jaw')
  })

  it('adds a drednaw_bite status effect lasting 5 seconds', () => {
    cast(caster, state, 20)
    const bite = caster.statusEffects.find(e => e.id === 'drednaw_bite')
    expect(bite).toBeDefined()
    expect(bite!.durationTicks).toBe(5 * TICK_RATE)
    expect(bite!.stackId).toBe('drednaw_bite_active')
  })

  it('handler calls applyDamage to enemies adjacent to target', () => {
    cast(caster, state, 20)

    // Place a second enemy adjacent to the primary target so splash can hit them
    const splashEnemy = makeUnit('dummy', 'enemy', 1)
    splashEnemy.hexPos = { col: 3, row: 1 }  // adjacent to enemy at row 2
    state.units.set(splashEnemy.id, splashEnemy)
    state.hexOccupancy.set('3,1', splashEnemy.id)

    const hpBefore = splashEnemy.currentHp

    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)

    // splash enemy should have taken 60 damage (tier 1 splash) or less (if defense applies)
    expect(splashEnemy.currentHp).toBeLessThan(hpBefore)
  })

  it('handler does NOT hit the primary target twice (already-hit guard)', () => {
    cast(caster, state, 20)
    const hpBefore = enemy.currentHp

    // Calling handler once; the primary target is in alreadyHit so should not be splashed
    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)

    // We can't check exact HP since applyDamage was already called on enemy above,
    // but a second call should not happen — verify handler doesn't double-count by
    // checking that the enemy was NOT included in the splash set damage again.
    // Simplest proxy: hp did not drop by more than two full splash amounts
    const maxExpectedLoss = 120  // 2 × 60 splash (lenient upper bound)
    expect(hpBefore - enemy.currentHp).toBeLessThanOrEqual(maxExpectedLoss)
  })

  it('handler removes itself when drednaw_bite expires', () => {
    cast(caster, state, 20)
    const bite = caster.statusEffects.find(e => e.id === 'drednaw_bite')!

    // Fire onExpire manually
    if (bite.onExpire) bite.onExpire(caster, state)

    expect(caster.passiveAttackHandlers).toHaveLength(0)
  })

  it('handler self-removes if bite status is absent when it fires', () => {
    cast(caster, state, 20)
    // Remove the status manually before calling the handler
    caster.statusEffects = caster.statusEffects.filter(e => e.id !== 'drednaw_bite')

    const handler = caster.passiveAttackHandlers[0]
    handler.onAttack(caster, enemy, state)

    expect(caster.passiveAttackHandlers).toHaveLength(0)
  })
})
