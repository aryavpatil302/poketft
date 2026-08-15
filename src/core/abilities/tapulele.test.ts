import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 25
// Damage fires when the per-target psystrike status expires (2s minus 10 ticks)
const STRIKE_DELAY = 2 * TICK_RATE - 10

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

describe("Tapu Lele - Nature's Madness", () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tapu_lele', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state with 25-tick timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('psychic terrain is active from combat start (Lele on team)', () => {
    expect(state.terrain.psychic).toBe(true)
  })

  it('does NOT deal damage before the psystrike lands', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    tickFx(state, STRIKE_DELAY - 10)
    expect(enemy.currentHp).toBe(hpBefore)
  })

  it('deals magic damage after the psystrike delay', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    tickFx(state, STRIKE_DELAY + 1)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && e.targetId === enemy.id && (e as any).damageType === 'magic'
    )
    expect(dmgEvent).toBeDefined()
  })

  it('sole enemy absorbs all cast slots (tier 1 = 4× damage)', () => {
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    enemy.spDefense = 0
    enemy._computedStats = null
    // Disable terrain pierce so raw damage is exact
    state.terrain.psychic = false
    cast(caster, state)
    tickFx(state, STRIKE_DELAY + 1)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 4 slots × 500 = 2000 raw, no mitigation at 0 spDef
      expect(dmgEvent.amount).toBe(2000)
    }
  })

  it('does not damage allies', () => {
    const ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 3, row: 4 }
    state.units.set(ally.id, ally)
    state.hexOccupancy.set('3,4', ally.id)
    const allyHpBefore = ally.currentHp
    cast(caster, state)
    tickFx(state, STRIKE_DELAY + 1)
    expect(ally.currentHp).toBe(allyHpBefore)
  })

  it('with psychic terrain active, pierces spDefense (more damage than without)', () => {
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    enemy.spDefense = 100
    enemy._computedStats = null
    state.terrain.psychic = false
    cast(caster, state)
    tickFx(state, STRIKE_DELAY + 1)
    const noTerrainDmg = 100000 - enemy.currentHp

    const caster2 = makeUnit('tapu_lele', 'player', 1)
    caster2.hexPos = { col: 3, row: 5 }
    const enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 3, row: 2 }
    enemy2.maxHp = 100000
    enemy2.currentHp = 100000
    enemy2.spDefense = 100
    enemy2._computedStats = null
    const state2 = createCombatState([caster2], [enemy2])
    state2.terrain.psychic = true
    cast(caster2, state2)
    tickFx(state2, STRIKE_DELAY + 1)
    const terrainDmg = 100000 - enemy2.currentHp

    expect(terrainDmg).toBeGreaterThan(noTerrainDmg)
  })

  it('resets caster mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })
})
