// End-of-round settlement: income (base + interest + streak + win), passive
// XP, streak bookkeeping, HP loss, and elimination.

import type { PlayerEcon } from './runState'
import {
  BASE_INCOME_BY_ROUND, BASE_INCOME_CAP, MAX_INTEREST, WIN_BONUS,
  XP_PER_ROUND, streakBonus, hpLoss,
} from './constants'
import { grantXp } from './xp'

export interface RoundResult {
  won: boolean
  draw: boolean
  survivorStars: number    // sum of surviving enemy units' star levels (drives HP loss)
  round: number            // the round that was just played
}

export interface Settlement {
  base: number
  interest: number
  streakGold: number
  winGold: number
  total: number
  xpGained: number
  levelsGained: number
  hpLost: number
  newStreak: number
  eliminated: boolean
}

export function settleRound(econ: PlayerEcon, result: RoundResult): Settlement {
  // Streak update first — the streak gold below pays on the NEW streak,
  // matching TFT (a 3rd straight win pays the streak bonus that round).
  if (result.draw) {
    econ.streak = 0
  } else if (result.won) {
    econ.streak = econ.streak > 0 ? econ.streak + 1 : 1
  } else {
    econ.streak = econ.streak < 0 ? econ.streak - 1 : -1
  }

  const base = BASE_INCOME_BY_ROUND[result.round - 1] ?? BASE_INCOME_CAP
  const interest = Math.min(MAX_INTEREST, Math.floor(econ.gold / 10))  // on gold held BEFORE payout
  const streakGold = streakBonus(econ.streak)
  const winGold = result.won ? WIN_BONUS : 0
  const total = base + interest + streakGold + winGold
  econ.gold += total

  const levelsGained = grantXp(econ, XP_PER_ROUND)

  const hpLost = result.won || result.draw ? 0 : hpLoss(result.round, result.survivorStars)
  econ.hp = Math.max(0, econ.hp - hpLost)
  if (econ.hp <= 0) econ.eliminated = true

  return {
    base, interest, streakGold, winGold, total,
    xpGained: XP_PER_ROUND,
    levelsGained,
    hpLost,
    newStreak: econ.streak,
    eliminated: econ.eliminated,
  }
}
