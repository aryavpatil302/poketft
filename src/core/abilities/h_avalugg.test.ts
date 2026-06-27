import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

function cast(caster: Unit, state: CombatState, castTicks = 25): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
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

  it('deals physical damage to 3 nearest enemies at tier 1', () => {
    const hps = [enemy1, enemy2, enemy3, enemy4].map(e => e.currentHp)
    cast(caster, state)
    const damaged = [enemy1, enemy2, enemy3, enemy4].filter((e, i) => e.currentHp < hps[i])
    expect(damaged).toHaveLength(3)
  })

  it('applies knockUp to 3 nearest enemies at tier 1', () => {
    cast(caster, state)
    const knocked = [enemy1, enemy2, enemy3, enemy4].filter(e =>
      e.statusEffects.some(fx => fx.id === 'knockUp'),
    )
    expect(knocked).toHaveLength(3)
  })

  it('knockUp duration is 1.5 seconds at tier 1', () => {
    cast(caster, state)
    const ku = enemy1.statusEffects.find(e => e.id === 'knockUp')
    expect(ku).toBeDefined()
    expect(ku!.durationTicks).toBe(Math.round(1.5 * TICK_RATE))
  })

  it('knockUp duration is 2.0 seconds at tier 2', () => {
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
    const ku = e2a.statusEffects.find(e => e.id === 'knockUp')
    expect(ku!.durationTicks).toBe(Math.round(2.0 * TICK_RATE))
  })

  it('knockUp duration is 3.0 seconds at tier 3', () => {
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
    const ku = e3a.statusEffects.find(e => e.id === 'knockUp')
    expect(ku!.durationTicks).toBe(Math.round(3.0 * TICK_RATE))
  })

  it('tier 2 targets 4 enemies', () => {
    const t2 = makeUnit('h_avalugg', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const enemies = [
      { col: 3, row: 2 },
      { col: 2, row: 2 },
      { col: 4, row: 2 },
      { col: 1, row: 2 },
      { col: 5, row: 2 },
    ].map(pos => {
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = pos
      return e
    })
    const s2 = createCombatState([t2], enemies)
    cast(t2, s2)
    const knocked = enemies.filter(e => e.statusEffects.some(fx => fx.id === 'knockUp'))
    expect(knocked).toHaveLength(4)
  })

  it('tier 3 targets 5 enemies', () => {
    const t3 = makeUnit('h_avalugg', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const enemies = [
      { col: 3, row: 2 },
      { col: 2, row: 2 },
      { col: 4, row: 2 },
      { col: 1, row: 2 },
      { col: 5, row: 2 },
    ].map(pos => {
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = pos
      return e
    })
    const s3 = createCombatState([t3], enemies)
    cast(t3, s3)
    const knocked = enemies.filter(e => e.statusEffects.some(fx => fx.id === 'knockUp'))
    expect(knocked).toHaveLength(5)
  })

  it('does not apply knockUp to already dead targets', () => {
    enemy1.currentHp = 1  // very low HP — might die from damage
    cast(caster, state)
    // If dead, should not have knockUp
    if (enemy1.state === 'dead') {
      const hasKnockUp = enemy1.statusEffects.some(e => e.id === 'knockUp')
      expect(hasKnockUp).toBe(false)
    }
  })

  it('castTimeTicks is 25', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.abilityCastTimer).toBe(25)
  })
})
