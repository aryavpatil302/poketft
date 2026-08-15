import type { RunState, PlayerEcon } from './runState'
import type { Rng } from './shop'
import { tryCombine } from './combine'
import { ALL_UNITS, UNIT_MAP } from '../data/units'
import {
  CRAWLER_SPAWN_MIN_SPECIES, CRAWLER_SPAWN_BASE, CRAWLER_SPAWN_PER_STARPOINT, CRAWLER_SPAWN_MAX,
  CRAWLER_GOLD_MIN_SPECIES, CRAWLER_GOLD_CHANCE, CRAWLER_GOLD_MIN, CRAWLER_GOLD_MAX,
  CRAWLER_COST_WEIGHT,
} from './constants'

// Every cave-crawler species, precomputed once.
const CRAWLER_IDS: string[] = ALL_UNITS.filter(u => u.types.includes('cave_crawler')).map(u => u.id)

function crawlerCostWeight(defId: string): number {
  const cost = UNIT_MAP.get(defId)?.cost ?? 3
  return CRAWLER_COST_WEIGHT[cost] ?? 1
}

// Cost-weighted random pick among crawler species that still have pool copies.
// Returns null if the pool is dry for every crawler species.
function pickCrawlerFromPool(state: RunState, rng: Rng): string | null {
  const available = CRAWLER_IDS.filter(id => (state.pool[id] ?? 0) > 0)
  if (available.length === 0) return null
  const weights = available.map(crawlerCostWeight)
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (let i = 0; i < available.length; i++) {
    roll -= weights[i]
    if (roll < 0) return available[i]
  }
  return available[available.length - 1]   // FP fallback
}

/**
 * Roll the reworked Cave Crawler earthquake rewards for one seat after a combat.
 *
 * Called once per fight with how many earthquakes this seat's crawlers fired
 * (`quakeCount`); each quake is an independent roll. Mutates `econ.bench`,
 * `econ.gold`, and the shared `state.pool`. Same helper for the human and bots.
 *
 *  - (3+ crawler species) each quake may drop a random crawler on the bench,
 *    cost-weighted so cheap crawlers are far more common; drawn from the shared
 *    pool (fizzles if the pool is dry or the bench is full).
 *  - (5+ crawler species) each quake may also grant 1-5 gold.
 */
export function rollCrawlerEarthquakeRewards(
  state: RunState,
  econ: PlayerEcon,
  quakeCount: number,
  rng: Rng = Math.random,
): { spawned: string[]; spawnedSlots: number[]; gold: number } {
  const spawned: string[] = []
  const spawnedSlots: number[] = []   // bench slot each crawler landed in (for the spawn animation)
  let gold = 0
  if (quakeCount <= 0) return { spawned, spawnedSlots, gold }

  const species = new Set(
    econ.board.filter(e => (UNIT_MAP.get(e.definitionId)?.types ?? []).includes('cave_crawler'))
      .map(e => e.definitionId),
  ).size
  if (species < CRAWLER_SPAWN_MIN_SPECIES) return { spawned, spawnedSlots, gold }

  const starPoints = econ.board
    .filter(e => (UNIT_MAP.get(e.definitionId)?.types ?? []).includes('cave_crawler'))
    .reduce((sum, e) => sum + Math.pow(3, e.tier - 1), 0)
  const spawnChance = Math.min(CRAWLER_SPAWN_MAX, CRAWLER_SPAWN_BASE + CRAWLER_SPAWN_PER_STARPOINT * starPoints)
  const goldActive = species >= CRAWLER_GOLD_MIN_SPECIES

  for (let q = 0; q < quakeCount; q++) {
    // Bench spawn
    if (rng() < spawnChance) {
      const slot = econ.bench.findIndex(b => b === null)
      if (slot !== -1) {
        const id = pickCrawlerFromPool(state, rng)
        if (id) {
          state.pool[id]--
          econ.bench[slot] = { definitionId: id, tier: 1 }
          tryCombine(econ, id)   // a 3rd copy merges to 2★, exactly like a buy
          spawned.push(id)
          spawnedSlots.push(slot)
        }
      }
    }
    // Gold
    if (goldActive && rng() < CRAWLER_GOLD_CHANCE) {
      const g = CRAWLER_GOLD_MIN + Math.floor(rng() * (CRAWLER_GOLD_MAX - CRAWLER_GOLD_MIN + 1))
      econ.gold += g
      gold += g
    }
  }

  return { spawned, spawnedSlots, gold }
}
