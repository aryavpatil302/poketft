import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { tickStatusEffects } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered
import '../systems/ability'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

// Advance exactly N ticks (status effects only — mimics the relevant part of tickCombat)
function tick(state: CombatState, n: number): void {
  for (let i = 0; i < n; i++) {
    state.tick++
    state.events = []
    tickStatusEffects(state.units, state)
  }
}

// Cave crawler unit IDs
const CRAWLERS = ['zubat', 'druddigon', 'sableye', 'ferrothorn', 'excadrill'] as const

// ─── Threshold — earthquake activation ───────────────────────────────────────

describe('Cave Crawler — trait threshold', () => {
  it('no earthquake timer with fewer than 3 unique species', () => {
    const c1 = makeUnit('graveler', 'player', 1)
    const c2 = makeUnit('graveler', 'player', 1)  // same species → only 1 unique
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2], [enemy])

    expect([...state.units.values()].some(u =>
      u.statusEffects.some(fx => fx.stackId === 'cave_crawler_earthquake_timer')
    )).toBe(false)
  })

  it('earthquake timer armed on first cave crawler with 3 unique species', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([c1, c2, c3], [enemy])

    const hasTimer = [...state.units.values()].some(u =>
      u.team === 'player' && u.statusEffects.some(fx => fx.stackId === 'cave_crawler_earthquake_timer')
    )
    expect(hasTimer).toBe(true)
  })

  it('timer expires after exactly 5 seconds (5 × TICK_RATE ticks)', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3], [enemy])

    // 1 tick before trigger — no earthquake events
    tick(state, 5 * TICK_RATE - 1)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'earthquake')).toBe(false)

    // The expiry tick
    tick(state, 1)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'earthquake')).toBe(true)
  })
})

// ─── Earthquake damage ────────────────────────────────────────────────────────

describe('Cave Crawler — earthquake damage', () => {
  it('deals true damage to all enemies on earthquake', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const e1 = makeUnit('dummy', 'enemy', 1)
    const e2 = makeUnit('dummy', 'enemy', 1)
    e1.maxHp = 99999; e1.currentHp = 99999
    e2.maxHp = 99999; e2.currentHp = 99999
    const state = makeState([c1, c2, c3], [e1, e2])

    tick(state, 5 * TICK_RATE)

    expect(e1.currentHp).toBeLessThan(99999)
    expect(e2.currentHp).toBeLessThan(99999)
    expect(state.events.some(e => e.type === 'damage' && e.targetId === e1.id)).toBe(true)
    expect(state.events.some(e => e.type === 'damage' && e.targetId === e2.id)).toBe(true)
  })

  it('damage events are tagged as physical damage', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3], [enemy])

    tick(state, 5 * TICK_RATE)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent?.type === 'damage' && dmgEvent.damageType).toBe('physical')
  })

  it('does NOT damage allies', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const ally = makeUnit('dummy', 'player', 1)
    ally.maxHp = 99999; ally.currentHp = 99999
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3, ally], [enemy])

    tick(state, 5 * TICK_RATE)

    expect(ally.currentHp).toBe(ally.maxHp)
  })

  it('base damage is 173 with all 1-star crawlers (3 unique species)', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    enemy.defense = 0; enemy._computedStats = null
    const state = makeState([c1, c2, c3], [enemy])

    // star points: 3 × 1-star = 3 → damage = round(150 * (1 + 0.05*3)) = round(172.5) = 173
    tick(state, 5 * TICK_RATE)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent?.type === 'damage' && dmgEvent.amount).toBe(173)
  })

  it('damage scales with star points — 2-star counts as 3 star points', () => {
    // 1× 2-star + 2× 1-star = 3 + 1 + 1 = 5 star points → round(150 * 1.25) = 188
    const c1 = makeUnit('zubat',      'player', 2)
    const c2 = makeUnit('druddigon',  'player', 1)
    const c3 = makeUnit('sableye',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    enemy.defense = 0; enemy._computedStats = null
    const state = makeState([c1, c2, c3], [enemy])

    tick(state, 5 * TICK_RATE)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent?.type === 'damage' && dmgEvent.amount).toBe(188)
  })

  it('damage scales with 3-star (counts as 9 star points)', () => {
    // 1× 3-star + 2× 1-star = 9 + 1 + 1 = 11 star points → round(150 * 1.55) = 233
    const c1 = makeUnit('zubat',     'player', 3)
    const c2 = makeUnit('druddigon', 'player', 1)
    const c3 = makeUnit('sableye',   'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    enemy.defense = 0; enemy._computedStats = null
    const state = makeState([c1, c2, c3], [enemy])

    tick(state, 5 * TICK_RATE)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent?.type === 'damage' && dmgEvent.amount).toBe(233)
  })

  it('kills enemies at or below earthquake damage', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 100; enemy.currentHp = 100
    enemy.defense = 0; enemy._computedStats = null
    const state = makeState([c1, c2, c3], [enemy])

    tick(state, 5 * TICK_RATE)

    expect(enemy.state).toBe('dead')
    expect(state.events.some(e => e.type === 'death' && e.unitId === enemy.id)).toBe(true)
  })
})

// ─── Earthquake repeats ───────────────────────────────────────────────────────

describe('Cave Crawler — earthquake repeats', () => {
  it('re-arms after each earthquake and fires again at 10s', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3], [enemy])

    // First quake at 5s
    tick(state, 5 * TICK_RATE)
    const hpAfterFirst = enemy.currentHp

    // Second quake at 10s
    tick(state, 5 * TICK_RATE)
    expect(enemy.currentHp).toBeLessThan(hpAfterFirst)
  })

  it('earthquake count tracks total quakes fired', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3], [enemy])

    tick(state, 5 * TICK_RATE)
    expect(state.earthquakeCounts.get('player')).toBe(1)

    tick(state, 5 * TICK_RATE)
    expect(state.earthquakeCounts.get('player')).toBe(2)
  })

  // The old (5) "+30 enemy mana cost on every second quake" effect was removed and
  // reworked into an econ-layer reroll (see caveCrawlerSpawn). Combat must no
  // longer touch enemy mana, even with 5 crawler species active through 2 quakes.
  it('does not modify enemy mana cost (reworked (5) effect)', () => {
    const [c1, c2, c3, c4, c5] = CRAWLERS.map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3, c4, c5], [enemy])
    const manaBefore = enemy.maxMana

    tick(state, 10 * TICK_RATE)   // two earthquakes with 5 species active
    expect(state.earthquakeCounts.get('player')).toBe(2)
    expect(enemy.maxMana).toBe(manaBefore)
  })
})

// ─── Unit rumble ──────────────────────────────────────────────────────────────

describe('Cave Crawler — earthquake rumble', () => {
  it('applies cave_crawler_earthquake_rumble to all alive cave crawlers on earthquake', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3], [enemy])

    tick(state, 5 * TICK_RATE)

    for (const crawler of [c1, c2, c3]) {
      const rumble = crawler.statusEffects.find(fx => fx.stackId === 'cave_crawler_earthquake_rumble')
      expect(rumble).toBeDefined()
    }
  })

  it('rumble effect expires after 25 ticks', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3], [enemy])

    tick(state, 5 * TICK_RATE)      // earthquake fires, rumble applied (25 ticks)
    tick(state, 25)                  // advance 25 more ticks — rumble should expire

    expect(c1.statusEffects.find(fx => fx.stackId === 'cave_crawler_earthquake_rumble')).toBeUndefined()
  })

  it('rumble does NOT apply to non-cave-crawler allies', () => {
    const [c1, c2, c3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'player', 1))
    const ally = makeUnit('tangela', 'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 99999; enemy.currentHp = 99999
    const state = makeState([c1, c2, c3, ally], [enemy])

    tick(state, 5 * TICK_RATE)

    expect(ally.statusEffects.find(fx => fx.stackId === 'cave_crawler_earthquake_rumble')).toBeUndefined()
  })
})

// The (5) "+30 enemy mana cost" effect was removed and reworked into an
// econ-layer reroll (bench crawlers + gold) — see src/econ/caveCrawlerSpawn.ts
// and its test. The "does not modify enemy mana cost" test in the "earthquake
// repeats" block above locks in the combat-side removal.

// ─── Enemy Cave Crawlers ──────────────────────────────────────────────────────

describe('Cave Crawler — enemy team', () => {
  it('enemy cave crawlers also get earthquake timer (symmetric)', () => {
    const player = makeUnit('dummy', 'player', 1)
    player.maxHp = 99999; player.currentHp = 99999
    const [e1, e2, e3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'enemy', 1))
    const state = makeState([player], [e1, e2, e3])

    const hasTimer = [...state.units.values()].some(u =>
      u.team === 'enemy' && u.statusEffects.some(fx => fx.stackId === 'cave_crawler_earthquake_timer')
    )
    expect(hasTimer).toBe(true)
  })

  it('enemy earthquake damages player units', () => {
    const player = makeUnit('dummy', 'player', 1)
    player.maxHp = 99999; player.currentHp = 99999
    const [e1, e2, e3] = CRAWLERS.slice(0, 3).map(id => makeUnit(id, 'enemy', 1))
    const state = makeState([player], [e1, e2, e3])

    tick(state, 5 * TICK_RATE)

    expect(player.currentHp).toBeLessThan(99999)
  })
})
