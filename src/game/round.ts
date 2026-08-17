// Transport-agnostic round engine: pure functions over RunState — no DOM, no
// network, no browser globals — driving buy → plan → resolve → record. This
// is the module both single-player (src/main.ts) and the future PartyKit
// room server (Phase 3) call into.

import type { RunState, BoardEntry, PlayerEcon, BenchedUnit } from '../econ/runState'
import { livingPlayers } from '../econ/runState'
import type { Rng } from '../econ/shop'
import { rollShop, buyUnit, reroll as shopReroll, sellFromBench, sellFromBoard } from '../econ/shop'
import { buyXp, boardCap } from '../econ/xp'
import { settleRound } from '../econ/income'
import { resolveBotFight } from '../econ/botMatches'
import { stageOf, MAX_LEVEL } from '../econ/constants'
import type { CombatEvent, CombatState, Unit } from '../core/types'
import { createCombatState, advanceCombatTick } from '../core/combatEngine'
import { makeUnit } from '../core/unitFactory'
import { hexToPixel, BOARD_COLS } from '../core/hexGrid'
import { HEX_SIZE } from '../core/constants'

// ─── Seeded RNG ─────────────────────────────────────────────────────────────

// Seeds ECONOMY randomness only (pairing shuffles, bot planning, item/crawler
// rolls) — the same LCG the econ tests already use. Combat randomness stays
// exactly as it is today (Math.random via src/core/rng.ts): this project cut
// deterministic seed-replay in favour of streaming the recorded log, so
// nothing here ever seeds src/core.
export function seededRng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// ─── The action contract ────────────────────────────────────────────────────

// Full union declared now so downstream plans can't invent divergent variants;
// only 'buy' is wired for real in this plan.
export type GameAction =
  | { t: 'buy'; slot: number }
  | { t: 'sell'; from: 'bench' | 'board'; index: number }
  | { t: 'reroll' }
  | { t: 'buyXp' }
  | { t: 'lock'; locked: boolean }
  | { t: 'moveBoard'; from: { col: number; row: number }; to: { col: number; row: number } }
  | { t: 'moveBench'; benchIndex: number; to: { col: number; row: number } | { bench: number } }
  | { t: 'placeItem'; itemIndex: number; onHex: { col: number; row: number } }

export type ActionReason =
  | 'bad-seat' | 'eliminated' | 'empty-slot' | 'no-gold' | 'bench-full'
  | 'pool-empty' | 'board-full' | 'occupied' | 'not-player-hex' | 'no-unit'
  | 'no-item' | 'max-level' | 'not-implemented' | 'unsellable'

export type ActionResult = { ok: true } | { ok: false; reason: ActionReason }

// Mirrors src/main.ts's isCliffId. Kept local — src/main.ts is a browser
// entry point this module must not import. Ascender pillars are never
// sellable and never count toward the board cap.
function isPillar(definitionId: string): boolean {
  return definitionId === 'cliff_l' || definitionId === 'cliff_r'
}

// Non-pillar board entries — the number the board cap actually limits.
// Pillars do not count toward the cap, so this cannot be econ.board.length.
function fieldedCount(econ: PlayerEcon): number {
  return econ.board.filter(entry => !isPillar(entry.definitionId)).length
}

// The player half: rows 4-7 (mirrors src/main.ts's `[4, 5, 6, 7].includes`),
// full column range.
function isPlayerHex(hex: { col: number; row: number }): boolean {
  return Number.isInteger(hex.col) && Number.isInteger(hex.row) &&
    hex.row >= 4 && hex.row <= 7 && hex.col >= 0 && hex.col < BOARD_COLS
}

// The seat parameter is the ONLY seat authority in this function: no branch
// may resolve a PlayerEcon from anything except state.players[seat]. This is
// the boundary Phase 3's room server relies on to keep two humans from
// touching each other's economy over the network.
export function applyAction(
  state: RunState,
  seat: number,
  action: GameAction,
  rng: Rng = Math.random,
): ActionResult {
  if (seat < 0 || seat >= state.players.length) return { ok: false, reason: 'bad-seat' }
  const econ = state.players[seat]
  if (econ.eliminated) return { ok: false, reason: 'eliminated' }

  switch (action.t) {
    case 'buy': {
      const result = buyUnit(state, econ, action.slot)
      return result.ok ? { ok: true } : { ok: false, reason: result.reason }
    }

    case 'reroll': {
      return shopReroll(econ, state.pool, rng) ? { ok: true } : { ok: false, reason: 'no-gold' }
    }

    case 'buyXp': {
      // Checked first so the caller can tell "capped" from "broke" — buyXp
      // itself collapses both into a single false.
      if (econ.level >= MAX_LEVEL) return { ok: false, reason: 'max-level' }
      return buyXp(econ) ? { ok: true } : { ok: false, reason: 'no-gold' }
    }

    case 'lock': {
      econ.shopLocked = action.locked
      return { ok: true }
    }

    case 'sell': {
      if (action.from === 'bench') {
        return sellFromBench(state, econ, action.index) ? { ok: true } : { ok: false, reason: 'no-unit' }
      }
      const entry = econ.board[action.index]
      if (!entry) return { ok: false, reason: 'no-unit' }
      if (isPillar(entry.definitionId)) return { ok: false, reason: 'unsellable' }
      return sellFromBoard(state, econ, action.index) ? { ok: true } : { ok: false, reason: 'no-unit' }
    }

    case 'moveBoard': {
      const sourceIdx = econ.board.findIndex(
        e => e.hexPos.col === action.from.col && e.hexPos.row === action.from.row,
      )
      if (sourceIdx === -1) return { ok: false, reason: 'no-unit' }
      if (!isPlayerHex(action.to)) return { ok: false, reason: 'not-player-hex' }

      const destIdx = econ.board.findIndex(
        e => e.hexPos.col === action.to.col && e.hexPos.row === action.to.row,
      )
      // econ.board.length is unchanged either way (swap or relocate), so no
      // cap check applies here — the cap only gates a move that ADDS a
      // fielded unit (bench-to-empty-hex), never a board-to-board move.
      if (destIdx !== -1) {
        const sourceEntry = econ.board[sourceIdx]
        const destEntry = econ.board[destIdx]
        const tmp = sourceEntry.hexPos
        sourceEntry.hexPos = destEntry.hexPos
        destEntry.hexPos = tmp
      } else {
        econ.board[sourceIdx].hexPos = { col: action.to.col, row: action.to.row }
      }
      return { ok: true }
    }

    case 'moveBench': {
      if ('bench' in action.to) {
        const n = action.to.bench
        if (action.benchIndex < 0 || action.benchIndex >= econ.bench.length) return { ok: false, reason: 'no-unit' }
        if (n < 0 || n >= econ.bench.length) return { ok: false, reason: 'no-unit' }
        const tmp = econ.bench[action.benchIndex]
        econ.bench[action.benchIndex] = econ.bench[n]
        econ.bench[n] = tmp
        return { ok: true }
      }

      // Hex destination.
      if (action.benchIndex < 0 || action.benchIndex >= econ.bench.length) return { ok: false, reason: 'no-unit' }
      const benchUnit = econ.bench[action.benchIndex]
      if (!benchUnit) return { ok: false, reason: 'no-unit' }
      if (!isPlayerHex(action.to)) return { ok: false, reason: 'not-player-hex' }
      // Capture into a local so TS's narrowing (to { col, row }) survives
      // into the closures below — narrowing on a property access does not
      // persist across nested function boundaries.
      const to = action.to as { col: number; row: number }

      const destIdx = econ.board.findIndex(
        e => e.hexPos.col === to.col && e.hexPos.row === to.row,
      )
      if (destIdx !== -1) {
        // Swap: the board occupant becomes a benched unit, the bench unit
        // takes the hex. The fielded count is unchanged, so no cap check.
        const destEntry = econ.board[destIdx]
        const displaced: BenchedUnit = { definitionId: destEntry.definitionId, tier: destEntry.tier }
        if (destEntry.item) displaced.item = destEntry.item
        const placed: BoardEntry = {
          definitionId: benchUnit.definitionId, tier: benchUnit.tier,
          hexPos: { col: to.col, row: to.row },
        }
        if (benchUnit.item) placed.item = benchUnit.item
        econ.board[destIdx] = placed
        econ.bench[action.benchIndex] = displaced
        return { ok: true }
      }

      // Empty hex: this move ADDS a fielded unit, so it is cap-checked —
      // unless the moving unit is a pillar, which never counts toward the cap.
      if (!isPillar(benchUnit.definitionId) && fieldedCount(econ) >= boardCap(econ)) {
        return { ok: false, reason: 'board-full' }
      }
      const placed: BoardEntry = {
        definitionId: benchUnit.definitionId, tier: benchUnit.tier,
        hexPos: { col: to.col, row: to.row },
      }
      if (benchUnit.item) placed.item = benchUnit.item
      econ.bench[action.benchIndex] = null
      econ.board.push(placed)
      return { ok: true }
    }

    case 'placeItem': {
      if (action.itemIndex < 0 || action.itemIndex >= econ.itemBench.length) return { ok: false, reason: 'no-item' }
      const entry = econ.board.find(
        e => e.hexPos.col === action.onHex.col && e.hexPos.row === action.onHex.row,
      )
      if (!entry) return { ok: false, reason: 'no-unit' }

      // Validation is done — every write below is safe to perform.
      const item = econ.itemBench[action.itemIndex]
      const prevItem = entry.item
      econ.itemBench.splice(action.itemIndex, 1)
      if (prevItem) econ.itemBench.push(prevItem)
      entry.item = item
      return { ok: true }
    }

    default: {
      // Exhaustiveness check: a future GameAction variant that isn't handled
      // above is a compile error here, not a silent fall-through.
      const exhaustive: never = action
      return exhaustive
    }
  }
}

// ─── Planning ────────────────────────────────────────────────────────────────

// Banks pendingIncome into gold, then rolls every unlocked living seat's
// shop — ascending seat order, same two-branch roll src/main.ts's
// startPlanningPhase used (an all-empty shop is refilled even when locked).
// Interest is NOT settled here — settleRound already folded it into gold
// (or, for the human today, into pendingIncome via src/main.ts's
// settleHumanRound deferral) at end-of-round; this just banks what's already
// there. Do not "fix" this into a second interest payout.
export function startPlanning(state: RunState, rng: Rng = Math.random): void {
  for (const econ of state.players) {
    if (econ.eliminated) continue
    if (econ.pendingIncome) {
      econ.gold += econ.pendingIncome
      econ.pendingIncome = 0
    }
    if (!econ.shopLocked) rollShop(econ, state.pool, rng)
    if (econ.shop.every(slot => slot === null)) rollShop(econ, state.pool, rng)
  }
}

// ─── Fight recording — the architectural core ───────────────────────────────

export interface UnitFrame {
  id: string
  definitionId: string
  team: 'player' | 'enemy'
  tier: 1 | 2 | 3
  hexPos: { col: number; row: number }
  visualPos: { x: number; y: number }
  currentHp: number
  maxHp: number
  currentMana: number
  maxMana: number
  state: string
  items: string[]
}

// Render-relevant, serializable subset of core/types.ts's Projectile. The
// live Projectile carries hit/tick callback functions and damage/heal payload
// objects — none of those can cross a wire or survive JSON.stringify, and the
// effect layer never reads them, so they are deliberately excluded here.
export interface ProjectileFrame {
  id: string
  sourceId: string
  startPos: { x: number; y: number }
  currentPos: { x: number; y: number }
  targetPos?: { x: number; y: number }
  hitRadius: number
  arcHeight?: number
  launchDist?: number
  abilityId?: string
}

// One elapsed combat tick — not one event. Unit movement emits no
// CombatEvent, so a frame-per-event log would render a fight where nothing
// moves; this carries a frame for every tick advanceCombatTick ran.
export interface FightFrame {
  tick: number
  units: UnitFrame[]
  projectiles: ProjectileFrame[]
  events: CombatEvent[]
  terrain: { electric: boolean; psychic: boolean; grassy: boolean; misty: boolean; sunny: boolean }
  tailwind: { player: boolean; enemy: boolean }
}

// seatA occupies the 'player' team (rows 4-7); seatB is mirrored onto the
// 'enemy' team (rows 0-3). winner: 'player' means seatA won. seatB of -1 is
// reserved for a creep board (Plan 04). Deliberately absent: any per-fight
// replay seed — this project streams the recorded log instead of reseeding
// combat client-side (see PROJECT.md "Out of Scope").
export interface FightLog {
  seatA: number
  seatB: number
  stage: number
  winner: 'player' | 'enemy' | 'draw'
  ticksElapsed: number
  survivorStarsA: number
  survivorStarsB: number
  quakesA: number
  quakesB: number
  frames: FightFrame[]
}

// Builds one combat-ready Unit from a board entry, mirroring the row
// transform boardToSpecs(econ, true) applies for the enemy side.
function buildUnit(entry: BoardEntry, team: 'player' | 'enemy'): Unit {
  const unit = makeUnit(entry.definitionId, team, entry.tier)
  const row = team === 'enemy' ? 7 - entry.hexPos.row : entry.hexPos.row
  unit.hexPos = { col: entry.hexPos.col, row }
  unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
  if (entry.item) unit.items = [entry.item]
  return unit
}

function boardStarSum(board: BoardEntry[]): number {
  return board.reduce((sum, u) => sum + u.tier, 0)
}

// One FightFrame per tick. Frames are appended in loop order and never
// re-sorted; events inside a frame keep the exact order advanceCombatTick
// pushed them onto state.events. Both properties are load-bearing for
// playback (chronological replay, event-grouping never happens here).
function captureFrame(cs: CombatState): FightFrame {
  const units: UnitFrame[] = []
  for (const u of cs.units.values()) {
    units.push({
      id: u.id,
      definitionId: u.definitionId,
      team: u.team,
      tier: u.tier,
      hexPos: { col: u.hexPos.col, row: u.hexPos.row },
      visualPos: { x: u.visualPos.x, y: u.visualPos.y },
      currentHp: u.currentHp,
      maxHp: u.maxHp,
      currentMana: u.currentMana,
      maxMana: u.maxMana,
      state: u.state,
      items: [...u.items],
    })
  }

  const projectiles: ProjectileFrame[] = []
  for (const p of cs.projectiles.values()) {
    projectiles.push({
      id: p.id,
      sourceId: p.sourceId,
      startPos: { x: p.startPos.x, y: p.startPos.y },
      currentPos: { x: p.currentPos.x, y: p.currentPos.y },
      hitRadius: p.hitRadius,
      ...(p.targetPos !== undefined ? { targetPos: { x: p.targetPos.x, y: p.targetPos.y } } : {}),
      ...(p.arcHeight !== undefined ? { arcHeight: p.arcHeight } : {}),
      ...(p.launchDist !== undefined ? { launchDist: p.launchDist } : {}),
      ...(p.abilityId !== undefined ? { abilityId: p.abilityId } : {}),
    })
  }

  return {
    tick: cs.tick,
    units,
    projectiles,
    // Copy — advanceCombatTick reassigns cs.events to a fresh array at the
    // START of every tick, so holding the live reference here would leave
    // every past frame silently empty by the time the fight ends.
    events: [...cs.events],
    terrain: { ...cs.terrain },
    tailwind: { ...cs.tailwind },
  }
}

// Runs one real combat once and captures every tick of it. Deliberately does
// NOT delegate to runCombat:
//   1. runCombat's per-tick callback fires only on ticks with events.length
//      > 0, but units move on event-less ticks and movement emits no
//      CombatEvent — sampling only event-bearing ticks would play back a
//      fight where nothing ever moves.
//   2. runCombat's default cap is 1800 ticks, while the live game only
//      ENTERS overtime at 1800 and hard-draws at 3600 (src/main.ts
//      tickCombat). Recording must match what the player would have watched.
export function recordFight(state: RunState, seatA: number, seatB: number, stage: number): FightLog {
  const econA = state.players[seatA]
  const econB = state.players[seatB]

  // Empty-side forfeit: no simulation runs at all, mirroring
  // resolveBotFight's three forfeit branches.
  if (econA.board.length === 0 || econB.board.length === 0) {
    const bothEmpty = econA.board.length === 0 && econB.board.length === 0
    const winner: FightLog['winner'] = bothEmpty ? 'draw' : econA.board.length === 0 ? 'enemy' : 'player'
    return {
      seatA, seatB, stage, winner,
      ticksElapsed: 0,
      survivorStarsA: econA.board.length === 0 ? 0 : boardStarSum(econA.board),
      survivorStarsB: econB.board.length === 0 ? 0 : boardStarSum(econB.board),
      quakesA: 0,
      quakesB: 0,
      frames: [],
    }
  }

  const playerUnits = econA.board.map(entry => buildUnit(entry, 'player'))
  const enemyUnits = econB.board.map(entry => buildUnit(entry, 'enemy'))
  const cs = createCombatState(playerUnits, enemyUnits, stage)

  const frames: FightFrame[] = []
  let winner: FightLog['winner'] = 'draw'

  // Own tick loop, capped at the same 3600 ticks (30s overtime, on top of the
  // 30s base) the live game hard-draws at.
  while (cs.tick < 3600) {
    advanceCombatTick(cs)
    // Push the frame BEFORE the terminal check so the killing-blow death
    // event is never dropped.
    frames.push(captureFrame(cs))

    let playerAlive = false, enemyAlive = false
    for (const u of cs.units.values()) {
      if (u.state === 'dead') continue
      if (u.team === 'player') playerAlive = true
      else enemyAlive = true
    }
    if (!playerAlive || !enemyAlive) {
      winner = playerAlive ? 'player' : enemyAlive ? 'enemy' : 'draw'
      break
    }
  }

  let survivorStarsA = 0, survivorStarsB = 0
  for (const u of cs.units.values()) {
    if (u.isDummy || u.state === 'dead') continue
    if (u.team === 'player') survivorStarsA += u.tier
    else survivorStarsB += u.tier
  }

  return {
    seatA, seatB, stage, winner,
    ticksElapsed: cs.tick,
    survivorStarsA, survivorStarsB,
    quakesA: cs.earthquakeCounts.get('player') ?? 0,
    quakesB: cs.earthquakeCounts.get('enemy') ?? 0,
    frames,
  }
}

// ─── Round resolution — the tracer path ─────────────────────────────────────

export interface SeatFightResult {
  seat: number
  opponentSeat: number
  won: boolean
  draw: boolean
  survivorStars: number   // the OPPONENT's surviving star sum — drives this seat's HP loss
  hpLost: number
  eliminated: boolean
  logIndex: number | null
}

export interface RoundResult {
  round: number
  pairings: Array<{ a: number; b: number }>
  seats: SeatFightResult[]
  logs: FightLog[]
  eliminated: number[]
}

// Not yet in this task — Plan 04 adds each as a call/branch inside this
// existing loop, none of which changes the exported shapes above:
//   - eliminated-seat pool returns
//   - Cave Crawler earthquake rewards
//   - bot re-planning after settlement
//   - the human-only income deferral src/main.ts's settleHumanRound performs
//     today (this task calls settleRound plainly for every seat — that is
//     NOT yet the human deferral)
//   - per-seat next-matchup announcement, creep rounds, item rounds
//   - the anti-immediate-rematch pairing preference
export function resolveRound(state: RunState, roundSeed: number): RoundResult {
  const rng = seededRng(roundSeed)
  const round = state.round
  const living = livingPlayers(state)

  if (living.length === 0) {
    return { round, pairings: [], seats: [], logs: [], eliminated: [] }
  }

  // Fisher-Yates shuffle a copy of `living` — same loop shape resolveBotRound uses.
  const shuffled = [...living]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const pairings: Array<{ a: number; b: number }> = []
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairings.push({ a: shuffled[i], b: shuffled[i + 1] })
  }
  if (shuffled.length % 2 === 1) {
    pairings.push({ a: shuffled[shuffled.length - 1], b: -1 })
  }

  const logs: FightLog[] = []
  const seats: SeatFightResult[] = []
  const eliminated: number[] = []

  for (const pair of pairings) {
    if (pair.b === -1) {
      // Odd seat out: bye, settled as a draw — no fight recorded, matching
      // resolveBotRound's odd-bot-out handling.
      const settlement = settleRound(state.players[pair.a], { won: false, draw: true, survivorStars: 0, round })
      seats.push({
        seat: pair.a, opponentSeat: -1, won: false, draw: true, survivorStars: 0,
        hpLost: settlement.hpLost, eliminated: settlement.eliminated, logIndex: null,
      })
      if (settlement.eliminated) eliminated.push(pair.a)
      continue
    }

    const econA = state.players[pair.a]
    const econB = state.players[pair.b]
    // Real and recorded iff at least one seat is human.
    const recorded = econA.personaId === null || econB.personaId === null

    if (recorded) {
      const log = recordFight(state, pair.a, pair.b, stageOf(round))
      const logIndex = logs.push(log) - 1

      const aWon = log.winner === 'player'
      const bWon = log.winner === 'enemy'
      const draw = log.winner === 'draw'
      const starsForA = aWon ? 0 : log.survivorStarsB   // A lost → B's surviving stars
      const starsForB = bWon ? 0 : log.survivorStarsA   // B lost → A's surviving stars

      const settlementA = settleRound(econA, { won: aWon, draw, survivorStars: starsForA, round })
      const settlementB = settleRound(econB, { won: bWon, draw, survivorStars: starsForB, round })

      seats.push({
        seat: pair.a, opponentSeat: pair.b, won: aWon, draw, survivorStars: starsForA,
        hpLost: settlementA.hpLost, eliminated: settlementA.eliminated, logIndex,
      })
      seats.push({
        seat: pair.b, opponentSeat: pair.a, won: bWon, draw, survivorStars: starsForB,
        hpLost: settlementB.hpLost, eliminated: settlementB.eliminated, logIndex,
      })

      if (settlementA.eliminated) eliminated.push(pair.a)
      if (settlementB.eliminated) eliminated.push(pair.b)
    } else {
      const fight = resolveBotFight(econA, econB)
      const aWon = fight.winner === 'a'
      const bWon = fight.winner === 'b'
      const draw = fight.winner === 'draw'
      const starsForA = aWon ? 0 : fight.survivorStars
      const starsForB = bWon ? 0 : fight.survivorStars

      const settlementA = settleRound(econA, { won: aWon, draw, survivorStars: starsForA, round })
      const settlementB = settleRound(econB, { won: bWon, draw, survivorStars: starsForB, round })

      seats.push({
        seat: pair.a, opponentSeat: pair.b, won: aWon, draw, survivorStars: starsForA,
        hpLost: settlementA.hpLost, eliminated: settlementA.eliminated, logIndex: null,
      })
      seats.push({
        seat: pair.b, opponentSeat: pair.a, won: bWon, draw, survivorStars: starsForB,
        hpLost: settlementB.hpLost, eliminated: settlementB.eliminated, logIndex: null,
      })

      if (settlementA.eliminated) eliminated.push(pair.a)
      if (settlementB.eliminated) eliminated.push(pair.b)
    }
  }

  state.round++
  return { round, pairings, seats, logs, eliminated }
}
