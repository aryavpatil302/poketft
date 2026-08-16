// Round orchestration for the bot side of the lobby:
//  - picks the human's next opponent (random among living bots, no immediate repeats)
//  - pairs the remaining living bots against each other
//  - resolves bot-vs-bot fights headlessly with the real combat sim
//  - applies income/HP settlement to every bot and handles elimination

import { runSimulation, type UnitSpec } from '../sim/runner'
import type { RunState, PlayerEcon } from './runState'
import { settleRound } from './income'
import { returnAllToPool } from './shop'
import { botPlanRound, econBoardPower } from './bots'
import { chooseBotItem, botOwnedItems } from './botItems'
import { isItemRound } from './creeps'
import type { Rng } from './shop'
import { rollCrawlerEarthquakeRewards } from './caveCrawlerSpawn'
import { TICK_RATE } from '../core/constants'

// Cave crawlers fire one earthquake every 5s; estimate a headless fight's quake
// count from its duration (the sim reports avgTicksElapsed, not the exact count).
function estimateQuakes(avgTicksElapsed: number): number {
  return Math.floor(avgTicksElapsed / (5 * TICK_RATE))
}

// Convert a player-half board (rows 4-7) to sim specs; `asEnemy` mirrors onto
// rows 0-3 (row 4 front → row 3 front).
export function boardToSpecs(econ: PlayerEcon, asEnemy: boolean): UnitSpec[] {
  return econ.board.map(u => ({
    id: u.definitionId,
    tier: u.tier,
    col: u.hexPos.col,
    row: asEnemy ? 7 - u.hexPos.row : u.hexPos.row,
    item: u.item,
  }))
}

export interface BotMatchOutcome {
  aIndex: number
  bIndex: number
  winner: 'a' | 'b' | 'draw'
  survivorStars: number   // sum of the winner's surviving units' star levels
}

function boardStarSum(econ: PlayerEcon): number {
  return econ.board.reduce((s, u) => s + u.tier, 0)
}

// Per-unit contribution for one side of a fight, used by the composition
// trainers to split learning credit by what each unit actually DID rather
// than giving a 4,200-damage carry and the filler beside it the same +1.
// See src/econ/learningCredit.ts's contributionShares.
export interface FightContribution { definitionId: string; dealt: number; taken: number; healed: number; shielded: number }

export interface BotFightResult {
  winner: 'a' | 'b' | 'draw'
  survivorStars: number
  quakes: number
  // Empty when the fight was a forfeit (no sim ran, so nothing was measured).
  contribA: FightContribution[]
  contribB: FightContribution[]
}

// Resolve one bot-vs-bot fight with a single sim trial.
// Empty board auto-loses (both empty = draw). `rng`, when passed, seeds the
// fight's combat randomness (see runSimulation) — used by the training CLI
// for common random numbers; live bot-vs-human rounds omit it and stay on
// Math.random.
export function resolveBotFight(a: PlayerEcon, b: PlayerEcon, rng?: Rng): BotFightResult {
  const none = { contribA: [], contribB: [] }
  if (a.board.length === 0 && b.board.length === 0) return { winner: 'draw', survivorStars: 0, quakes: 0, ...none }
  if (a.board.length === 0) return { winner: 'b', survivorStars: boardStarSum(b), quakes: 0, ...none }
  if (b.board.length === 0) return { winner: 'a', survivorStars: boardStarSum(a), quakes: 0, ...none }

  const report = runSimulation(boardToSpecs(a, false), boardToSpecs(b, true), 1, rng)
  const quakes = estimateQuakes(report.avgTicksElapsed)   // both boards share the fight duration
  const toContrib = (team: 'player' | 'enemy'): FightContribution[] =>
    report.unitStats.filter(u => u.team === team).map(u => ({
      definitionId: u.definitionId,
      dealt:    u.avgDamageDealt,
      taken:    u.avgDamageTaken,
      healed:   u.avgHealing,
      shielded: u.avgShieldingReceived,
    }))
  const contribA = toContrib('player')
  const contribB = toContrib('enemy')
  if (report.drawRate > 0.5) return { winner: 'draw', survivorStars: 0, quakes, contribA, contribB }
  const aWon = report.playerWinRate > 0.5
  const winner = aWon ? a : b
  const winnerStats = report.unitStats.filter(u => u.team === (aWon ? 'player' : 'enemy'))

  // Map surviving sim units back to board entries by species to sum stars
  const pool = [...winner.board]
  let survivorStars = 0
  for (const u of winnerStats) {
    if (u.survivalRate <= 0.5) continue
    const idx = pool.findIndex(e => e.definitionId === u.definitionId)
    if (idx !== -1) {
      survivorStars += pool[idx].tier
      pool.splice(idx, 1)
    } else {
      survivorStars += 1   // summon or unmatched — count as 1★
    }
  }
  return { winner: aWon ? 'a' : 'b', survivorStars, quakes, contribA, contribB }
}

// Pick an opponent for `forSeat`: random living seat other than `forSeat`,
// avoiding an immediate rematch when more than one other seat is alive.
// Returns -1 when no eligible opponent exists (only `forSeat` remains living).
export function pickNextOpponent(state: RunState, forSeat: number, rng: Rng = Math.random): number {
  const living = state.players
    .map((p, i) => [p, i] as const)
    .filter(([p, i]) => i !== forSeat && !p.eliminated)
    .map(([, i]) => i)
  if (living.length === 0) return -1
  const choices = living.length > 1 ? living.filter(i => i !== state.nextOpponent) : living
  return choices[Math.floor(rng() * choices.length)]
}

// Run the full bot side of a round, AFTER the human's own match was settled:
//  1. every living bot (except the human's opponent, whose result is passed in)
//     fights in random pairs; odd bot out gets a bye (counts as a draw)
//  2. each bot gets its settlement (income/XP/HP)
//  3. eliminated bots return their units to the pool
//  4. every surviving bot plans its next round (spends gold on the shared pool)
//  5. the human's next opponent is chosen
export function resolveBotRound(
  state: RunState,
  humanOpponentResult: { botIndex: number; botWon: boolean; draw: boolean; survivorStars: number; opponentQuakes?: number },
  rng: Rng = Math.random,
): BotMatchOutcome[] {
  const outcomes: BotMatchOutcome[] = []
  const round = state.round

  // 1. settle the human's opponent from the live match result
  const oppEcon = state.players[humanOpponentResult.botIndex]
  if (oppEcon && !oppEcon.eliminated) {
    settleRound(oppEcon, {
      won: humanOpponentResult.botWon,
      draw: humanOpponentResult.draw,
      survivorStars: humanOpponentResult.survivorStars,
      round,
    })
    // Cave Crawler rewards from the live fight (exact quake count threaded from main.ts).
    if (!oppEcon.eliminated) {
      rollCrawlerEarthquakeRewards(state, oppEcon, humanOpponentResult.opponentQuakes ?? 0, rng)
    }
    if (oppEcon.eliminated) returnAllToPool(state, oppEcon)
  }

  // 2. pair the remaining living bots
  const others = state.players
    .map((p, i) => [p, i] as const)
    .filter(([p, i]) => i !== 0 && i !== humanOpponentResult.botIndex && !p.eliminated)
    .map(([, i]) => i)

  // shuffle (Fisher-Yates with injected rng)
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[others[i], others[j]] = [others[j], others[i]]
  }

  for (let i = 0; i + 1 < others.length; i += 2) {
    const aIdx = others[i], bIdx = others[i + 1]
    const a = state.players[aIdx], b = state.players[bIdx]
    const fight = resolveBotFight(a, b)
    outcomes.push({ aIndex: aIdx, bIndex: bIdx, winner: fight.winner, survivorStars: fight.survivorStars })

    settleRound(a, { won: fight.winner === 'a', draw: fight.winner === 'draw', survivorStars: fight.winner === 'b' ? fight.survivorStars : 0, round })
    settleRound(b, { won: fight.winner === 'b', draw: fight.winner === 'draw', survivorStars: fight.winner === 'a' ? fight.survivorStars : 0, round })
    // Cave Crawler rewards before either bot plans (step 3), so they can use/sell the spawn.
    if (!a.eliminated) rollCrawlerEarthquakeRewards(state, a, fight.quakes, rng)
    if (!b.eliminated) rollCrawlerEarthquakeRewards(state, b, fight.quakes, rng)
    if (a.eliminated) returnAllToPool(state, a)
    if (b.eliminated) returnAllToPool(state, b)
  }

  // Odd bot out: bye round (draw-like settlement — income, no HP change)
  if (others.length % 2 === 1) {
    const byeIdx = others[others.length - 1]
    settleRound(state.players[byeIdx], { won: false, draw: true, survivorStars: 0, round })
  }

  // 3. every living bot plans its next round against the human's current power
  const humanPower = econBoardPower(state.players[0])
  for (let i = 1; i < state.players.length; i++) {
    const bot = state.players[i]
    if (!bot.eliminated) botPlanRound(state, bot, humanPower, rng)
  }

  // 4. choose next opponent
  state.nextOpponent = pickNextOpponent(state, 0, rng)

  return outcomes
}

// Bot side of a PvE creep round: no fights (neither bot-vs-bot nor bot-vs-human).
// Every living bot just takes the creep settlement (income + XP, no HP change,
// like a bye) and plans its next round, then the human's next opponent is chosen
// for when PvP begins. Mirrors resolveBotRound minus the combat.
export function resolveBotCreepRound(state: RunState, rng: Rng = Math.random): void {
  const round = state.round
  const itemRound = isItemRound(round)
  for (let i = 1; i < state.players.length; i++) {
    const bot = state.players[i]
    if (!bot.eliminated) {
      settleRound(bot, { won: false, draw: true, survivorStars: 0, round })
    }
  }

  const humanPower = econBoardPower(state.players[0])
  for (let i = 1; i < state.players.length; i++) {
    const bot = state.players[i]
    if (bot.eliminated) continue
    // Delibird item round: each living bot also picks an item that suits its board
    // (planning equips it via equipBotItems).
    if (itemRound) {
      const item = chooseBotItem(bot, botOwnedItems(bot), rng)
      if (item) bot.itemBench.push(item)
    }
    botPlanRound(state, bot, humanPower, rng)
  }

  state.nextOpponent = pickNextOpponent(state, 0, rng)
}

// Win/loss check for the whole run (call after resolveBotRound + human settle)
export function checkGameOver(state: RunState): 'win' | 'loss' | null {
  const human = state.players[0]
  if (human.eliminated) return 'loss'
  const botsAlive = state.players.some((p, i) => i > 0 && !p.eliminated)
  if (!botsAlive) return 'win'
  return null
}
