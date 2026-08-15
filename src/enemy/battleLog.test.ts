import { describe, it, expect } from 'vitest'
import {
  loadBattleLog, saveBattleLog, appendBattle, MAX_RECORDS,
  type BattleRecord, type BattleStorage, type BoardFeat,
} from './battleLog'

function memStorage(): BattleStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) },
  }
}

function feat(bp = 100): BoardFeat {
  return { bp, tr: 20, t3: 0, c3: 1, n: 4, tk: 1 }
}

function rec(t = 1): BattleRecord {
  return { t, pf: feat(100), ef: feat(95), rawDelta: -0.05, predWin: 0.6, y: 1, margin: 0.4 }
}

describe('battleLog', () => {
  it('returns empty log with no storage', () => {
    expect(loadBattleLog(null)).toEqual([])
  })

  it('round-trips records through storage', () => {
    const s = memStorage()
    saveBattleLog([rec(1), rec(2)], s)
    const loaded = loadBattleLog(s)
    expect(loaded).toHaveLength(2)
    expect(loaded[1].t).toBe(2)
  })

  it('appendBattle grows the log and persists', () => {
    const s = memStorage()
    appendBattle(rec(1), s)
    appendBattle(rec(2), s)
    expect(loadBattleLog(s)).toHaveLength(2)
  })

  it('evicts oldest records past the cap', () => {
    const s = memStorage()
    const records: BattleRecord[] = []
    for (let i = 0; i < MAX_RECORDS; i++) records.push(rec(i))
    saveBattleLog(records, s)

    appendBattle(rec(9999), s)
    const loaded = loadBattleLog(s)
    expect(loaded).toHaveLength(MAX_RECORDS)
    expect(loaded[0].t).toBe(1)              // t=0 evicted
    expect(loaded[loaded.length - 1].t).toBe(9999)
  })

  it('recovers from corrupt JSON by returning empty log', () => {
    const s = memStorage()
    s.setItem('pokeTFT_battles_v1', '{not json!!')
    expect(loadBattleLog(s)).toEqual([])
  })

  it('rejects version-mismatched payloads', () => {
    const s = memStorage()
    s.setItem('pokeTFT_battles_v1', JSON.stringify({ v: 99, records: [rec(1)] }))
    expect(loadBattleLog(s)).toEqual([])
  })
})
