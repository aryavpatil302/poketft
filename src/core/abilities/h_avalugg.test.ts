import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS    = 25
const AVALANCHE_DELAY = 30

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function triggerAvalanches(state: CombatState): void {
  for (let i = 0; i < AVALANCHE_DELAY; i++) {
    tickStatusEffects(state.units, state)
  }
}

describe('H-Avalugg - Mountain Gale', () => {
  let caster: Unit
  let enemy1: Unit
  let enemy2: Unit
  let enemy3: Unit
  let enemy4: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('h_avalugg', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    enemy1 = makeUnit('dummy', 'enemy', 1)
    enemy1.hexPos = { col: 3, row: 2 }
    enemy2 = makeUnit('dummy', 'enemy', 1)
    enemy2.hexPos = { col: 2, row: 2 }
    enemy3 = makeUnit('dummy', 'enemy', 1)
    enemy3.hexPos = { col: 4, row: 2 }
    enemy4 = makeUnit('dummy', 'enemy', 1)
    enemy4.hexPos = { col: 1, row: 2 }
    state = createCombatState([caster], [enemy1, enemy2, enemy3, enemy4])
  })

  it('fires cast event on trigger', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('castTimeTicks is 25', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.abilityCastTimer).toBe(25)
  })

  it('applies avalanche_pending to 3 nearest enemies immediately on cast', () => {
    cast(caster, state)
    const pending = [enemy1, enemy2, enemy3, enemy4].filter(e =>
      e.statusEffects.some(fx => fx.id === 'avalanche_pending')
    )
    expect(pending).toHaveLength(3)
  })

  it('deals physical damage to 3 nearest enemies after delay', () => {
    const hps = [enemy1, enemy2, enemy3, enemy4].map(e => e.currentHp)
    cast(caster, state)
    triggerAvalanches(state)
    const damaged = [enemy1, enemy2, enemy3, enemy4].filter((e, i) => e.currentHp < hps[i])
    expect(damaged).toHaveLength(3)
  })

  it('applies stun to 3 nearest enemies after delay', () => {
    cast(caster, state)
    triggerAvalanches(state)
    const stunned = [enemy1, enemy2, enemy3, enemy4].filter(e =>
      e.statusEffects.some(fx => fx.id === 'stun')
    )
    expect(stunned).toHaveLength(3)
  })

  it('stun duration is 1.5 seconds at tier 1', () => {
    cast(caster, state)
    triggerAvalanches(state)
    const stun = enemy1.statusEffects.find(e => e.id === 'stun')
    expect(stun).toBeDefined()
    // stun gets ticked once in the same tickStatusEffects call that fires onExpire
    expect(stun!.durationTicks).toBe(Math.round(1.5 * TICK_RATE) - 1)
  })

  it('stun duration is 2.0 seconds at tier 2', () => {
    const t2 = makeUnit('h_avalugg', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const e2a = makeUnit('dummy', 'enemy', 1)
    e2a.hexPos = { col: 3, row: 2 }
    const e2b = makeUnit('dummy', 'enemy', 1)
    e2b.hexPos = { col: 2, row: 2 }
    const e2c = makeUnit('dummy', 'enemy', 1)
    e2c.hexPos = { col: 4, row: 2 }
    const s2 = createCombatState([t2], [e2a, e2b, e2c])
    cast(t2, s2)
    triggerAvalanches(s2)
    const stun = e2a.statusEffects.find(e => e.id === 'stun')
    expect(stun!.durationTicks).toBe(Math.round(2.0 * TICK_RATE) - 1)
  })

  it('stun duration is 3.0 seconds at tier 3', () => {
    const t3 = makeUnit('h_avalugg', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const e3a = makeUnit('dummy', 'enemy', 1)
    e3a.hexPos = { col: 3, row: 2 }
    const e3b = makeUnit('dummy', 'enemy', 1)
    e3b.hexPos = { col: 2, row: 2 }
    const e3c = makeUnit('dummy', 'enemy', 1)
    e3c.hexPos = { col: 4, row: 2 }
    const s3 = createCombatState([t3], [e3a, e3b, e3c])
    cast(t3, s3)
    triggerAvalanches(s3)
    const stun = e3a.statusEffects.find(e => e.id === 'stun')
    expect(stun!.durationTicks).toBe(Math.round(3.0 * TICK_RATE) - 1)
  })

  it('does not stun already dead targets', () => {
    enemy1.currentHp = 1
    cast(caster, state)
    triggerAvalanches(state)
    if (enemy1.state === 'dead') {
      expect(enemy1.statusEffects.some(e => e.id === 'stun')).toBe(false)
    }
  })

  it('emits h_avalugg_avalanche vfx event', () => {
    cast(caster, state)
    expect(state.events.some(e =>
      e.type === 'vfx' && (e as { effectId: string }).effectId === 'h_avalugg_avalanche'
    )).toBe(true)
  })

  it('mana is reset to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })
})
