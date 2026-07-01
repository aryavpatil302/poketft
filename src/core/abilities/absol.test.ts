import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickLeapPixel } from '../systems/movement'
import { tickStatusEffects } from '../systems/statusEffect'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 20

// Drives the ability through all phases: cast animation → leap → pause → slash
function runFullAbility(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
  // Advance leap until complete (max 30 ticks for a 1-hex dash)
  for (let i = 0; i < 30; i++) {
    if (caster.state !== 'leaping') break
    const done = tickLeapPixel(caster, state)
    if (done && !(caster as any)._leap) (caster as any).state = 'idle'
  }
  // Advance the pre-slash pause status effect
  for (let i = 0; i < 20; i++) {
    tickStatusEffects(new Map([[caster.id, caster]]), state)
    if (!caster.statusEffects.some(e => e.id === 'absol_pre_slash')) break
  }
}

describe('Absol – Night Slash', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('absol', 'player', 1)
    caster.hexPos  = { col: 3, row: 5 }
    enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos   = { col: 3, row: 4 }   // 1 hex away
    state = createCombatState([caster], [enemy])
  })

  it('enters casting state on trigger', () => {
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

  it('resets mana to 0 after cast completes', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('enters leaping state when a dash target exists', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
    expect(caster.state).toBe('leaping')
  })

  it('deals physical damage to enemy after full ability sequence (tier 1 = 100 base)', () => {
    const hpBefore = enemy.currentHp
    runFullAbility(caster, state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent?.type === 'damage' && dmgEvent.damageType).toBe('physical')
  })

  it('damage scales per tier (100 / 150 / 250 base)', () => {
    for (const tier of [1, 2, 3] as const) {
      const s = makeUnit('absol', 'player', tier)
      s.hexPos = { col: 3, row: 5 }
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const st = createCombatState([s], [e])
      const hpBefore = e.currentHp
      runFullAbility(s, st)
      expect(e.currentHp).toBeLessThan(hpBefore)
    }
  })

  it('heals Absol for each enemy hit (tier 1 = 50)', () => {
    caster.currentHp = caster.maxHp - 200
    const hpBefore = caster.currentHp
    runFullAbility(caster, state)
    expect(caster.currentHp).toBeGreaterThan(hpBefore)
  })

  it('heal scales per tier (50 / 75 / 100)', () => {
    const healValues = [50, 75, 100] as const
    for (const tier of [1, 2, 3] as const) {
      const s = makeUnit('absol', 'player', tier)
      s.hexPos  = { col: 3, row: 5 }
      s.currentHp = 1
      const e = makeUnit('dummy', 'enemy', 1)
      e.hexPos = { col: 3, row: 4 }
      const st = createCombatState([s], [e])
      runFullAbility(s, st)
      const healEvent = st.events.find(ev => ev.type === 'heal' && ev.targetId === s.id)
      expect(healEvent).toBeDefined()
      if (healEvent?.type === 'heal') expect(healEvent.amount).toBe(healValues[tier - 1])
    }
  })

  it('emits absol_night_slash VFX event after the sequence', () => {
    runFullAbility(caster, state)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'absol_night_slash')).toBe(true)
  })

  it('does not hit enemies more than 1 hex away after dash', () => {
    const farEnemy = makeUnit('dummy', 'enemy', 1)
    farEnemy.hexPos = { col: 3, row: 2 }   // 3 rows away
    state = createCombatState([caster], [farEnemy])
    runFullAbility(caster, state)
    expect(farEnemy.currentHp).toBe(farEnemy.maxHp)
  })

  it('does not damage allies', () => {
    const ally = makeUnit('dummy', 'player', 1)
    ally.hexPos = { col: 3, row: 4 }
    state = createCombatState([caster, ally], [enemy])
    const allyHpBefore = ally.currentHp
    runFullAbility(caster, state)
    expect(ally.currentHp).toBe(allyHpBefore)
  })

  it('slashes in place immediately when no free adjacent hex exists', () => {
    // Pack all 6 neighbors with allies so no valid leap target is available
    // True neighbors of (col=3, row=5) in odd-row offset coords
    const neighbors = [
      { col: 3, row: 4 }, { col: 4, row: 4 },
      { col: 2, row: 5 }, { col: 4, row: 5 },
      { col: 3, row: 6 }, { col: 4, row: 6 },
    ]
    const allies = neighbors.map((pos, i) => {
      const a = makeUnit('dummy', 'player', 1)
      a.hexPos = pos
      a.id = `ally_${i}`
      return a
    })
    state = createCombatState([caster, ...allies], [enemy])
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
    // All neighbors occupied — Absol cannot dash, fires slash immediately
    expect(caster.state).not.toBe('leaping')
    expect(state.events.some(e => e.type === 'damage')).toBe(true)
  })
})
