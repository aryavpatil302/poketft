import { describe, it, expect } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { tickProjectiles } from '../projectile'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

// New shape being introduced by this batch: shiny-conditional combat
// behavior tests. Every test below sets `isShiny = true` on exactly the
// caster that should be affected, and includes a non-shiny control proving
// the effect does NOT fire without it.

const CAST_TICKS = 15

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

// Fire staggered launches (status onExpire) and fly all projectiles to impact.
function resolveProjectiles(state: CombatState, maxTicks = 300): void {
  for (let i = 0; i < maxTicks; i++) {
    state.tick++
    tickStatusEffects(state.units, state)
    tickProjectiles(state)
    if (state.projectiles.size === 0 &&
        ![...state.units.values()].some(u => u.statusEffects.some(fx => fx.id === 'typhlosion_launch'))) {
      break
    }
  }
}

describe('Shiny Typhlosion — Eruption applies a 5s burn on hit', () => {
  it('(a) applies a burn status effect to the hit enemy, magnitude 1% max HP/sec, for 5 seconds', () => {
    const caster = makeUnit('typhlosion', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])

    cast(caster, state)
    resolveProjectiles(state)

    const burn = enemy.statusEffects.find(e => e.stackId === `shiny_typhlosion_burn_${enemy.id}`)
    expect(burn).toBeDefined()
    expect(burn?.id).toBe('burn')
    expect(burn?.magnitude).toBe(Math.max(1, Math.round(enemy.maxHp * 0.01)))
    expect(burn?.durationTicks).toBeLessThanOrEqual(5 * TICK_RATE)
    expect(burn?.durationTicks).toBeGreaterThan(0)
  })

  it('(b) non-shiny control — a non-shiny Typhlosion\'s Eruption applies no burn', () => {
    const caster = makeUnit('typhlosion', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])

    cast(caster, state)
    resolveProjectiles(state)

    expect(enemy.statusEffects.some(e => e.id === 'burn')).toBe(false)
  })

  it('(c) invoking the burn\'s tickEffect deals exactly its magnitude in true damage', () => {
    const caster = makeUnit('typhlosion', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    const state = createCombatState([caster], [enemy])

    cast(caster, state)
    resolveProjectiles(state)
    const hpAfterHit = enemy.currentHp
    const burn = enemy.statusEffects.find(e => e.stackId === `shiny_typhlosion_burn_${enemy.id}`)!

    burn.tickEffect!(enemy, state)

    expect(enemy.currentHp).toBe(hpAfterHit - (burn.magnitude ?? 0))
  })

  it('(d) the burn can kill a low-HP target and emits a death event', () => {
    const caster = makeUnit('typhlosion', 'player', 1)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { col: 3, row: 2 }
    const state = createCombatState([caster], [enemy])

    cast(caster, state)
    resolveProjectiles(state)
    const burn = enemy.statusEffects.find(e => e.stackId === `shiny_typhlosion_burn_${enemy.id}`)!
    // Eruption's direct hit already deals massive damage relative to a 1500 HP
    // dummy; drop it to a sliver so the burn's own tick finishes it off.
    enemy.currentHp = 1

    burn.tickEffect!(enemy, state)

    expect(enemy.state).toBe('dead')
    expect(enemy.currentHp).toBe(0)
    expect(state.events.some(e => e.type === 'death' && e.unitId === enemy.id)).toBe(true)
  })

  it('(e) tier 2 — each of the two hit enemies gets its own independent burn', () => {
    const caster = makeUnit('typhlosion', 'player', 2)
    caster.isShiny = true
    caster.hexPos = { col: 3, row: 5 }
    const e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 3 }
    const e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 3 }
    const state = createCombatState([caster], [e1, e2])

    cast(caster, state)
    resolveProjectiles(state)

    expect(e1.statusEffects.some(e => e.stackId === `shiny_typhlosion_burn_${e1.id}`)).toBe(true)
    expect(e2.statusEffects.some(e => e.stackId === `shiny_typhlosion_burn_${e2.id}`)).toBe(true)
  })
})
