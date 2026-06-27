import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import { setTerrain } from '../systems/terrain'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 15  // tapukoko castTimeTicks = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('TapuKoko - Electric Surge', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tapu_koko', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(15)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('adds a tapukoko_surge AttackModifier (next auto chains + stuns)', () => {
    cast(caster, state)
    const mod = caster.attackModifiers.find(m => m.id === 'tapukoko_surge')
    expect(mod).toBeDefined()
    expect(mod?.remainingCharges).toBe(1)
    expect(mod?.onHit).toBeDefined()
  })

  it('attack modifier is at the front of the queue', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0]?.id).toBe('tapukoko_surge')
  })

  it('adds tapukoko_chain PassiveAttackHandler on first cast', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')
    expect(handler).toBeDefined()
  })

  it('does not add duplicate chain handler on second cast', () => {
    cast(caster, state)
    cast(caster, state)
    const handlers = caster.passiveAttackHandlers.filter(h => h.id === 'tapukoko_chain')
    expect(handlers).toHaveLength(1)
  })

  it('passive chain fires on every 3rd attack (attackCount % 3 === 0)', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')
    expect(handler).toBeDefined()

    // Simulate 3rd attack
    caster.attackCount = 3
    state.events = []
    handler!.onAttack(caster, enemy, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    expect(dmgEvent).toBeDefined()
  })

  it('passive chain does NOT fire on non-multiples of 3', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')

    caster.attackCount = 2
    state.events = []
    handler!.onAttack(caster, enemy, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })

  it('ability modifier onHit fires chain lightning on nearest enemies', () => {
    cast(caster, state)
    const mod = caster.attackModifiers.find(m => m.id === 'tapukoko_surge')
    state.events = []
    mod!.onHit!(caster, enemy, state)
    // Should have dealt damage (chain lightning)
    expect(state.events.some(e => e.type === 'damage')).toBe(true)
  })

  it('sets electric terrain to true after cast', () => {
    cast(caster, state)
    expect(state.terrain.electric).toBe(true)
  })

  it('adds atkSpd_buff when electric terrain is active during chain', () => {
    // Pre-activate electric terrain
    setTerrain(state, 'electric', true)
    cast(caster, state)
    const mod = caster.attackModifiers.find(m => m.id === 'tapukoko_surge')
    state.events = []
    mod!.onHit!(caster, enemy, state)
    // caster should get an atkSpd_buff
    const buff = caster.statusEffects.find(fx => fx.id === 'atkSpd_buff')
    expect(buff).toBeDefined()
    expect(buff?.magnitude).toBeCloseTo(0.05)
  })

  it('tier 1 chain lightning deals magic damage to nearest enemy', () => {
    cast(caster, state)
    const mod = caster.attackModifiers.find(m => m.id === 'tapukoko_surge')
    state.events = []
    mod!.onHit!(caster, enemy, state)
    const dmgEvent = state.events.find(e => e.type === 'damage')
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 150 raw, mitigated by dummy spDefense
      expect(dmgEvent.amount).toBeGreaterThan(0)
      expect(dmgEvent.damageType).toBe('magic')
    }
  })
})
