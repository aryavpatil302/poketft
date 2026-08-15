// XP / leveling. Level doubles as the board-unit cap.

import type { PlayerEcon } from './runState'
import { XP_TO_NEXT, XP_BUY_COST, XP_BUY_AMOUNT, MAX_LEVEL } from './constants'

// XP needed to advance from the given level (null at cap)
export function xpToNext(level: number): number | null {
  if (level >= MAX_LEVEL) return null
  return XP_TO_NEXT[level - 1]
}

// Add xp, resolving any number of level-ups. Returns levels gained.
// XP overflows into the next level; at MAX_LEVEL surplus xp is discarded.
export function grantXp(econ: PlayerEcon, amount: number): number {
  let gained = 0
  econ.xp += amount
  while (econ.level < MAX_LEVEL) {
    const need = XP_TO_NEXT[econ.level - 1]
    if (econ.xp < need) break
    econ.xp -= need
    econ.level++
    gained++
  }
  if (econ.level >= MAX_LEVEL) econ.xp = 0
  return gained
}

// Buy 4 XP for 4 gold. Returns false when unaffordable or already at cap.
export function buyXp(econ: PlayerEcon): boolean {
  if (econ.level >= MAX_LEVEL) return false
  if (econ.gold < XP_BUY_COST) return false
  econ.gold -= XP_BUY_COST
  grantXp(econ, XP_BUY_AMOUNT)
  return true
}

// Max units allowed on the board
export function boardCap(econ: PlayerEcon): number {
  return econ.level
}
