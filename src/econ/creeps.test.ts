import { describe, it, expect } from 'vitest'
import { makeUnit } from '../core/unitFactory'
import { createCombatState, runCombat } from '../core/combatEngine'
import type { Unit } from '../core/types'
import { CREEP_ROUNDS, isCreepRound, isItemRound, rollItemChoices, autoPickItemChoice, CREEP_ROUND_COUNT } from './creeps'
import { ITEM_MAP } from '../data/items'
import { shopEligibleUnits } from './runState'
import '../core/systems/ability'   // register ability handlers

function creepEnemies(round: number): Unit[] {
  return CREEP_ROUNDS[round].spawns.map(s => {
    const u = makeUnit(s.definitionId, 'enemy', s.tier)
    u.hexPos = { col: s.col, row: s.row }
    return u
  })
}

function playerUnit(defId: string, col: number, row: number): Unit {
  const u = makeUnit(defId, 'player', 1)
  u.hexPos = { col, row }
  return u
}

describe('creep rounds — round classification', () => {
  it('rounds 1-2 are creep fights, round 3 is the item round, round 4 is first PvP', () => {
    expect(isCreepRound(1)).toBe(true)
    expect(isCreepRound(2)).toBe(true)
    expect(isCreepRound(3)).toBe(false)   // round 3 is the Delibird item round, not a fight
    expect(isItemRound(3)).toBe(true)
    expect(isCreepRound(CREEP_ROUND_COUNT + 1)).toBe(false)   // round 4 = first PvP
    expect(isItemRound(CREEP_ROUND_COUNT + 1)).toBe(false)
    expect(isCreepRound(0)).toBe(false)
  })

  it('Delibird rounds are 3, then the last round of each 6-round stage (9, 15, 21)', () => {
    expect(isItemRound(3)).toBe(true)     // 1-3 opener
    expect(isItemRound(9)).toBe(true)     // 2-6
    expect(isItemRound(15)).toBe(true)    // 3-6
    expect(isItemRound(21)).toBe(true)    // 4-6
    // Everything in between is combat
    for (const r of [1, 2, 4, 5, 6, 7, 8, 10, 14, 16, 20]) {
      expect(isItemRound(r)).toBe(false)
    }
  })

  it('rollItemChoices returns distinct real (icon-bearing) items', () => {
    const picks = rollItemChoices([], () => 0.5, 3)
    expect(picks).toHaveLength(3)
    expect(new Set(picks).size).toBe(3)   // distinct
  })

  it('rollItemChoices never offers an item the player already owns', () => {
    const owned = ['metronome', 'sitrus_berry', 'spell_tag']
    for (let i = 0; i < 30; i++) {
      const picks = rollItemChoices(owned, Math.random, 3)
      for (const p of picks) expect(owned).not.toContain(p)
    }
  })

  it('rollItemChoices favours a spread of archetypes', () => {
    // With nothing owned, the 3 picks should cover several distinct archetypes
    // (items can suit more than one).
    const cats = new Set<string>()
    for (const id of rollItemChoices([], () => 0.5, 3)) {
      for (const c of ITEM_MAP.get(id)!.categories ?? []) cats.add(c)
    }
    expect(cats.size).toBeGreaterThanOrEqual(3)
  })

  it('rollItemChoices falls back to the full pool when everything is owned', () => {
    const all = rollItemChoices([], () => 0.5, 99)   // every offerable item id
    const picks = rollItemChoices(all, () => 0.5, 3)
    expect(picks.length).toBeGreaterThan(0)   // never empty → no soft-lock
  })
})

describe('autoPickItemChoice — item-round deadline fallback', () => {
  it('returns undefined for an empty array', () => {
    expect(autoPickItemChoice([], () => 0.5)).toBeUndefined()
  })

  it('picks the first element when rng returns 0', () => {
    expect(autoPickItemChoice(['a', 'b', 'c'], () => 0)).toBe('a')
  })

  it('picks the last element when rng returns just under 1', () => {
    expect(autoPickItemChoice(['a', 'b', 'c'], () => 0.99)).toBe('c')
  })

  it('clamps to the last element when a degenerate rng returns exactly 1', () => {
    expect(autoPickItemChoice(['a', 'b', 'c'], () => 1)).toBe('c')
  })

  it('with the real Math.random every draw is a member and all three appear over 300 draws', () => {
    const choices = ['a', 'b', 'c']
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const pick = autoPickItemChoice(choices)
      expect(pick).toBeDefined()
      expect(choices).toContain(pick)
      seen.add(pick!)
    }
    expect(seen.size).toBe(3)
  })
})

describe('creep round 1 — every 1-cost solos it and survives', () => {
  const oneCosts = shopEligibleUnits().filter(u => u.cost === 1).map(u => u.id)

  it.each(oneCosts)('%s clears three Diglett and lives', (defId) => {
    const player = playerUnit(defId, 3, 6)
    const state = createCombatState([player], creepEnemies(1))
    const result = runCombat(state, { maxTicks: 3000 })
    expect(result.winner).toBe('player')
    expect(player.state).not.toBe('dead')
    expect(player.currentHp).toBeGreaterThan(0)
  })
})

describe('creep round 2 — any two units clear the Slowbro pair and survive', () => {
  const combos: Array<[string, string]> = [
    ['tangela', 'tangela'],     // two tanks
    ['ribombee', 'ribombee'],   // two squishy ranged casters
    ['tangela', 'pidgeotto'],   // mixed melee + ranged
  ]

  it.each(combos)('%s + %s win and both live', (a, b) => {
    const u1 = playerUnit(a, 2, 6)
    const u2 = playerUnit(b, 4, 6)
    const state = createCombatState([u1, u2], creepEnemies(2))
    const result = runCombat(state, { maxTicks: 3000 })
    expect(result.winner).toBe('player')
    expect(u1.state).not.toBe('dead')
    expect(u2.state).not.toBe('dead')
  })
})
