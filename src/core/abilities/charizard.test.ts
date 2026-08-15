import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickProjectiles } from '../projectile'
import { hasMark } from '../systems/marks'
import type { Unit, CombatState } from '../types'

import '../systems/ability'

const CAST_TICKS = 20
const MARK_ID = 'charizard_flame_mark'

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

function resolveProjectiles(state: CombatState, maxTicks = 300): void {
  for (let i = 0; i < maxTicks && state.projectiles.size > 0; i++) {
    tickProjectiles(state)
  }
}

// Enemies are placed within charizard's range (4)
function setup(tier: 1 | 2 | 3, enemyCount: number) {
  const caster = makeUnit('charizard', 'player', tier)
  caster.hexPos = { col: 3, row: 5 }
  const enemies: Unit[] = []
  for (let i = 0; i < enemyCount; i++) {
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { col: 1 + i, row: 3 }
    enemies.push(e)
  }
  const state = createCombatState([caster], enemies)
  return { caster, enemies, state }
}

describe('Charizard - Blast Burn', () => {
  let caster: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    ({ caster, enemies: [enemy], state } = (() => {
      const r = setup(1, 1)
      return { caster: r.caster, enemies: r.enemies, state: r.state }
    })())
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('emits a cast event on first cast', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('first cast fires fireballs that damage and mark enemies in range', () => {
    const hpBefore = enemy.currentHp
    cast(caster, state)
    resolveProjectiles(state)
    expect(enemy.currentHp).toBeLessThan(hpBefore)
    expect(hasMark(enemy, MARK_ID)).toBe(true)
  })

  it('tier 1 - first cast marks up to 3 enemies in range', () => {
    const { enemies, state: s, caster: c } = setup(1, 4)
    cast(c, s)
    resolveProjectiles(s)
    const marked = enemies.filter(e => hasMark(e, MARK_ID))
    expect(marked).toHaveLength(3)
  })

  it('tier 2 - first cast marks up to 4 enemies in range', () => {
    const { enemies, state: s, caster: c } = setup(2, 5)
    cast(c, s)
    resolveProjectiles(s)
    const marked = enemies.filter(e => hasMark(e, MARK_ID))
    expect(marked).toHaveLength(4)
  })

  it('tier 1 - fireball deals 300 physical damage (375% attack, before mitigation)', () => {
    enemy.defense = 0
    enemy._computedStats = null
    caster.critChance = 0
    caster._computedStats = null
    cast(caster, state)
    resolveProjectiles(state)
    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') {
      expect(dmgEvent.amount).toBe(300)
    }
  })

  it('second cast - executes the highest-HP marked enemy with true damage', () => {
    const { enemies, state: s, caster: c } = setup(1, 2)
    enemies[0].maxHp = 5000
    enemies[0].currentHp = 5000
    cast(c, s)
    resolveProjectiles(s)

    cast(c, s)
    resolveProjectiles(s)
    expect(enemies[0].state).toBe('dead')
  })

  it('second cast - detonates non-primary marked enemies with physical damage (tier 1 = 500)', () => {
    const { enemies, state: s, caster: c } = setup(1, 2)
    enemies[0].maxHp = 50000
    enemies[0].currentHp = 50000  // survives fireball, highest HP → executed
    enemies[1].maxHp = 40000
    enemies[1].currentHp = 40000
    enemies[1].defense = 0
    enemies[1]._computedStats = null
    c.critChance = 0
    c._computedStats = null
    cast(c, s)
    resolveProjectiles(s)

    s.events = []
    cast(c, s)
    resolveProjectiles(s)
    const detonate = s.events.find(
      e => e.type === 'damage' && e.targetId === enemies[1].id && (e as any).damageType === 'physical'
    )
    expect(detonate).toBeDefined()
    if (detonate?.type === 'damage') {
      expect(detonate.amount).toBe(500)
    }
  })

  it('second cast - removes marks from all hit enemies', () => {
    const { enemies, state: s, caster: c } = setup(1, 2)
    enemies[0].maxHp = 50000
    enemies[0].currentHp = 50000
    enemies[1].maxHp = 40000
    enemies[1].currentHp = 40000
    cast(c, s)
    resolveProjectiles(s)
    cast(c, s)
    resolveProjectiles(s)
    for (const e of enemies) {
      expect(hasMark(e, MARK_ID)).toBe(false)
    }
  })

  it('third cast after detonation returns to the marking phase', () => {
    const { enemies, state: s, caster: c } = setup(1, 2)
    enemies[0].maxHp = 50000
    enemies[0].currentHp = 50000
    enemies[1].maxHp = 40000
    enemies[1].currentHp = 40000
    cast(c, s)
    resolveProjectiles(s)
    cast(c, s)
    resolveProjectiles(s)
    // Third cast: marking phase again
    cast(c, s)
    resolveProjectiles(s)
    const marked = enemies.filter(e => e.state !== 'dead' && hasMark(e, MARK_ID))
    expect(marked.length).toBeGreaterThan(0)
  })
})
