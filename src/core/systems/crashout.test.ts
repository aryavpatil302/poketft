import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { applyDamage } from './damage'
import { tickStatusEffects } from './statusEffect'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered (required by createCombatState)
import '../systems/ability'

// Crashout units: talonflame, vigoroth, drednaw, aerodactyl

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

function tickFx(state: CombatState, n = 1): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
  }
}

function ampTotal(unit: Unit): number {
  return unit.statusEffects
    .filter(e => e.id === 'damage_amp')
    .reduce((sum, e) => sum + (e.magnitude ?? 0), 0)
}

function hasRage(unit: Unit): boolean {
  return unit.statusEffects.some(e => e.stackId === 'crashout_rage')
}

// Drop the whole team below 75% total health
function damageTeamBelow75(state: CombatState, team: 'player' | 'enemy'): void {
  for (const u of state.units.values()) {
    if (u.team !== team || u.isDummy) continue
    u.currentHp = Math.floor(u.maxHp * 0.5)
  }
}

describe('Crashout trait — damage amp', () => {

  it('below threshold (1 crashout): no damage amp', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, ally], [enemy])

    expect(ampTotal(state.units.get(c1.id)!)).toBe(0)
  })

  it('threshold 2: whole team gains 5% damage amp', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const ally = makeUnit('tangela',  'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2, ally], [enemy])

    expect(ampTotal(state.units.get(c1.id)!)).toBeCloseTo(0.05)
    expect(ampTotal(state.units.get(c2.id)!)).toBeCloseTo(0.05)
    expect(ampTotal(state.units.get(ally.id)!)).toBeCloseTo(0.05)
  })

  it('threshold 3: 6% amp — threshold 4: 8% amp', () => {
    const ids3 = ['talonflame', 'vigoroth', 'drednaw']
    const ids4 = [...ids3, 'aerodactyl']

    const t3units = ids3.map(id => makeUnit(id, 'player', 1))
    const s3 = makeState(t3units, [makeUnit('dummy', 'enemy', 1)])
    expect(ampTotal(s3.units.get(t3units[0].id)!)).toBeCloseTo(0.06)

    const t4units = ids4.map(id => makeUnit(id, 'player', 1))
    const s4 = makeState(t4units, [makeUnit('dummy', 'enemy', 1)])
    expect(ampTotal(s4.units.get(t4units[0].id)!)).toBeCloseTo(0.08)
  })

  it('damage amp multiplies outgoing damage (105 from 100 base at threshold 2)', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.defense = 0
    enemy._computedStats = null
    const state = makeState([c1, c2], [enemy])

    applyDamage(state.units.get(c1.id)!, enemy, {
      baseAmount: 100, damageType: 'physical', canCrit: false, abilityId: 'test',
    }, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(105)
    }
  })

  it('crashouts double their amp when team health drops below 75%', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const ally = makeUnit('tangela',  'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2, ally], [enemy])

    damageTeamBelow75(state, 'player')
    tickFx(state)

    // Crashouts: 5% team + 5% rage = 10%
    expect(ampTotal(state.units.get(c1.id)!)).toBeCloseTo(0.10)
    expect(ampTotal(state.units.get(c2.id)!)).toBeCloseTo(0.10)
    // Non-crashout ally stays at the base team amp
    expect(ampTotal(state.units.get(ally.id)!)).toBeCloseTo(0.05)
  })

  it('rage marker is applied for the renderer when enraged', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2], [enemy])

    expect(hasRage(state.units.get(c1.id)!)).toBe(false)
    damageTeamBelow75(state, 'player')
    tickFx(state)
    expect(hasRage(state.units.get(c1.id)!)).toBe(true)
    expect(hasRage(state.units.get(c2.id)!)).toBe(true)
  })

  it('rage is removed when team health recovers above 75%', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2], [enemy])

    damageTeamBelow75(state, 'player')
    tickFx(state)
    expect(hasRage(state.units.get(c1.id)!)).toBe(true)

    // Heal the team back to full
    for (const u of state.units.values()) {
      if (u.team === 'player') u.currentHp = u.maxHp
    }
    tickFx(state)
    expect(hasRage(state.units.get(c1.id)!)).toBe(false)
    expect(ampTotal(state.units.get(c1.id)!)).toBeCloseTo(0.05)
  })

  it('enraged crashout deals double amp damage (110 from 100 base)', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.defense = 0
    enemy._computedStats = null
    const state = makeState([c1, c2], [enemy])

    damageTeamBelow75(state, 'player')
    tickFx(state)

    state.events = []
    applyDamage(state.units.get(c1.id)!, enemy, {
      baseAmount: 100, damageType: 'physical', canCrit: false, abilityId: 'test',
    }, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(110)
    }
  })

  it('dead teammates count as missing health for the 75% check', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const ally = makeUnit('tangela',  'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2, ally], [enemy])

    // Kill the ally — if their maxHp share is > 25% of team total, rage triggers
    const allyU = state.units.get(ally.id)!
    allyU.currentHp = 0
    allyU.state = 'dead'
    tickFx(state)

    const totalMax = [c1, c2, ally].reduce((s, u) => s + state.units.get(u.id)!.maxHp, 0)
    const aliveCur = [c1, c2].reduce((s, u) => s + state.units.get(u.id)!.currentHp, 0)
    const expectLow = aliveCur / totalMax < 0.75
    expect(hasRage(state.units.get(c1.id)!)).toBe(expectLow)
  })

  it('rage entry grants brief invulnerability with a hop/rumble animation status', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2], [enemy])

    damageTeamBelow75(state, 'player')
    tickFx(state)

    const u = state.units.get(c1.id)!
    expect(u.incomingDamageMult).toBe(0)
    const enterFx = u.statusEffects.find(e => e.stackId === 'crashout_rage_enter')
    expect(enterFx).toBeDefined()

    // Damage during the invulnerability window does nothing
    const hpBefore = u.currentHp
    applyDamage(enemy, u, { baseAmount: 500, damageType: 'physical', canCrit: false }, state)
    expect(u.currentHp).toBe(hpBefore)

    // After the window expires, vulnerability is restored
    tickFx(state, 41)
    expect(u.incomingDamageMult).toBe(1.0)
    expect(u.statusEffects.some(e => e.stackId === 'crashout_rage_enter')).toBe(false)
    // Rage itself persists (team still low)
    expect(hasRage(u)).toBe(true)
  })

  it('re-entering rage after recovery re-triggers the invulnerability window', () => {
    const c1 = makeUnit('talonflame', 'player', 1)
    const c2 = makeUnit('vigoroth',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2], [enemy])

    // Enter rage, let the window expire
    damageTeamBelow75(state, 'player')
    tickFx(state, 45)
    const u = state.units.get(c1.id)!
    expect(u.incomingDamageMult).toBe(1.0)

    // Recover, then drop low again
    for (const unit of state.units.values()) {
      if (unit.team === 'player') unit.currentHp = unit.maxHp
    }
    tickFx(state)
    expect(hasRage(u)).toBe(false)

    damageTeamBelow75(state, 'player')
    tickFx(state)
    expect(u.incomingDamageMult).toBe(0)
    expect(u.statusEffects.some(e => e.stackId === 'crashout_rage_enter')).toBe(true)
  })

  it('enemy-team crashouts work symmetrically', () => {
    const p1 = makeUnit('tangela', 'player', 1)
    const c1 = makeUnit('talonflame', 'enemy', 1)
    const c2 = makeUnit('vigoroth',    'enemy', 1)
    const state = makeState([p1], [c1, c2])

    expect(ampTotal(state.units.get(c1.id)!)).toBeCloseTo(0.05)
    damageTeamBelow75(state, 'enemy')
    tickFx(state)
    expect(hasRage(state.units.get(c1.id)!)).toBe(true)
    // Player team unaffected
    expect(ampTotal(state.units.get(p1.id)!)).toBe(0)
  })
})
