import { describe, it, expect } from 'vitest'
import { newRun, saveRun, loadRun, clearRun, freshPool, shopEligibleUnits, livingPlayers } from './runState'
import type { EconStorage } from './runState'
import { POOL_COPIES, STARTING_HP, STARTING_LEVEL, BENCH_SLOTS, SHOP_SLOTS } from './constants'

function fakeStorage(): EconStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v) },
    removeItem: k => { data.delete(k) },
  }
}

const BOT_SEATS = [
  { personaId: 'rilla', name: 'Rilla' },
  { personaId: 'kass',  name: 'Kass' },
  { personaId: 'echo',  name: 'Echo' },
  { personaId: 'brick', name: 'Brick' },
  { personaId: 'vex',   name: 'Vex' },
]

describe('runState', () => {
  it('freshPool covers every shop-eligible unit with cost-based copies', () => {
    const pool = freshPool()
    const units = shopEligibleUnits()
    expect(Object.keys(pool)).toHaveLength(units.length)
    for (const u of units) {
      expect(pool[u.id]).toBe(POOL_COPIES[u.cost])
    }
    // no dummies/summons/cliffs leak in
    expect(pool['dummy']).toBeUndefined()
    expect(pool['golett']).toBeUndefined()
    expect(pool['cliff_l']).toBeUndefined()
    expect(pool['substitutor_sub']).toBeUndefined()
  })

  it('newRun seats the human plus 5 bots with authentic TFT starts', () => {
    const run = newRun(BOT_SEATS)
    expect(run.players).toHaveLength(6)
    expect(run.players[0].name).toBe('You')
    expect(run.players[0].personaId).toBeNull()
    expect(run.players[1].personaId).toBe('rilla')
    for (const p of run.players) {
      expect(p.hp).toBe(STARTING_HP)
      expect(p.level).toBe(STARTING_LEVEL)
      expect(p.bench).toHaveLength(BENCH_SLOTS)
      expect(p.shop).toHaveLength(SHOP_SLOTS)
      expect(p.eliminated).toBe(false)
    }
    expect(run.round).toBe(1)
    expect(run.gameOver).toBeNull()
  })

  it('save/load roundtrip preserves state', () => {
    const storage = fakeStorage()
    const run = newRun(BOT_SEATS)
    run.players[0].gold = 34
    run.players[2].hp = 61
    run.pool['tangela'] -= 4
    run.round = 9
    saveRun(run, storage)

    const loaded = loadRun(storage)
    expect(loaded).not.toBeNull()
    expect(loaded!.players[0].gold).toBe(34)
    expect(loaded!.players[2].hp).toBe(61)
    expect(loaded!.pool['tangela']).toBe(POOL_COPIES[1] - 4)
    expect(loaded!.round).toBe(9)
  })

  it('corrupt or version-mismatched payloads load as null', () => {
    const storage = fakeStorage()
    storage.setItem('pokeTFT_run_v1', 'not json{{{')
    expect(loadRun(storage)).toBeNull()
    storage.setItem('pokeTFT_run_v1', JSON.stringify({ v: 999, state: {} }))
    expect(loadRun(storage)).toBeNull()
  })

  it('clearRun removes the saved run', () => {
    const storage = fakeStorage()
    saveRun(newRun(BOT_SEATS), storage)
    expect(loadRun(storage)).not.toBeNull()
    clearRun(storage)
    expect(loadRun(storage)).toBeNull()
  })

  it('livingPlayers excludes eliminated seats', () => {
    const run = newRun(BOT_SEATS)
    run.players[3].eliminated = true
    expect(livingPlayers(run)).toEqual([0, 1, 2, 4, 5])
  })
})
