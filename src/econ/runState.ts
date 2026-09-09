// Run state for the TFT-style meta game: the human player plus 5 persistent
// bot opponents, all drawing from one shared unit pool. Persisted to
// localStorage under a versioned envelope (pattern from enemy/battleLog.ts).

import { ALL_UNITS } from '../data/units'
import {
  BENCH_SLOTS, SHOP_SLOTS, POOL_COPIES,
  STARTING_HP, STARTING_GOLD, STARTING_LEVEL, PLAYER_COUNT,
} from './constants'

export interface BenchedUnit {
  definitionId: string
  tier: 1 | 2 | 3
  item?: string   // equipped item id (one per unit)
  isShiny?: boolean   // instant 2★ shop offer; zero-migration like item above
  chosenTrait?: string   // TFT "Chosen" trait, picked once at shiny-roll time; zero-migration like isShiny above
}

export interface BoardEntry {
  definitionId: string
  tier: 1 | 2 | 3
  hexPos: { col: number; row: number }   // player-half coords (rows 4-7)
  item?: string   // equipped item id (one per unit)
  isShiny?: boolean   // instant 2★ shop offer; zero-migration like item above
  chosenTrait?: string   // TFT "Chosen" trait, picked once at shiny-roll time; zero-migration like isShiny above
}

// One seat at the table — the human and every bot share this shape so the
// shop/xp/income/combine modules operate identically on all of them.
export interface PlayerEcon {
  name: string
  personaId: string | null   // null = the human
  hp: number
  gold: number
  pendingIncome: number      // income earned last round, banked at the start of the next planning phase (human only)
  level: number
  xp: number
  streak: number             // positive = win streak, negative = loss streak
  bench: (BenchedUnit | null)[]
  board: BoardEntry[]
  itemBench: string[]        // uncommitted items (the item bench inventory)
  shop: (string | null)[]    // definitionId per slot; null = bought/empty
  shopShiny: boolean[]       // parallel to shop, same length; true = that slot's offer is shiny
  shopShinyTrait: (string | null)[]   // parallel to shop/shopShiny; the chosen trait rolled for that slot's shiny offer, or null
  // Shop rolls since the last Chosen offer, counted ONLY while a shiny is
  // owned (see hasShinyOwned) — TFT's real rule: "while you have a Chosen,
  // one appears every 4 shops" (guaranteed pity), replacing the probabilistic
  // roll used while none is owned. Invariant: reset to 0 whenever
  // hasShinyOwned(econ) is false, so it always starts fresh at 0 the next
  // time a shiny is picked up (rather than carrying over stale progress from
  // a previous shiny that was sold/lost). See src/econ/shop.ts's rollShop.
  shinyPityCounter: number
  // Bad-luck protection: maps a definitionId to the number of remaining
  // shop refreshes it is excluded from being picked as the shiny candidate
  // for — set whenever a Chosen offer is passed on (shop refreshes with it
  // still unbought), decremented by 1 on every rollShop call and removed
  // once it reaches 0. Independent of shinyPityCounter — see
  // SHINY_EXCLUSION_SHOPS and src/econ/shop.ts's rollShop.
  shinyExclusion: Record<string, number>
  shopLocked: boolean
  eliminated: boolean
  cliffPositions?: Record<string, { col: number; row: number }>   // human only: remembered Ascender pillar hexes
  // The seat this one faces next round, announced at the end of the previous
  // round by src/game/round.ts's resolveRound; -1 means a bye or no living
  // rival. Optional so pre-Phase-2 saves back-fill via loadRun below.
  nextOpponent?: number
}

export interface RunState {
  round: number
  pool: Record<string, number>   // definitionId → copies remaining (SHARED)
  players: PlayerEcon[]          // [0] = human, [1..5] = bots
  // LEGACY: superseded by PlayerEcon.nextOpponent (per-seat, mutually
  // consistent, computed by resolveRound). The round engine in
  // src/game/round.ts never reads this field — it is left in place only
  // because src/main.ts's inline round loop still writes/reads it until
  // Plan 05 rewires main.ts and Phase 3 owns the round loop entirely, at
  // which point this field is removed.
  nextOpponent: number           // players index the human faces this round
  gameOver: 'win' | 'loss' | null
}

export interface EconStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

const RUN_KEY = 'pokeTFT_run_v1'
const RUN_VERSION = 1

function defaultStorage(): EconStorage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

// Shop/pool-eligible units — same predicate the enemy generator uses
export function shopEligibleUnits() {
  return ALL_UNITS.filter(u => !u.isDummy && u.cost > 0)
}

export function freshPool(): Record<string, number> {
  const pool: Record<string, number> = {}
  for (const def of shopEligibleUnits()) {
    pool[def.id] = POOL_COPIES[def.cost] ?? 0
  }
  return pool
}

export function emptyEcon(name: string, personaId: string | null): PlayerEcon {
  return {
    name,
    personaId,
    hp: STARTING_HP,
    gold: STARTING_GOLD,
    pendingIncome: 0,
    level: STARTING_LEVEL,
    xp: 0,
    streak: 0,
    bench: Array(BENCH_SLOTS).fill(null),
    board: [],
    itemBench: [],
    shop: Array(SHOP_SLOTS).fill(null),
    shopShiny: Array(SHOP_SLOTS).fill(false),
    shopShinyTrait: Array(SHOP_SLOTS).fill(null),
    shinyPityCounter: 0,
    shinyExclusion: {},
    shopLocked: false,
    eliminated: false,
    cliffPositions: {},
    nextOpponent: -1,
  }
}

// Persona ids/names are defined in bots.ts; newRun receives them so this
// module stays free of bot logic.
export function newRun(botSeats: Array<{ personaId: string; name: string }>): RunState {
  const players: PlayerEcon[] = [emptyEcon('You', null)]
  for (const seat of botSeats.slice(0, PLAYER_COUNT - 1)) {
    players.push(emptyEcon(seat.name, seat.personaId))
  }
  // Items are earned in-run from Delibird item rounds (see creeps.ts / main.ts),
  // not granted up front.
  return {
    round: 1,
    pool: freshPool(),
    players,
    nextOpponent: 1,
    gameOver: null,
  }
}

export function saveRun(state: RunState, storage: EconStorage | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(RUN_KEY, JSON.stringify({ v: RUN_VERSION, state }))
  } catch { /* quota/serialization failures must never break the game */ }
}

export function loadRun(storage: EconStorage | null = defaultStorage()): RunState | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(RUN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.v !== RUN_VERSION || !parsed.state?.players?.length) return null
    // Migrate saves from before the item system — itemBench must be an array.
    for (const p of parsed.state.players) if (!Array.isArray(p.itemBench)) p.itemBench = []
    // Migrate saves from before deferred income.
    for (const p of parsed.state.players) if (typeof p.pendingIncome !== 'number') p.pendingIncome = 0
    // Migrate saves from before remembered Ascender pillar positions.
    for (const p of parsed.state.players) if (typeof p.cliffPositions !== 'object' || p.cliffPositions === null) p.cliffPositions = {}
    // Migrate saves from before the per-seat next-opponent announcement.
    for (const p of parsed.state.players) if (typeof p.nextOpponent !== 'number') p.nextOpponent = -1
    // Migrate saves from before the shiny shop-slot flag array.
    for (const p of parsed.state.players) if (!Array.isArray(p.shopShiny)) p.shopShiny = Array(SHOP_SLOTS).fill(false)
    // Migrate saves from before the Chosen-trait shop-slot array and pity counter.
    for (const p of parsed.state.players) if (!Array.isArray(p.shopShinyTrait)) p.shopShinyTrait = Array(SHOP_SLOTS).fill(null)
    for (const p of parsed.state.players) if (typeof p.shinyPityCounter !== 'number') p.shinyPityCounter = 0
    // Migrate saves from before the shiny species cooldown.
    for (const p of parsed.state.players) if (!p.shinyExclusion || typeof p.shinyExclusion !== 'object') p.shinyExclusion = {}
    return parsed.state as RunState
  } catch {
    return null
  }
}

export function clearRun(storage: EconStorage | null = defaultStorage()): void {
  if (!storage) return
  try {
    if (storage.removeItem) storage.removeItem(RUN_KEY)
    else storage.setItem(RUN_KEY, '')
  } catch { /* ignore */ }
}

// Living players (not eliminated)
export function livingPlayers(state: RunState): number[] {
  return state.players.map((p, i) => [p, i] as const).filter(([p]) => !p.eliminated).map(([, i]) => i)
}
