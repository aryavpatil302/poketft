import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { addStatusEffect } from '../systems/statusEffect'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

const CAST_TICKS = 24  // TAPUKOKO_RUMBLE_TICKS

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe("Tapu Koko - Nature's Madness", () => {
  let caster: Unit
  let e1: Unit  // struck target
  let e2: Unit  // nearest to e1
  let e3: Unit  // second nearest to e1
  let e4: Unit  // far away — chain must not reach
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('tapu_koko', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 3, row: 1 }
    e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 2, row: 1 }
    e4 = makeUnit('dummy', 'enemy', 1)
    e4.hexPos = { col: 0, row: 0 }
    state = createCombatState([caster], [e1, e2, e3, e4])
  })

  // ─── Combat-start passive setup ───────────────────────────────────────────

  it('registers the chain passive handler at combat start (before any cast)', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')
    expect(handler).toBeDefined()
  })

  it('registers a permanent Surge Surfer bolt visual modifier', () => {
    const mod = caster.attackModifiers.find(m => m.id === 'tapukoko_bolt_visual')
    expect(mod).toBeDefined()
    expect(mod!.visualId).toBe('tapukoko_bolt')
    expect(mod!.remainingCharges).toBe(Infinity)
  })

  it('sizes every 3rd bolt bigger via the visual modifier', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    const mod = caster.attackModifiers.find(m => m.id === 'tapukoko_bolt_visual')!

    caster.attackCount = 1
    handler.onAttack(caster, e1, state)
    expect(mod.visualId).toBe('tapukoko_bolt')

    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    expect(mod.visualId).toBe('tapukoko_bolt_big')
  })

  // ─── Shock Spirit / Electric Terrain ──────────────────────────────────────

  it('summons Electric Terrain at combat start (strongest Tapu fielded)', () => {
    expect(state.terrain.electric).toBe(true)
  })

  it('Electric Terrain grants allies 15% attack speed and 15% tenacity for 10s', () => {
    const as = caster.statusEffects.find(fx => fx.stackId === 'electric_terrain_as')
    const ten = caster.statusEffects.find(fx => fx.stackId === 'electric_terrain_tenacity')
    expect(as?.magnitude).toBeCloseTo(0.15)
    expect(as?.durationTicks).toBe(10 * TICK_RATE)
    expect(ten?.magnitude).toBeCloseTo(0.15)
    expect(ten?.durationTicks).toBe(10 * TICK_RATE)
  })

  it('Electric Terrain buffs do not apply to enemy units', () => {
    expect(e1.statusEffects.some(fx => fx.stackId === 'electric_terrain_as')).toBe(false)
  })

  it('tenacity shortens incoming CC durations by 15%', () => {
    addStatusEffect(caster, {
      id: 'stun',
      sourceUnitId: e1.id,
      durationTicks: 60,
      stackId: 'test_stun',
    })
    const stun = caster.statusEffects.find(fx => fx.stackId === 'test_stun')
    expect(stun?.durationTicks).toBe(51)  // 60 × (1 − 0.15)
  })

  // ─── Passive: chain lightning every 3rd attack ────────────────────────────

  it('3rd attack launches an invisible chain-carrier projectile', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    const carrier = [...state.projectiles.values()].find(p => p.abilityId === 'tapukoko_chain_carrier')
    expect(carrier).toBeDefined()
  })

  it('non-3rd attacks do not launch a chain carrier', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 2
    handler.onAttack(caster, e1, state)
    expect([...state.projectiles.values()].some(p => p.abilityId === 'tapukoko_chain_carrier')).toBe(false)
  })

  it('chain hits the struck target plus the 2 nearest other enemies for 40% attack magic damage', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    const carrier = [...state.projectiles.values()].find(p => p.abilityId === 'tapukoko_chain_carrier')!

    const hp1 = e1.currentHp, hp2 = e2.currentHp, hp3 = e3.currentHp, hp4 = e4.currentHp
    state.events = []
    carrier.onHit!(caster, e1, state)

    expect(e1.currentHp).toBeLessThan(hp1)
    expect(e2.currentHp).toBeLessThan(hp2)
    expect(e3.currentHp).toBeLessThan(hp3)
    expect(e4.currentHp).toBe(hp4)  // out of chain range

    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents).toHaveLength(3)
    for (const e of dmgEvents) {
      if (e.type === 'damage') expect(e.damageType).toBe('magic')
    }
  })

  it('passive chain does not stun', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    const carrier = [...state.projectiles.values()].find(p => p.abilityId === 'tapukoko_chain_carrier')!
    carrier.onHit!(caster, e1, state)
    expect(e1.statusEffects.some(fx => fx.id === 'stun')).toBe(false)
  })

  it('emits a tapukoko_chain vfx event out of every unit hit', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    const carrier = [...state.projectiles.values()].find(p => p.abilityId === 'tapukoko_chain_carrier')!
    state.events = []
    carrier.onHit!(caster, e1, state)
    const vfx = state.events.filter(e => e.type === 'vfx' && e.effectId === 'tapukoko_chain')
    expect(vfx).toHaveLength(3)
  })

  it('vfx bolts originate from the struck unit for every chained (non-struck) target', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    const carrier = [...state.projectiles.values()].find(p => p.abilityId === 'tapukoko_chain_carrier')!
    state.events = []
    carrier.onHit!(caster, e1, state)
    const vfx = state.events.filter(e => e.type === 'vfx' && e.effectId === 'tapukoko_chain')
    for (const ev of vfx) {
      if (ev.type !== 'vfx' || ev.effectId !== 'tapukoko_chain') continue
      expect(ev.fromX).toBe(e1.visualPos.x)
      expect(ev.fromY).toBe(e1.visualPos.y)
    }
  })

  it('chain cannot jump to enemies beyond a 2-hex radius of the struck unit', () => {
    // e5 sits just outside the 2-hex chain radius from e1 (3,2) but would
    // otherwise be the closest unclaimed target after e2/e3
    const e5 = makeUnit('dummy', 'enemy', 1)
    e5.hexPos = { col: 3, row: 5 }  // hexDistance from (3,2) = 3
    state.units.set(e5.id, e5)
    state.hexOccupancy.set('3,5', e5.id)

    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    const carrier = [...state.projectiles.values()].find(p => p.abilityId === 'tapukoko_chain_carrier')!

    const hp5 = e5.currentHp
    carrier.onHit!(caster, e1, state)
    expect(e5.currentHp).toBe(hp5)
  })

  it('chain can jump to an enemy exactly at 2-hex radius', () => {
    // Replace e2/e3 with a single enemy exactly 2 hexes from e1
    const state2 = createCombatState(
      [makeUnit('tapu_koko', 'player', 1)],
      [e1, (() => { const u = makeUnit('dummy', 'enemy', 1); u.hexPos = { col: 3, row: 0 }; return u })()],
    )
    const koko = [...state2.units.values()].find(u => u.team === 'player')!
    koko.hexPos = { col: 3, row: 5 }
    const struck = [...state2.units.values()].find(u => u.hexPos.col === 3 && u.hexPos.row === 2)!
    const farEnemy = [...state2.units.values()].find(u => u.hexPos.row === 0)!

    const handler = koko.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    koko.attackCount = 3
    handler.onAttack(koko, struck, state2)
    const carrier = [...state2.projectiles.values()].find(p => p.abilityId === 'tapukoko_chain_carrier')!

    const hp = farEnemy.currentHp
    carrier.onHit!(koko, struck, state2)
    expect(farEnemy.currentHp).toBeLessThan(hp)
  })

  // ─── Cast: surge empowerment ──────────────────────────────────────────────

  it('enters casting state with the quick 24-tick rumble timer', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(CAST_TICKS)
  })

  it('can start autoing again right after the rumble (attackTimer = 0)', () => {
    cast(caster, state)
    expect(caster.attackTimer).toBe(0)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('unshifts a 1-charge surge modifier in front of the visual modifier', () => {
    cast(caster, state)
    expect(caster.attackModifiers[0]?.id).toBe('tapukoko_surge')
    expect(caster.attackModifiers[0]?.remainingCharges).toBe(1)
    expect(caster.attackModifiers[1]?.id).toBe('tapukoko_bolt_visual')
  })

  it('empowered bolt is the fast blue variant', () => {
    cast(caster, state)
    const mod = caster.attackModifiers[0]!
    expect(mod.visualId).toBe('tapukoko_bolt_surge')
    expect(mod.projectileSpeed).toBe(18)
  })

  it('empowered hit stuns and deals chain + bonus damage to all enemies hit', () => {
    cast(caster, state)
    const mod = caster.attackModifiers[0]!
    const hp1 = e1.currentHp
    state.events = []
    mod.onHit!(caster, e1, state)

    expect(e1.currentHp).toBeLessThan(hp1)
    // struck + 2 chained, all stunned for 1s (dummies have no tenacity)
    for (const t of [e1, e2, e3]) {
      const stun = t.statusEffects.find(fx => fx.id === 'stun')
      expect(stun).toBeDefined()
      expect(stun!.durationTicks).toBe(1 * TICK_RATE)
    }
    expect(e4.statusEffects.some(fx => fx.id === 'stun')).toBe(false)

    // Tier 1: (40% + 250%) of attack, pre-mitigation
    const stats = computeStats(caster)
    const expectedRaw = Math.round(stats.attack * 0.40) + Math.round(stats.attack * 2.50)
    const dmgEvents = state.events.filter(e => e.type === 'damage')
    expect(dmgEvents).toHaveLength(3)
    if (dmgEvents[0]?.type === 'damage') {
      expect(dmgEvents[0].amount).toBeGreaterThan(0)
      expect(dmgEvents[0].amount).toBeLessThanOrEqual(expectedRaw)
    }
  })

  it('passive chain defers to the surge modifier (no double chain on the empowered auto)', () => {
    cast(caster, state)
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 3
    handler.onAttack(caster, e1, state)
    expect([...state.projectiles.values()].some(p => p.abilityId === 'tapukoko_chain_carrier')).toBe(false)
  })

  // ─── Cast: attack speed per auto under Electric Terrain ───────────────────

  it('after casting, each auto stacks attack speed while Electric Terrain is active', () => {
    cast(caster, state)  // terrain already electric from combat start
    const charged = caster.statusEffects.find(fx => fx.stackId === 'tapukoko_surge_charged')
    expect(charged?.magnitude).toBeCloseTo(0.03)  // tier 1: 3% per auto

    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackModifiers.shift()  // consume the surge modifier out of the way
    caster.attackCount = 1
    handler.onAttack(caster, e1, state)
    caster.attackCount = 2
    handler.onAttack(caster, e1, state)

    const stacks = caster.statusEffects.filter(fx => fx.stackId?.startsWith('tapukoko_as_'))
    expect(stacks).toHaveLength(2)
    expect(stacks[0].magnitude).toBeCloseTo(0.03)
  })

  it('does not stack attack speed before casting', () => {
    const handler = caster.passiveAttackHandlers.find(h => h.id === 'tapukoko_chain')!
    caster.attackCount = 1
    handler.onAttack(caster, e1, state)
    expect(caster.statusEffects.some(fx => fx.stackId?.startsWith('tapukoko_as_'))).toBe(false)
  })

  it('tier 3 grants 20% attack speed per auto', () => {
    const koko3 = makeUnit('tapu_koko', 'player', 3)
    koko3.hexPos = { col: 3, row: 5 }
    const foe = makeUnit('dummy', 'enemy', 1)
    foe.hexPos = { col: 3, row: 2 }
    const st = createCombatState([koko3], [foe])
    cast(koko3, st)
    const charged = koko3.statusEffects.find(fx => fx.stackId === 'tapukoko_surge_charged')
    expect(charged?.magnitude).toBeCloseTo(0.20)
  })
})
