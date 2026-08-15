// Persistent ring buffer of user-vs-generated battle outcomes.
// Feeds the online calibration learner (calibration.ts) and lets a schema bump
// re-derive learned parameters by replaying the log.

import type { BoardProfile } from './boardPower'

// Compact board features stored per battle (small keys — localStorage budget)
export interface BoardFeat {
  bp: number   // basePower
  tr: number   // traitRaw
  t3: number   // tier3Power
  c3: number   // cost3Count
  n:  number   // unitCount
  tk: number   // tankCount
}

export interface BattleRecord {
  t: number            // Date.now() at combat end
  pf: BoardFeat        // player board features
  ef: BoardFeat        // enemy board features
  rawDelta: number     // legacy (enemyPower - playerPower) / playerPower
  predWin: number      // model P(playerWin) at combat start
  y: 0 | 0.5 | 1       // loss / draw / win (player perspective)
  margin: number       // winner's mean surviving HP fraction (0 for draw)
}

export interface BattleStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const LOG_KEY = 'pokeTFT_battles_v1'
const LOG_VERSION = 1
export const MAX_RECORDS = 300

function defaultStorage(): BattleStorage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function boardFeat(profile: BoardProfile): BoardFeat {
  return {
    bp: profile.basePower,
    tr: profile.traitRaw,
    t3: profile.tier3Power,
    c3: profile.cost3Count,
    n:  profile.unitCount,
    tk: profile.tankCount,
  }
}

export function loadBattleLog(storage: BattleStorage | null = defaultStorage()): BattleRecord[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (parsed?.v !== LOG_VERSION || !Array.isArray(parsed.records)) return []
    return parsed.records as BattleRecord[]
  } catch {
    return []
  }
}

export function saveBattleLog(records: BattleRecord[], storage: BattleStorage | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(LOG_KEY, JSON.stringify({ v: LOG_VERSION, records }))
  } catch {
    // localStorage full or unavailable — drop silently, learning continues in memory
  }
}

// Append one record, evicting the oldest past MAX_RECORDS. Returns the new log.
export function appendBattle(
  record: BattleRecord,
  storage: BattleStorage | null = defaultStorage(),
): BattleRecord[] {
  const records = loadBattleLog(storage)
  records.push(record)
  while (records.length > MAX_RECORDS) records.shift()
  saveBattleLog(records, storage)
  return records
}
