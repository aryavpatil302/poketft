import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS     = 15
const PULSE_INTERVAL = Math.round(TICK_RATE * 0.5)

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

describe('Wheezing - Poison Gas', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('wheezing', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 4 }  // adjacent — inside the 1-hex gas cloud
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast animation', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('adds the gas active status effect lasting 5 seconds', () => {
    cast(caster, state)
    const gas = caster.statusEffects.find(e => e.stackId === 'wheezing_gas_active')
    expect(gas).toBeDefined()
    expect(gas!.durationTicks).toBe(5 * TICK_RATE)
    expect(gas!.tickInterval).toBe(PULSE_INTERVAL)
  })

  it('suppresses mana gain while the gas is active', () => {
    cast(caster, state)
    const supp = caster.statusEffects.find(e => e.stackId === 'wheezing_mana_suppressed')
    expect(supp).toBeDefined()
    tickFx(state, 1)
    expect(caster.manaLockTimer).toBeGreaterThan(0)
  })

  it('gas pulse damages adjacent enemies (magic)', () => {
    cast(caster, state)
    const hpBefore = enemy.currentHp
    tickFx(state, PULSE_INTERVAL)  // reach the first pulse
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(
      e => e.type === 'damage' && e.targetId === enemy.id && (e as any).damageType === 'magic'
    )
    expect(dmgEvent).toBeDefined()
  })

  it('gas pulse does not hit enemies farther than 1 hex', () => {
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 2 }
    state = createCombatState([caster], [farEnemy])
    cast(caster, state)
    tickFx(state, PULSE_INTERVAL)
    expect(state.events.some(e => e.type === 'damage' && e.targetId === farEnemy.id)).toBe(false)
  })

  it('tier 1 pulse deals 8 base magic damage (6 after dummy spDef mitigation)', () => {
    cast(caster, state)
    tickFx(state, PULSE_INTERVAL)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      // 8 raw * 100/130 (dummy spDefense 30) = 6
      expect(dmgEvent.amount).toBe(6)
    }
  })

  it('applies 30% armor and sp. defense shred to pulsed enemies', () => {
    cast(caster, state)
    tickFx(state, PULSE_INTERVAL)
    const sunder = enemy.statusEffects.find(e => e.stackId === `wheezing_sunder_${enemy.id}`)
    const shred  = enemy.statusEffects.find(e => e.stackId === `wheezing_shred_${enemy.id}`)
    expect(sunder).toBeDefined()
    expect(sunder!.magnitude).toBe(0.30)
    expect(shred).toBeDefined()
    expect(shred!.magnitude).toBe(0.30)
  })

  it('heals wheezing per enemy hit (tier 1 = 50)', () => {
    caster.currentHp = caster.maxHp - 500
    cast(caster, state)
    const hpBefore = caster.currentHp
    tickFx(state, PULSE_INTERVAL)
    expect(caster.currentHp).toBe(hpBefore + 50)
  })

  it('tier 2 heals 75 per enemy hit', () => {
    const t2 = makeUnit('wheezing', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 4 }
    const s = createCombatState([t2], [e])
    t2.currentHp = t2.maxHp - 500
    cast(t2, s)
    const hpBefore = t2.currentHp
    tickFx(s, PULSE_INTERVAL)
    expect(t2.currentHp).toBe(hpBefore + 75)
  })

  it('tier 3 heals 200 per enemy hit', () => {
    const t3 = makeUnit('wheezing', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 3, row: 4 }
    const s = createCombatState([t3], [e])
    t3.currentHp = t3.maxHp - 500
    cast(t3, s)
    const hpBefore = t3.currentHp
    tickFx(s, PULSE_INTERVAL)
    expect(t3.currentHp).toBe(hpBefore + 200)
  })

  it('gas expires after 5 seconds', () => {
    cast(caster, state)
    tickFx(state, 5 * TICK_RATE + 1)
    expect(caster.statusEffects.some(e => e.stackId === 'wheezing_gas_active')).toBe(false)
  })
})
