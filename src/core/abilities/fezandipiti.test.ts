import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 20
const DURATION = 4 * TICK_RATE

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function tickFx(state: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
  }
}

describe('Fezandipiti - Toxic Chain', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('fezandipiti', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 3 }  // within 3 hexes
    state = createCombatState([caster], [enemy])
  })

  it('applies a toxic chain to each enemy within 3 hexes', () => {
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 2, row: 3 }
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 0 }  // beyond 3 hexes
    state = createCombatState([caster], [enemy, enemy2, farEnemy])
    cast(caster, state)
    expect(enemy.statusEffects.some(e => e.stackId === `fez_chain_${enemy.id}`)).toBe(true)
    expect(enemy2.statusEffects.some(e => e.stackId === `fez_chain_${enemy2.id}`)).toBe(true)
    expect(farEnemy.statusEffects.some(e => e.stackId === `fez_chain_${farEnemy.id}`)).toBe(false)
  })

  it('chain lasts 4 seconds', () => {
    cast(caster, state)
    const chain = enemy.statusEffects.find(e => e.stackId === `fez_chain_${enemy.id}`)
    expect(chain).toBeDefined()
    expect(chain!.durationTicks).toBe(DURATION)
  })

  it('chain deals doubling magic damage each second (tier 1: 20, 40, ...)', () => {
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    cast(caster, state)
    tickFx(state, 2 * TICK_RATE)  // two damage pulses
    const dmgEvents = state.events.filter(
      e => e.type === 'damage' && e.targetId === enemy.id && (e as any).damageType === 'magic'
    )
    expect(dmgEvents.length).toBe(2)
    if (dmgEvents[0]?.type === 'damage' && dmgEvents[1]?.type === 'damage') {
      // 20 raw → 15 mitigated; 40 raw → 31 mitigated (dummy spDef 30)
      expect(dmgEvents[0].amount).toBe(15)
      expect(dmgEvents[1].amount).toBe(31)
    }
  })

  it('chain expiry stuns the target for 1 second', () => {
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    cast(caster, state)
    tickFx(state, DURATION + 1)
    const stun = enemy.statusEffects.find(e => e.id === 'stun')
    expect(stun).toBeDefined()
  })

  it('grants the caster a durability buff for 4 seconds (tier 1 = 40%)', () => {
    cast(caster, state)
    const buff = caster.statusEffects.find(e => e.stackId === 'fez_durability')
    expect(buff).toBeDefined()
    expect(buff!.magnitude).toBeCloseTo(0.40)
    expect(buff!.durationTicks).toBe(DURATION)
    expect(buff!.suppressManaGain).toBe(true)
  })

  it('heals the caster gradually over 4 seconds (tier 1 total = 370)', () => {
    caster.currentHp = caster.maxHp - 1000
    const hpBefore = caster.currentHp
    cast(caster, state)
    tickFx(state, DURATION)
    expect(caster.currentHp).toBe(hpBefore + 370)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })
})
