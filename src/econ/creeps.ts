// Creep (PvE) rounds — the opening rounds of a run, TFT-style: before players
// ever fight each other they clear a few rounds of neutral monsters, picking up
// gold + XP so everyone is ~level 3 by the first PvP match.
//
// Each round defines a fixed enemy board (spawned on the enemy rows 0-3). The
// creep unit definitions live in src/data/units.ts (cost 0, no abilities).
//
// Round 3 is NOT a fight — it's the Delibird item round (a TFT-style carousel):
// no combat, the player instead picks one of three offered items. Item rounds
// also recur at the start of every later stage (see isItemRound).

import { ALL_ITEMS } from '../data/items'
import type { ItemDefinition } from '../core/types'
import type { Rng } from './shop'

export interface CreepSpawn {
  definitionId: string
  tier: 1 | 2 | 3
  col: number
  row: number   // enemy rows are 0-3 (0 = back, 3 = front, adjacent to the player)
}

export interface CreepRoundDef {
  name: string        // shown in the round indicator, e.g. "vs Diglett Trio"
  spawns: CreepSpawn[]
}

// How many opening rounds are PvE. Rounds 1..CREEP_ROUND_COUNT are creeps; the
// first player-vs-player round is CREEP_ROUND_COUNT + 1.
export const CREEP_ROUND_COUNT = 3

export const CREEP_ROUNDS: Record<number, CreepRoundDef> = {
  // Round 1 — three weak Diglett spread across the front enemy row. Any single
  // 1-cost survives and clears them.
  1: {
    name: 'Diglett Trio',
    spawns: [
      { definitionId: 'creep_diglett', tier: 1, col: 1, row: 3 },
      { definitionId: 'creep_diglett', tier: 1, col: 3, row: 3 },
      { definitionId: 'creep_diglett', tier: 1, col: 5, row: 3 },
    ],
  },
  // Round 2 — a Slowbro (weak melee tank) up front and a Galarian Slowbro (weak
  // ranged) behind it. Any two units clear them comfortably.
  2: {
    name: 'Slowbro Pair',
    spawns: [
      { definitionId: 'creep_slowbro',   tier: 1, col: 3, row: 3 },
      { definitionId: 'creep_g_slowbro', tier: 1, col: 3, row: 1 },
    ],
  },
  // Round 3 is the Delibird item round — no combat board here (see isItemRound).
}

// ─── Item (Delibird) rounds ───────────────────────────────────────────────────

// Delibird item rounds: round 3 (the 1-3 opener), then the last round of every
// later stage — rounds 9, 15, 21, … (each stage after the first is 6 rounds, so
// they land every 6 from round 3). These rounds are non-combat: pick one item.
export function isItemRound(round: number): boolean {
  return round >= 3 && (round - 3) % 6 === 0
}

// Item rounds only offer the "real" combined items — the ones with an icon
// (metronome, sitrus, assault vest, …), never the raw stat components.
export function itemRoundPool(): ItemDefinition[] {
  return ALL_ITEMS.filter(i => i.iconPath)
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Pick `count` distinct items to offer this Delibird round.
//   • never offer an item the player already has (`owned`), and
//   • favour a fair spread of archetypes — the first pass takes items that cover
//     an archetype not yet represented (items can suit several), then any
//     remaining slots are filled from what's left.
// If the player owns every offerable item, we fall back to the full pool so the
// tray is never empty.
export function rollItemChoices(owned: string[] = [], rng: Rng = Math.random, count = 3): string[] {
  const ownedSet = new Set(owned)
  let pool = itemRoundPool().filter(i => !ownedSet.has(i.id))
  if (pool.length === 0) pool = itemRoundPool()
  shuffle(pool, rng)

  const chosen: ItemDefinition[] = []
  const covered = new Set<string>()
  // Pass 1 — prefer items that introduce an archetype not yet on offer.
  for (const it of pool) {
    if (chosen.length >= count) break
    const cats = it.categories ?? ['other']
    if (cats.some(c => !covered.has(c))) {
      chosen.push(it)
      for (const c of cats) covered.add(c)
    }
  }
  // Pass 2 — fill remaining slots from whatever's left.
  for (const it of pool) {
    if (chosen.length >= count) break
    if (!chosen.includes(it)) chosen.push(it)
  }
  return chosen.map(i => i.id)
}

// What the item-round deadline falls back to when the player never chooses:
// a uniform random pick over whatever three ids are currently on the tray.
export function autoPickItemChoice(choices: string[], rng: Rng = Math.random): string | undefined {
  if (choices.length === 0) return undefined
  // Clamp to the last index so a degenerate rng returning exactly 1 cannot
  // walk off the end of the array and silently resolve to undefined.
  const idx = Math.min(choices.length - 1, Math.floor(rng() * choices.length))
  return choices[idx]
}

// Combat creep rounds are the opening PvE fights (rounds 1..CREEP_ROUND_COUNT)
// EXCLUDING item rounds (round 3), which have no board.
export function isCreepRound(round: number): boolean {
  return round >= 1 && round <= CREEP_ROUND_COUNT && !isItemRound(round)
}

export function creepRoundDef(round: number): CreepRoundDef | undefined {
  return CREEP_ROUNDS[round]
}
