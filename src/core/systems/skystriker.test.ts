import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { tickStatusEffects } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Ensure all abilities are registered
import '../systems/ability'

// ─── Cast ticks per unit ──────────────────────────────────────────────────────

const PIDGEOTTO_CAST  = 15
const WAILORD_CAST    = 5
const TALONFLAME_CAST = 15
const NOIVERN_CAST    = 20
const RAYQUAZA_CAST   = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(players: Unit[], enemies: Unit[]): CombatState {
  players.forEach((u, i) => { u.hexPos = { col: i % 7, row: 4 + Math.floor(i / 7) } })
  enemies.forEach((u, i) => { u.hexPos = { col: i % 7, row: Math.floor(i / 7) } })
  const state = createCombatState(players, enemies)
  for (const unit of state.units.values()) computeStats(unit)
  return state
}

function cast(caster: Unit, state: CombatState, castTicks: number): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

// ─── Tailwind activation ──────────────────────────────────────────────────────

describe('Sky Striker — tailwind activation', () => {
  it('tailwind is false at combat start', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])
    expect(state.tailwind.player).toBe(false)
  })

  it('single sky striker below threshold — no passiveCastHandler registered', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto], [enemy])
    expect(pidgeotto.passiveCastHandlers).toHaveLength(0)
    cast(pidgeotto, state, PIDGEOTTO_CAST)
    expect(state.tailwind.player).toBe(false)
  })

  it('first cast with 2 sky strikers sets state.tailwind.player = true', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])

    cast(pidgeotto, state, PIDGEOTTO_CAST)
    expect(state.tailwind.player).toBe(true)
  })

  it('per-team: player and enemy tailwind are independent — one never affects the other', () => {
    // Player has a 2-striker board; enemy also has a 2-striker board.
    const pPidg = makeUnit('pidgeotto', 'player', 1)
    const pNoiv = makeUnit('noivern',   'player', 1)
    const efPidg = makeUnit('pidgeotto', 'enemy', 1)
    const efNoiv = makeUnit('noivern',   'enemy', 1)
    const state  = makeState([pPidg, pNoiv], [efPidg, efNoiv])

    // Player casts first → ONLY player tailwind + only player strikers buffed.
    cast(pPidg, state, PIDGEOTTO_CAST)
    expect(state.tailwind.player).toBe(true)
    expect(state.tailwind.enemy).toBe(false)
    expect(pPidg.statusEffects.some(fx => fx.id === 'sky_striker_tailwind')).toBe(true)
    expect(efPidg.statusEffects.some(fx => fx.id === 'sky_striker_tailwind')).toBe(false)

    // Enemy casting afterwards is NOT locked out — it summons its own tailwind,
    // and still only its own strikers get buffed.
    cast(efPidg, state, PIDGEOTTO_CAST)
    expect(state.tailwind.enemy).toBe(true)
    expect(efPidg.statusEffects.some(fx => fx.id === 'sky_striker_tailwind')).toBe(true)
    expect(efNoiv.statusEffects.some(fx => fx.id === 'sky_striker_tailwind')).toBe(true)
    // Player's buff is untouched by the enemy summon.
    expect(pPidg.statusEffects.filter(fx => fx.id === 'sky_striker_tailwind')).toHaveLength(1)
  })

  it('per-team execute: a striker only executes while ITS OWN team has tailwind', () => {
    const striker = makeUnit('pidgeotto', 'enemy', 1)   // 2 enemy strikers → execute marker registers
    const striker2 = makeUnit('noivern',  'enemy', 1)
    const victim  = makeUnit('dummy', 'player', 1)
    const state   = makeState([victim], [striker, striker2])
    victim.maxHp = 1000; victim.currentHp = 100; victim.defense = 0; victim._computedStats = null

    // Only the PLAYER team has tailwind → the enemy striker must NOT execute.
    state.tailwind.player = true
    applyDamage(striker, victim, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(victim.state).not.toBe('dead')

    // Now the enemy team has tailwind → the enemy striker executes.
    state.tailwind.enemy = true
    applyDamage(striker, victim, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(victim.state).toBe('dead')
  })

  it('tailwind does not activate before any sky striker casts', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])

    // Don't cast yet
    expect(state.tailwind.player).toBe(false)
  })

  it('2 sky strikers: each striker gets sky_striker_tailwind atkspd buff on first cast', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])

    cast(pidgeotto, state, PIDGEOTTO_CAST)

    const pidgBuff = pidgeotto.statusEffects.find(fx => fx.id === 'sky_striker_tailwind')
    const noivBuff = noivern.statusEffects.find(fx => fx.id === 'sky_striker_tailwind')
    expect(pidgBuff).toBeDefined()
    expect(noivBuff).toBeDefined()
    expect(pidgBuff?.magnitude).toBe(0.30)
    expect(noivBuff?.magnitude).toBe(0.30)
  })

  it('2 sky strikers: tailwind bonus is 0.30 atkspd (additive)', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])

    const baseAtkspd = pidgeotto.attackSpeed
    cast(pidgeotto, state, PIDGEOTTO_CAST)

    computeStats(pidgeotto)
    expect(pidgeotto._computedStats!.attackSpeed).toBeCloseTo(baseAtkspd + 0.30, 5)
  })

  it('4 sky strikers: tailwind bonus is 0.60 atkspd', () => {
    const p1 = makeUnit('pidgeotto',  'player', 1)
    const p2 = makeUnit('noivern',    'player', 1)
    const p3 = makeUnit('talonflame', 'player', 1)
    const p4 = makeUnit('wailord',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([p1, p2, p3, p4], [enemy])

    const baseAtkspd = p1.attackSpeed
    cast(p1, state, PIDGEOTTO_CAST)

    computeStats(p1)
    expect(p1._computedStats!.attackSpeed).toBeCloseTo(baseAtkspd + 0.60, 5)
  })

  it('tailwind buff does NOT apply to enemy sky strikers', () => {
    const playerStriker = makeUnit('pidgeotto', 'player', 1)
    const teammate      = makeUnit('noivern',   'player', 1)
    const enemyStriker  = makeUnit('talonflame', 'enemy', 1)
    const enemyMate     = makeUnit('wailord',    'enemy', 1)
    const state = makeState([playerStriker, teammate], [enemyStriker, enemyMate])

    cast(playerStriker, state, PIDGEOTTO_CAST)

    // player side has tailwind
    expect(playerStriker.statusEffects.some(fx => fx.id === 'sky_striker_tailwind')).toBe(true)
    // enemy side unaffected
    expect(enemyStriker.statusEffects.some(fx => fx.id === 'sky_striker_tailwind')).toBe(false)
    expect(enemyMate.statusEffects.some(fx => fx.id === 'sky_striker_tailwind')).toBe(false)
  })

  it('tailwind activates only once even if multiple casts happen', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])

    cast(pidgeotto, state, PIDGEOTTO_CAST)
    cast(pidgeotto, state, PIDGEOTTO_CAST)

    const buffs = pidgeotto.statusEffects.filter(fx => fx.id === 'sky_striker_tailwind')
    expect(buffs).toHaveLength(1)
  })
})

// ─── Execute ─────────────────────────────────────────────────────────────────

describe('Sky Striker — execute', () => {
  let pidgeotto: Unit
  let noivern: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    pidgeotto = makeUnit('pidgeotto', 'player', 1)
    noivern   = makeUnit('noivern',   'player', 1)
    enemy     = makeUnit('dummy', 'enemy', 1)
    state     = makeState([pidgeotto, noivern], [enemy])
    enemy.maxHp = 1000
    enemy.currentHp = 1000
    enemy.defense = 0
    enemy._computedStats = null
  })

  it('does NOT execute before tailwind is active', () => {
    enemy.currentHp = 100  // 10% of 1000
    applyDamage(pidgeotto, enemy, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(enemy.state).not.toBe('dead')
    expect(enemy.currentHp).toBe(99)
  })

  it('executes target at exactly 10% HP during tailwind (2 strikers)', () => {
    state.tailwind.player = true
    enemy.currentHp = 100  // exactly 10% of 1000
    applyDamage(pidgeotto, enemy, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(enemy.state).toBe('dead')
  })

  it('executes target below 10% HP during tailwind', () => {
    state.tailwind.player = true
    enemy.currentHp = 50  // 5% of 1000
    applyDamage(pidgeotto, enemy, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(enemy.state).toBe('dead')
  })

  it('does NOT execute target at 11% HP during tailwind', () => {
    state.tailwind.player = true
    enemy.currentHp = 110  // 11% of 1000
    applyDamage(pidgeotto, enemy, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(enemy.state).not.toBe('dead')
    expect(enemy.currentHp).toBe(109)
  })

  it('executes at 15% HP with 4 strikers', () => {
    const p1    = makeUnit('pidgeotto',  'player', 1)
    const p2    = makeUnit('noivern',    'player', 1)
    const p3    = makeUnit('talonflame', 'player', 1)
    const p4    = makeUnit('wailord',    'player', 1)
    const foe   = makeUnit('dummy', 'enemy', 1)
    const st    = makeState([p1, p2, p3, p4], [foe])

    foe.maxHp    = 1000
    foe.currentHp = 150  // exactly 15% of 1000
    foe.defense  = 0
    foe._computedStats = null
    st.tailwind.player  = true

    applyDamage(p1, foe, { baseAmount: 1, damageType: 'true', canCrit: false }, st)
    expect(foe.state).toBe('dead')
  })

  it('does NOT execute at 16% HP with 4 strikers', () => {
    const p1    = makeUnit('pidgeotto',  'player', 1)
    const p2    = makeUnit('noivern',    'player', 1)
    const p3    = makeUnit('talonflame', 'player', 1)
    const p4    = makeUnit('wailord',    'player', 1)
    const foe   = makeUnit('dummy', 'enemy', 1)
    const st    = makeState([p1, p2, p3, p4], [foe])

    foe.maxHp    = 1000
    foe.currentHp = 160  // 16% of 1000
    foe.defense  = 0
    foe._computedStats = null
    st.tailwind.player  = true

    applyDamage(p1, foe, { baseAmount: 1, damageType: 'true', canCrit: false }, st)
    expect(foe.state).not.toBe('dead')
  })

  it('emits a death event on execute', () => {
    state.tailwind.player = true
    enemy.currentHp = 100  // 10%
    applyDamage(pidgeotto, enemy, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(state.events.some(e => e.type === 'death' && e.unitId === enemy.id)).toBe(true)
  })

  it('non-sky-striker does not trigger execute', () => {
    const jungle = makeUnit('tangela', 'player', 1)
    jungle.hexPos = { col: 5, row: 4 }
    state.tailwind.player = true
    enemy.currentHp = 100

    applyDamage(jungle, enemy, { baseAmount: 1, damageType: 'true', canCrit: false }, state)
    expect(enemy.state).not.toBe('dead')
  })
})

// ─── Kill bonus ───────────────────────────────────────────────────────────────

describe('Sky Striker — kill bonus', () => {
  let killer: Unit
  let teammate: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    killer   = makeUnit('pidgeotto', 'player', 1)
    teammate = makeUnit('noivern',   'player', 1)
    enemy    = makeUnit('dummy', 'enemy', 1)
    state    = makeState([killer, teammate], [enemy])

    // Pre-activate tailwind so the kill bonus branch is reachable
    state.tailwind.player = true
    killer.statusEffects.push({
      id: 'sky_striker_tailwind',
      sourceUnitId: killer.id,
      durationTicks: -1,
      magnitude: 0.30,
      stackId: 'sky_striker_tailwind',
    })
    teammate.statusEffects.push({
      id: 'sky_striker_tailwind',
      sourceUnitId: killer.id,
      durationTicks: -1,
      magnitude: 0.30,
      stackId: 'sky_striker_tailwind',
    })
    killer._computedStats   = null
    teammate._computedStats = null
  })

  it('kill bonus applied to the killer', () => {
    enemy.currentHp = 1
    applyDamage(killer, enemy, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    expect(enemy.state).toBe('dead')
    expect(killer.statusEffects.some(fx => fx.stackId === 'sky_striker_kill_boost')).toBe(true)
  })

  it('kill bonus NOT applied to teammates (killer only)', () => {
    enemy.currentHp = 1
    applyDamage(killer, enemy, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    expect(teammate.statusEffects.some(fx => fx.stackId === 'sky_striker_kill_boost')).toBe(false)
  })

  it('kill bonus magnitude equals tailwind bonus (0.30)', () => {
    enemy.currentHp = 1
    applyDamage(killer, enemy, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    const boost = killer.statusEffects.find(fx => fx.stackId === 'sky_striker_kill_boost')
    expect(boost?.magnitude).toBe(0.30)
  })

  it('kill bonus duration is 3 * TICK_RATE ticks', () => {
    enemy.currentHp = 1
    applyDamage(killer, enemy, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    const boost = killer.statusEffects.find(fx => fx.stackId === 'sky_striker_kill_boost')
    expect(boost?.durationTicks).toBe(3 * TICK_RATE)
  })

  it('kill bonus duration refreshes on second kill', () => {
    const foe2 = makeUnit('dummy', 'enemy', 1)
    foe2.hexPos = { col: 2, row: 0 }
    state.units.set(foe2.id, foe2)

    // First kill
    enemy.currentHp = 1
    applyDamage(killer, enemy, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    // Manually decay the boost timer partway
    const boost = killer.statusEffects.find(fx => fx.stackId === 'sky_striker_kill_boost')!
    boost.durationTicks = 10

    // Second kill
    foe2.currentHp = 1
    applyDamage(killer, foe2, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    expect(boost.durationTicks).toBe(3 * TICK_RATE)
  })

  it('kill bonus NOT applied before tailwind is active', () => {
    state.tailwind.player = false

    enemy.currentHp = 1
    applyDamage(killer, enemy, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    expect(killer.statusEffects.some(fx => fx.stackId === 'sky_striker_kill_boost')).toBe(false)
  })

  it('kill by a non-sky-striker during tailwind does not grant kill boost', () => {
    const jungle = makeUnit('tangela', 'player', 1)
    jungle.hexPos = { col: 5, row: 4 }
    state.units.set(jungle.id, jungle)
    state.tailwind.player = true

    enemy.currentHp = 1
    applyDamage(jungle, enemy, { baseAmount: 9999, damageType: 'true', canCrit: false }, state)

    // The killer is non-sky-striker — no boost should appear on killer or teammates
    expect(jungle.statusEffects.some(fx => fx.stackId === 'sky_striker_kill_boost')).toBe(false)
    expect(killer.statusEffects.some(fx => fx.stackId === 'sky_striker_kill_boost')).toBe(false)
  })
})

// ─── Per-cast adaptive force ──────────────────────────────────────────────────

describe('Sky Striker — per-cast adaptive force', () => {
  it('no sky_striker_cast_adaptive on striker before any cast', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])
    expect(pidgeotto.statusEffects.find(fx => fx.stackId === 'sky_striker_cast_adaptive')).toBeUndefined()
  })

  it('sky_striker_cast_adaptive is absent after cast (cleaned up by afterCast)', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])

    // Trigger tailwind first via pidgeotto's first cast
    cast(pidgeotto, state, PIDGEOTTO_CAST)
    expect(state.tailwind.player).toBe(true)

    // Second cast: adaptive applies then gets removed
    cast(pidgeotto, state, PIDGEOTTO_CAST)

    expect(pidgeotto.statusEffects.find(fx => fx.stackId === 'sky_striker_cast_adaptive')).toBeUndefined()
  })

  it('adaptive applied during cast boosts the expected stat (spy captures it)', () => {
    const pidgeotto = makeUnit('pidgeotto', 'player', 1)
    const noivern   = makeUnit('noivern',   'player', 1)
    const enemy     = makeUnit('dummy', 'enemy', 1)
    const state     = makeState([pidgeotto, noivern], [enemy])

    // Trigger tailwind via noivern cast
    cast(noivern, state, NOIVERN_CAST)
    expect(state.tailwind.player).toBe(true)

    // Spy pushed after trait handler — runs second in passiveCastHandlers
    let capturedSpecial: number | null = null
    pidgeotto.passiveCastHandlers.push({
      id: 'spy',
      onCast: (u: Unit) => { capturedSpecial = computeStats(u).special },
    })

    cast(pidgeotto, state, PIDGEOTTO_CAST)

    // Pidgeotto: attack=35, special=100 → adaptive adds to special (attack < special)
    // atkspd = 0.80 (base) + 0.30 (tailwind) = 1.10
    // adaptiveGain = floor(1.10 * 100 * 0.20) = floor(22) = 22
    expect(capturedSpecial).toBe(100 + 22)  // 122
  })

  it('adaptive magnitude scales with atkspd at 4-unit threshold', () => {
    const p1 = makeUnit('pidgeotto',  'player', 1)
    const p2 = makeUnit('noivern',    'player', 1)
    const p3 = makeUnit('talonflame', 'player', 1)
    const p4 = makeUnit('wailord',    'player', 1)
    const enemy = makeUnit('dummy', 'enemy', 1)
    const state = makeState([p1, p2, p3, p4], [enemy])

    // Trigger tailwind
    cast(p2, state, NOIVERN_CAST)
    expect(state.tailwind.player).toBe(true)

    let capturedSpecial: number | null = null
    p1.passiveCastHandlers.push({
      id: 'spy',
      onCast: (u: Unit) => { capturedSpecial = computeStats(u).special },
    })

    cast(p1, state, PIDGEOTTO_CAST)

    // atkspd = 0.80 + 0.60 = 1.40, adaptiveGain = floor(1.40 * 100 * 0.20) = floor(28) = 28
    expect(capturedSpecial).toBe(100 + 28)  // 128
  })
})

// ─── Pidgeotto — Wing Slap ────────────────────────────────────────────────────

describe('Sky Striker — Pidgeotto (Wing Slap)', () => {
  let pidgeotto: Unit
  let noivern: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    pidgeotto = makeUnit('pidgeotto', 'player', 1)
    noivern   = makeUnit('noivern',   'player', 1)
    enemy     = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    state = makeState([pidgeotto, noivern], [enemy])
    pidgeotto.targetId = enemy.id
  })

  it('queues two wing-slap attack modifiers on cast', () => {
    cast(pidgeotto, state, PIDGEOTTO_CAST)
    const wingSlapMods = pidgeotto.attackModifiers.filter(m => m.id === 'pidgeotto_wing_slap')
    expect(wingSlapMods).toHaveLength(2)
  })

  it('sets attackTimer = 1 after cast (double auto fires 1 tick later)', () => {
    cast(pidgeotto, state, PIDGEOTTO_CAST)
    expect(pidgeotto.attackTimer).toBe(1)
  })

  it('emits a cast event', () => {
    cast(pidgeotto, state, PIDGEOTTO_CAST)
    expect(state.events.some(e => e.type === 'cast' && e.unitId === pidgeotto.id)).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(pidgeotto, state, PIDGEOTTO_CAST)
    expect(pidgeotto.currentMana).toBe(0)
  })

  it('still functions correctly alongside sky striker trait (tailwind active)', () => {
    cast(pidgeotto, state, PIDGEOTTO_CAST)  // triggers tailwind + queues wing slaps
    expect(state.tailwind.player).toBe(true)
    const mods = pidgeotto.attackModifiers.filter(m => m.id === 'pidgeotto_wing_slap')
    expect(mods).toHaveLength(2)
  })
})

// ─── Wailord — Bounce ─────────────────────────────────────────────────────────

describe('Sky Striker — Wailord (Bounce)', () => {
  let wailord: Unit
  let noivern: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    wailord = makeUnit('wailord', 'player', 1)
    noivern = makeUnit('noivern', 'player', 1)
    enemy   = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    state   = makeState([wailord, noivern], [enemy])
    wailord.targetId = enemy.id
  })

  it('emits a cast event', () => {
    cast(wailord, state, WAILORD_CAST)
    expect(state.events.some(e => e.type === 'cast' && e.unitId === wailord.id)).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(wailord, state, WAILORD_CAST)
    expect(wailord.currentMana).toBe(0)
  })

  it('grants a shield on cast', () => {
    cast(wailord, state, WAILORD_CAST)
    expect(wailord.shields.length).toBeGreaterThan(0)
  })

  it('shield value is 75 (tier 1)', () => {
    cast(wailord, state, WAILORD_CAST)
    const bounceShield = wailord.shields.find(s => s.sourceAbility === 'wailord_bounce')
    expect(bounceShield?.value).toBe(75)
  })

  it('still functions correctly alongside sky striker trait (tailwind active)', () => {
    cast(wailord, state, WAILORD_CAST)
    expect(state.tailwind.player).toBe(true)
    expect(wailord.shields.length).toBeGreaterThan(0)
  })
})

// ─── Talonflame — Brave Bird ──────────────────────────────────────────────────

describe('Sky Striker — Talonflame (Brave Bird)', () => {
  let talonflame: Unit
  let noivern: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    talonflame = makeUnit('talonflame', 'player', 1)
    noivern    = makeUnit('noivern',    'player', 1)
    enemy      = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    state      = makeState([talonflame, noivern], [enemy])
    talonflame.targetId = enemy.id
  })

  it('emits a cast event', () => {
    cast(talonflame, state, TALONFLAME_CAST)
    expect(state.events.some(e => e.type === 'cast' && e.unitId === talonflame.id)).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(talonflame, state, TALONFLAME_CAST)
    expect(talonflame.currentMana).toBe(0)
  })

  it('enters leaping state after cast', () => {
    cast(talonflame, state, TALONFLAME_CAST)
    expect(talonflame.state).toBe('leaping')
  })

  it('still functions correctly alongside sky striker trait (tailwind active)', () => {
    cast(talonflame, state, TALONFLAME_CAST)
    expect(state.tailwind.player).toBe(true)
    expect(talonflame.state).toBe('leaping')
  })
})

// ─── Noivern — Boomburst ─────────────────────────────────────────────────────

describe('Sky Striker — Noivern (Boomburst)', () => {
  let noivern: Unit
  let pidgeotto: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    noivern   = makeUnit('noivern',   'player', 1)
    pidgeotto = makeUnit('pidgeotto', 'player', 1)
    enemy     = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    enemy.spDefense = 0
    enemy._computedStats = null
    state = makeState([noivern, pidgeotto], [enemy])
    // enemy lands at row 0 by default; move to row 2 so it's within boomburst range (≤3 rows from row 4)
    enemy.hexPos = { col: 0, row: 2 }
    noivern.targetId = enemy.id
  })

  it('emits a cast event', () => {
    cast(noivern, state, NOIVERN_CAST)
    expect(state.events.some(e => e.type === 'cast' && e.unitId === noivern.id)).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(noivern, state, NOIVERN_CAST)
    expect(noivern.currentMana).toBe(0)
  })

  it('emits boomburst_soundwave VFX', () => {
    cast(noivern, state, NOIVERN_CAST)
    expect(state.events.some(e => e.type === 'vfx' && (e as any).effectId === 'boomburst_soundwave')).toBe(true)
  })

  it('deals magic damage after delay (400 at tier 1)', () => {
    cast(noivern, state, NOIVERN_CAST)
    // Tick delayed damage effect
    for (let i = 0; i < 15; i++) tickStatusEffects(state.units, state)

    const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    expect(dmgEvent).toBeDefined()
    if (dmgEvent?.type === 'damage') expect(dmgEvent.amount).toBe(400)
  })

  it('activates tailwind on its own cast (2 sky strikers)', () => {
    cast(noivern, state, NOIVERN_CAST)
    expect(state.tailwind.player).toBe(true)
  })
})

// ─── Rayquaza — Dragon Ascent ────────────────────────────────────────────────

describe('Sky Striker — Rayquaza (Dragon Ascent)', () => {
  let rayquaza: Unit
  let noivern: Unit
  let enemy: Unit
  let state: CombatState

  beforeEach(() => {
    rayquaza = makeUnit('rayquaza', 'player', 1)
    noivern  = makeUnit('noivern',  'player', 1)
    enemy    = makeUnit('dummy', 'enemy', 1)
    enemy.maxHp = 10000
    enemy.currentHp = 10000
    state    = makeState([rayquaza, noivern], [enemy])
    rayquaza.targetId = enemy.id
  })

  it('emits a cast event', () => {
    cast(rayquaza, state, RAYQUAZA_CAST)
    expect(state.events.some(e => e.type === 'cast' && e.unitId === rayquaza.id)).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(rayquaza, state, RAYQUAZA_CAST)
    expect(rayquaza.currentMana).toBe(0)
  })

  it('enters ascended state after cast (grabs target and flies)', () => {
    cast(rayquaza, state, RAYQUAZA_CAST)
    expect(rayquaza.state).toBe('ascended')
  })

  it('activates tailwind on its own cast (2 sky strikers)', () => {
    cast(rayquaza, state, RAYQUAZA_CAST)
    expect(state.tailwind.player).toBe(true)
  })
})
