import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

describe('Sableye - Power Gem', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('sableye', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('fires cast event on first cast', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('first cast (odd) deals magic damage to nearest enemy (tier 1 = 150)', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('first cast applies charm to nearest enemy', () => {
    cast(caster, state)
    const charm = enemy.statusEffects.find(e => e.id === 'charm')
    expect(charm).toBeDefined()
    expect(charm!.magnitude).toBe(0.20)
  })

  it('first cast adds sableye_parity tracker with magnitude 0 (next = even)', () => {
    cast(caster, state)
    const parity = caster.statusEffects.find(e => e.stackId === 'sableye_parity')
    expect(parity).toBeDefined()
    expect(parity!.magnitude).toBe(0)
  })

  it('second cast (even) grants a shield instead of dealing damage', () => {
    cast(caster, state)
    const hpBeforeSecond = enemy.currentHp
    cast(caster, state)
    // Even cast: shield self + atkSpd buff, no damage
    expect(caster.shields.length).toBeGreaterThan(0)
    expect(enemy.currentHp).toBe(hpBeforeSecond)
  })

  it('second cast (even) grants shield of correct value (tier 1 = 200)', () => {
    cast(caster, state)
    cast(caster, state)
    const shield = caster.shields.find(s => s.sourceAbility === 'sableye_power_gem')
    expect(shield).toBeDefined()
    expect(shield!.value).toBe(200)
  })

  it('second cast (even) grants atkSpd_buff status', () => {
    cast(caster, state)
    cast(caster, state)
    const buff = caster.statusEffects.find(e => e.id === 'atkSpd_buff' && e.stackId === 'sableye_speed')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBe(0.40)
  })

  it('second cast toggles parity to 1 (next = odd)', () => {
    cast(caster, state)
    cast(caster, state)
    const parity = caster.statusEffects.find(e => e.stackId === 'sableye_parity')
    expect(parity!.magnitude).toBe(1)
  })

  it('third cast (odd) deals damage again', () => {
    cast(caster, state)
    cast(caster, state)
    const hpBefore = enemy.currentHp
    cast(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })

  it('tier 2 even cast grants shield of 300', () => {
    const t2 = makeUnit('sableye', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 2 }
    const s2 = createCombatState([t2], [e2])
    cast(t2, s2)  // first cast (odd)
    cast(t2, s2)  // second cast (even)
    const shield = t2.shields.find(s => s.sourceAbility === 'sableye_power_gem')
    expect(shield!.value).toBe(300)
  })

  it('tier 3 even cast grants shield of 500', () => {
    const t3 = makeUnit('sableye', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 3, row: 2 }
    const s3 = createCombatState([t3], [e3])
    cast(t3, s3)
    cast(t3, s3)
    const shield = t3.shields.find(s => s.sourceAbility === 'sableye_power_gem')
    expect(shield!.value).toBe(500)
  })
})
