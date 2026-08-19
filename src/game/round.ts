// Transport-agnostic round engine: pure functions over RunState — no DOM, no
// network, no browser globals — driving buy → plan → resolve → record. This
// is the module both single-player (src/main.ts) and the future PartyKit
// room server (Phase 3) call into.

import type { RunState, BoardEntry, PlayerEcon, BenchedUnit } from '../econ/runState'
import { livingPlayers } from '../econ/runState'
import type { Rng } from '../econ/shop'
import { rollShop, buyUnit, reroll as shopReroll, sellFromBench, sellFromBoard, returnAllToPool } from '../econ/shop'
import { buyXp, boardCap } from '../econ/xp'
import { settleRound } from '../econ/income'
import { resolveBotFight, humanTablePower } from '../econ/botMatches'
import { botPlanRound } from '../econ/bots'
import { chooseBotItem, botOwnedItems } from '../econ/botItems'
import { rollCrawlerEarthquakeRewards } from '../econ/caveCrawlerSpawn'
import { isItemRound, isCreepRound, creepRoundDef } from '../econ/creeps'
import { stageOf, MAX_LEVEL } from '../econ/constants'
import type { CombatEvent, CombatState, Unit, AttackModifier, DamagePayload, HealPayload } from '../core/types'
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
//
// The union covers every economy interaction the solo UI in src/main.ts
// supports, so a networked lobby is never visibly poorer than solo play:
// moveBoard accepts a bench destination (the board-to-bench drop), placeItem
// accepts a bench slot (equipping a benched unit), and removeItem expresses
// the `r`-key item pull.
export type GameAction =
  | { t: 'buy'; slot: number }
  | { t: 'sell'; from: 'bench' | 'board'; index: number }
  | { t: 'reroll' }
  | { t: 'buyXp' }
  | { t: 'lock'; locked: boolean }
  // `to` takes the same shape moveBench.to already uses, so the two move
  // actions share one target vocabulary rather than each inventing its own.
  | { t: 'moveBoard'; from: { col: number; row: number }; to: { col: number; row: number } | { bench: number } }
  | { t: 'moveBench'; benchIndex: number; to: { col: number; row: number } | { bench: number } }
  // A discriminated target, spelled as two members rather than a `target:`
  // wrapper so every existing onHex call site keeps compiling unchanged.
  | { t: 'placeItem'; itemIndex: number; onHex: { col: number; row: number } }
  | { t: 'placeItem'; itemIndex: number; onBench: number }
  // Mirrors `sell`'s from/index addressing, so the two removal-shaped actions
  // read alike.
  | { t: 'removeItem'; from: 'bench' | 'board'; index: number }

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

      if ('bench' in action.to) {
        // Board -> bench. Fielding drops by one, so no cap check applies —
        // the cap only ever gates a move that ADDS a fielded unit.
        const sourceEntry = econ.board[sourceIdx]
        // Ascender pillars never leave the board, matching the `sell` case's
        // guard and src/main.ts's own bench-drop rejection.
        if (isPillar(sourceEntry.definitionId)) return { ok: false, reason: 'unsellable' }
        const slot = action.to.bench
        if (!Number.isInteger(slot) || slot < 0 || slot >= econ.bench.length) {
          return { ok: false, reason: 'no-unit' }
        }
        if (econ.bench[slot]) return { ok: false, reason: 'occupied' }

        // Validation is done — every write below is safe to perform. The unit
        // moves, it is never copied and never returned to the pool: the same
        // definitionId/tier pair leaves the board exactly as it enters the
        // bench, so shared-pool accounting is untouched.
        const benched: BenchedUnit = { definitionId: sourceEntry.definitionId, tier: sourceEntry.tier }
        if (sourceEntry.item) benched.item = sourceEntry.item
        econ.bench[slot] = benched
        econ.board.splice(sourceIdx, 1)
        return { ok: true }
      }

      if (!isPlayerHex(action.to)) return { ok: false, reason: 'not-player-hex' }
      // Captured into a local so TS's narrowing survives into the closure
      // below — same reason moveBench captures its own `to`.
      const to = action.to

      const destIdx = econ.board.findIndex(
        e => e.hexPos.col === to.col && e.hexPos.row === to.row,
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
        econ.board[sourceIdx].hexPos = { col: to.col, row: to.row }
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

      // Resolve the target — a board unit or a benched one — before touching
      // anything, so both targets share one validated write below and neither
      // can half-apply.
      let holder: BoardEntry | BenchedUnit | undefined
      if ('onBench' in action) {
        const slot = action.onBench
        if (!Number.isInteger(slot) || slot < 0 || slot >= econ.bench.length) {
          return { ok: false, reason: 'no-unit' }
        }
        holder = econ.bench[slot] ?? undefined
      } else {
        const onHex = action.onHex
        holder = econ.board.find(
          e => e.hexPos.col === onHex.col && e.hexPos.row === onHex.row,
        )
      }
      if (!holder) return { ok: false, reason: 'no-unit' }

      // Validation is done — every write below is safe to perform. The item
      // leaves itemBench exactly as it lands on the unit, and any displaced
      // item goes straight back: an item is in one place at a time.
      const item = econ.itemBench[action.itemIndex]
      const prevItem = holder.item
      econ.itemBench.splice(action.itemIndex, 1)
      if (prevItem) econ.itemBench.push(prevItem)
      holder.item = item
      return { ok: true }
    }

    case 'removeItem': {
      let holder: BoardEntry | BenchedUnit | undefined
      if (action.from === 'bench') {
        holder = econ.bench[action.index] ?? undefined
      } else {
        holder = econ.board[action.index]
      }
      if (!holder) return { ok: false, reason: 'no-unit' }
      if (!holder.item) return { ok: false, reason: 'no-item' }

      // Validation is done — every write below is safe to perform. `delete`
      // rather than `= undefined`: an explicit-undefined key survives a
      // shallow spread and then vanishes across JSON, which is exactly the
      // capture-time bug captureFrame documents below.
      econ.itemBench.push(holder.item)
      delete holder.item
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

// Render-relevant, serializable subset of core/types.ts's Shield. Drops
// onExpire — a callback cannot cross a wire or survive JSON.stringify, and
// the render layer never invokes it, only reads the plain fields below.
export interface ShieldFrame {
  id: string
  sourceAbility: string
  sourceUnitId?: string
  value: number
  maxValue: number
  durationTicks: number
  effectiveMaxHp?: number
  traitSource?: string
}

// Render-relevant, serializable subset of core/types.ts's StatusEffect.
// Drops onExpire/onDeath/tickEffect for the same reason ShieldFrame drops
// onExpire — the renderer only ever checks id/stackId/durationTicks/
// magnitude (e.g. `unit.statusEffects.some(fx => fx.stackId === '…')`) to
// decide whether a buff-driven animation branch is active.
export interface StatusEffectFrame {
  id: string
  sourceUnitId: string
  durationTicks: number
  magnitude?: number
  stackId?: string
}

// Render-relevant, serializable subset of core/types.ts's UnitMark. Drops
// onDetonate/onCarrierDeath for the same reason StatusEffectFrame drops its
// callbacks — the renderer only checks mark ids (e.g. effectLayer's
// 'charizard_flame_mark' / 'celebi_mark_*' icon checks) to decide whether to
// draw the above-head mark icon. UnitMark is distinct from StatusEffect —
// both need capturing separately.
export interface MarkFrame {
  id: string
  sourceUnitId: string
  durationTicks: number
  magnitude?: number
}

// Render-relevant, serializable subset of core/types.ts's AttackModifier.
// Despite the "plain data, no callbacks" assumption this module briefly
// carried, AttackModifier DOES have an optional onHit callback (types.ts) —
// several abilities attach it. Omit<AttackModifier, 'onHit'> is the exact
// fix: every other field is genuinely plain data and copies as-is, only
// onHit needed stripping. Found via a real round-trip fidelity test in
// Phase 3 (src/net/fightWire.test.ts) that a shallow spread let a stray
// function reference survive into a "plain" frame.
export type AttackModifierFrame = Omit<AttackModifier, 'onHit'>

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
  // Animation-driving fields the render layer reads to compute windup/lunge/
  // squash-stretch progress and target-lock lines. Without these every unit
  // plays back frozen in its base pose — makeUnit's zero/false/empty
  // defaults never get overwritten, so nothing animates even though HP,
  // position, and state ('attacking', 'casting', …) are all correct.
  targetId: string | null
  attackTimer: number
  attackWindupTimer: number
  isInWindup: boolean
  pendingCrit: boolean
  abilityCastTimer: number
  attackCount: number
  attackModifiers: AttackModifierFrame[]
  shields: ShieldFrame[]
  statusEffects: StatusEffectFrame[]
  marks: MarkFrame[]
  // Live damage-meter breakdown — mirrors Unit.dmgDealt/dmgTaken verbatim so
  // the sidebar's per-unit stacked bars work identically live or in playback.
  dmgDealt: { physical: number; magic: number; true: number }
  dmgTaken: { physical: number; magic: number; true: number }
  // In-flight dash state (present only while state === 'leaping'). Optional —
  // absent whenever the unit isn't mid-leap, matching the live Unit's _leap.
  leap?: { sx: number; sy: number; ex: number; ey: number; tick: number; total: number }
}

// Render-relevant, serializable subset of core/types.ts's Projectile. The
// live Projectile carries hit/tick callback functions and damage/heal payload
// objects — none of those can cross a wire or survive JSON.stringify, and the
// effect layer never reads them, so they are deliberately excluded here.
export interface ProjectileFrame {
  id: string
  sourceId: string
  targetId?: string
  startPos: { x: number; y: number }
  currentPos: { x: number; y: number }
  targetPos?: { x: number; y: number }
  hitRadius: number
  arcHeight?: number
  launchDist?: number
  abilityId?: string
  // Plain data (no callbacks) — the effect layer reads damagePayload.abilityId
  // to distinguish a plain auto-attack (tagged 'auto_attack' here, NOT on
  // proj.abilityId which is ability-projectiles-only) so it can pick the
  // per-species <definitionId>_auto.png sprite instead of falling back to
  // the default dot. healPayload similarly selects the heal-projectile color.
  damagePayload?: DamagePayload
  healPayload?: HealPayload
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
      targetId: u.targetId,
      attackTimer: u.attackTimer,
      attackWindupTimer: u.attackWindupTimer,
      isInWindup: u.isInWindup,
      pendingCrit: u.pendingCrit,
      abilityCastTimer: u.abilityCastTimer,
      attackCount: u.attackCount,
      attackModifiers: u.attackModifiers.map(({ onHit: _onHit, ...rest }) => rest),
      // Optional fields are included only when actually set (never as an
      // explicit `key: undefined`) — an object literal upstream can assign
      // `sourceUnitId: undefined` explicitly rather than omitting the key,
      // and a shallow copy preserves that explicit-undefined key. JSON
      // (this codec's wire format included) silently drops it on the way
      // out, so a captured-then-decoded frame would then genuinely differ
      // from the original — non-deterministically, only on whichever real
      // fight happens to carry such a value. Found via fightWire.test.ts.
      shields: u.shields.map(s => ({
        id: s.id, sourceAbility: s.sourceAbility, value: s.value,
        maxValue: s.maxValue, durationTicks: s.durationTicks,
        ...(s.sourceUnitId !== undefined ? { sourceUnitId: s.sourceUnitId } : {}),
        ...(s.effectiveMaxHp !== undefined ? { effectiveMaxHp: s.effectiveMaxHp } : {}),
        ...(s.traitSource !== undefined ? { traitSource: s.traitSource } : {}),
      })),
      statusEffects: u.statusEffects.map(fx => ({
        id: fx.id, sourceUnitId: fx.sourceUnitId, durationTicks: fx.durationTicks,
        ...(fx.magnitude !== undefined ? { magnitude: fx.magnitude } : {}),
        ...(fx.stackId !== undefined ? { stackId: fx.stackId } : {}),
      })),
      marks: u.marks.map(m => ({
        id: m.id, sourceUnitId: m.sourceUnitId, durationTicks: m.durationTicks,
        ...(m.magnitude !== undefined ? { magnitude: m.magnitude } : {}),
      })),
      dmgDealt: { ...u.dmgDealt },
      dmgTaken: { ...u.dmgTaken },
      ...(u._leap ? { leap: { sx: u._leap.sx, sy: u._leap.sy, ex: u._leap.ex, ey: u._leap.ey, tick: u._leap.tick, total: u._leap.total } } : {}),
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
      ...(p.targetId !== undefined ? { targetId: p.targetId } : {}),
      ...(p.targetPos !== undefined ? { targetPos: { x: p.targetPos.x, y: p.targetPos.y } } : {}),
      ...(p.arcHeight !== undefined ? { arcHeight: p.arcHeight } : {}),
      ...(p.launchDist !== undefined ? { launchDist: p.launchDist } : {}),
      ...(p.abilityId !== undefined ? { abilityId: p.abilityId } : {}),
      ...(p.damagePayload !== undefined ? { damagePayload: { ...p.damagePayload } } : {}),
      ...(p.healPayload !== undefined ? { healPayload: { ...p.healPayload } } : {}),
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

// Shared tick loop for every recorded fight — seat-vs-seat (recordFight) and
// seat-vs-creep-board (recordCreepFight) both run through this. Deliberately
// does NOT delegate to runCombat:
//   1. runCombat's per-tick callback fires only on ticks with events.length
//      > 0, but units move on event-less ticks and movement emits no
//      CombatEvent — sampling only event-bearing ticks would play back a
//      fight where nothing ever moves.
//   2. runCombat's default cap is 1800 ticks, while the live game only
//      ENTERS overtime at 1800 and hard-draws at 3600 (src/main.ts
//      tickCombat). Recording must match what the player would have watched.
function runRecordedFight(playerUnits: Unit[], enemyUnits: Unit[], stage: number): Omit<FightLog, 'seatA' | 'seatB'> {
  const cs = createCombatState(playerUnits, enemyUnits, stage)

  const frames: FightFrame[] = []
  let winner: FightLog['winner'] = 'draw'

  // Capped at the same 3600 ticks (30s overtime, on top of the 30s base) the
  // live game hard-draws at.
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
    stage, winner,
    ticksElapsed: cs.tick,
    survivorStarsA, survivorStarsB,
    quakesA: cs.earthquakeCounts.get('player') ?? 0,
    quakesB: cs.earthquakeCounts.get('enemy') ?? 0,
    frames,
  }
}

// Runs one real combat once and captures every tick of it. seatB of -1 is
// the reserved slot for a creep board (see recordCreepFight below).
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
  const result = runRecordedFight(playerUnits, enemyUnits, stage)
  return { seatA, seatB, ...result }
}

// Records one human seat's fight against the fixed creep board for `round`.
// seatB is always -1 — the reserved creep slot recordFight documents above.
// Creep spawn rows are used VERBATIM (creepRoundDef's rows are already
// enemy-half rows, 0-3) — deliberately NOT run through buildUnit's row-mirror
// transform (the seat-vs-seat enemy-row flip), which would silently place
// creeps on the wrong half. The fight would still run; the creeps would just
// spawn in the wrong spot.
function recordCreepFight(state: RunState, seat: number, round: number, stage: number): FightLog {
  const econ = state.players[seat]
  const def = creepRoundDef(round)!

  const enemyUnits = def.spawns.map(spawn => {
    const unit = makeUnit(spawn.definitionId, 'enemy', spawn.tier)
    unit.hexPos = { col: spawn.col, row: spawn.row }   // verbatim — no mirror
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
    return unit
  })

  if (econ.board.length === 0) {
    const survivorStarsB = def.spawns.reduce((sum, s) => sum + s.tier, 0)
    return {
      seatA: seat, seatB: -1, stage, winner: 'enemy',
      ticksElapsed: 0, survivorStarsA: 0, survivorStarsB,
      quakesA: 0, quakesB: 0, frames: [],
    }
  }

  const playerUnits = econ.board.map(entry => buildUnit(entry, 'player'))
  const result = runRecordedFight(playerUnits, enemyUnits, stage)
  return { seatA: seat, seatB: -1, ...result }
}

// ─── Round resolution ────────────────────────────────────────────────────────

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
  kind: 'pvp' | 'creep' | 'item'
  pairings: Array<{ a: number; b: number }>
  seats: SeatFightResult[]
  logs: FightLog[]
  eliminated: number[]
  survivors: number[]
}

// Settles one seat and applies every side effect settlement can trigger, in
// the order resolveBotRound establishes: settle → defer (humans only) →
// crawler rewards → pool return. The reward roll must land before a seat can
// be wiped, and before that seat plans (bot re-planning always runs after
// every settleSeat call in the branches below).
function settleSeat(
  state: RunState,
  seat: number,
  result: { won: boolean; draw: boolean; survivorStars: number; round: number },
  quakes: number,
  rng: Rng,
): { hpLost: number; eliminated: boolean } {
  const econ = state.players[seat]
  const settlement = settleRound(econ, result)

  // Human income is deferred to pendingIncome, banked by the next
  // startPlanning call — settleHumanRound's exact three-line move, now keyed
  // on the Phase 1 discriminator instead of seat 0. Bots keep their income
  // immediately: they plan later in THIS SAME call, and deferring would have
  // them planning a round behind. This asymmetry is deliberate and load-bearing.
  if (econ.personaId === null) {
    econ.gold -= settlement.total
    econ.pendingIncome += settlement.total
  }

  // Authoritative crawler-reward roll, from the quake count this seat's
  // fight recorded — supersedes src/main.ts's onLivePlayerQuake, which rolls
  // the human's rewards live, once per earthquake, during the fight. The
  // visible consequence — a crawler appearing at settlement rather than
  // mid-fight — is a deliberate, recorded behaviour change; Plan 05 removes
  // the live roll rather than leaving both in place.
  if (quakes > 0 && !settlement.eliminated) {
    rollCrawlerEarthquakeRewards(state, econ, quakes, rng)
  }

  if (settlement.eliminated) {
    returnAllToPool(state, econ)
  }

  return { hpLost: settlement.hpLost, eliminated: settlement.eliminated }
}

// Every living bot plans its next round exactly once, ascending seat order,
// against ONE shared humanTablePower(state) evaluation — the shared-pool
// draw-order contract resolveBotRound documents (visit order is
// behaviour-relevant because botPlanRound draws from the shared pool).
// `onEachBot`, when given, runs immediately before that bot's plan call (the
// item round's chooseBotItem pick).
function planAllBots(state: RunState, rng: Rng, onEachBot?: (bot: PlayerEcon) => void): void {
  const power = humanTablePower(state)
  for (let i = 0; i < state.players.length; i++) {
    const bot = state.players[i]
    if (bot.personaId === null || bot.eliminated) continue
    if (onEachBot) onEachBot(bot)
    botPlanRound(state, bot, power, rng)
  }
}

// Shared bye-shaped settlement skeleton for the two non-PvP round kinds:
// every living seat settles as a draw (income + XP, no HP loss, no streak
// break) via settleSeat — same deferral/crawler-reward/pool-return ordering
// a PvP pair gets. Ascending seat order (livingPlayers is already ascending).
function settleByeShaped(
  state: RunState,
  round: number,
  rng: Rng,
  quakesFor: (seat: number) => number,
  logIndexFor: (seat: number) => number | null,
): { seats: SeatFightResult[]; eliminated: number[] } {
  const seats: SeatFightResult[] = []
  const eliminated: number[] = []
  for (const seat of livingPlayers(state)) {
    const settlement = settleSeat(state, seat, { won: false, draw: true, survivorStars: 0, round }, quakesFor(seat), rng)
    seats.push({
      seat, opponentSeat: -1, won: false, draw: true, survivorStars: 0,
      hpLost: settlement.hpLost, eliminated: settlement.eliminated, logIndex: logIndexFor(seat),
    })
    if (settlement.eliminated) eliminated.push(seat)
  }
  return { seats, eliminated }
}

// Fisher-Yates pairing of every living seat — same loop shape resolveBotRound
// uses — plus one deterministic anti-immediate-rematch repair pass: for each
// pair (a, b) that is the pair that JUST fought (state.players[a].nextOpponent
// === b), look ahead for a later pair (c, d) whose b/d swap creates no new
// rematch, and swap once if found. ONE PASS, no retry loop, no re-shuffle — a
// rematch is a cosmetic downside, but a pairing search with no guaranteed
// terminus would hang the round, and with exactly two living seats that just
// fought, no rematch-free pairing exists at all.
export function pairSeats(state: RunState, seed: number): Array<{ a: number; b: number }> {
  const rng = seededRng(seed)
  const living = livingPlayers(state)

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

  for (let i = 0; i < pairings.length; i++) {
    const pair = pairings[i]
    if (pair.b === -1) continue
    if (state.players[pair.a].nextOpponent !== pair.b) continue   // not a rematch

    for (let j = i + 1; j < pairings.length; j++) {
      const other = pairings[j]
      if (other.b === -1) continue
      const wouldRematchHere = state.players[pair.a].nextOpponent === other.b
      const wouldRematchThere = state.players[other.a].nextOpponent === pair.b
      if (!wouldRematchHere && !wouldRematchThere) {
        const tmp = pair.b
        pair.b = other.b
        other.b = tmp
        break
      }
    }
  }

  return pairings
}

// Prefers the pairing the players were already shown: valid iff every living
// seat's nextOpponent is -1 (a bye) or a living seat whose OWN nextOpponent
// points back (mutual consistency), and the number of announced byes matches
// the parity of the living count. Returns null on round 1, a stale save, or
// any inconsistency — resolveRound falls back to a fresh pairSeats shuffle
// rather than silently re-pairing against what the `Vs {name}` indicator
// promised during planning.
function pairingsFromAnnouncement(state: RunState, living: number[]): Array<{ a: number; b: number }> | null {
  const livingSet = new Set(living)
  let byeCount = 0
  for (const seat of living) {
    const opp = state.players[seat].nextOpponent ?? -1
    if (opp === -1) { byeCount++; continue }
    if (!livingSet.has(opp)) return null
    if ((state.players[opp].nextOpponent ?? -1) !== seat) return null
  }
  if (byeCount !== living.length % 2) return null

  const pairings: Array<{ a: number; b: number }> = []
  const used = new Set<number>()
  for (const seat of living) {
    if (used.has(seat)) continue
    const opp = state.players[seat].nextOpponent ?? -1
    pairings.push({ a: seat, b: opp })
    used.add(seat)
    if (opp !== -1) used.add(opp)
  }
  return pairings
}

// The PvP branch: pair every living seat (honouring last round's announcement
// when valid), settle every pair (fought recorded iff at least one seat is
// human, otherwise resolveBotFight's abstract path), replan every living bot,
// then announce next round's matchup per seat.
function resolvePvpRound(state: RunState, round: number, roundSeed: number, rng: Rng): RoundResult {
  const living = livingPlayers(state)
  const announced = pairingsFromAnnouncement(state, living)
  const pairings = announced ?? pairSeats(state, roundSeed)

  const logs: FightLog[] = []
  const seats: SeatFightResult[] = []
  const eliminated: number[] = []

  for (const pair of pairings) {
    if (pair.b === -1) {
      // Odd seat out: bye, settled as a draw — no fight recorded, matching
      // resolveBotRound's odd-bot-out handling.
      const settlement = settleSeat(state, pair.a, { won: false, draw: true, survivorStars: 0, round }, 0, rng)
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
      // Record with the human seat as seatA ('player' team, unflipped onto
      // rows 4-7) whenever exactly one side of the pairing is human, so
      // playback (Plan 05) always shows the human's own board the same way
      // every live fight did before this round engine existed, regardless of
      // which side of the pairSeats shuffle they landed on. Without this, a
      // human placed as pair.b would have their own board recorded flipped
      // and colored 'enemy' — a real, frequently hit (~50% of pairings) "the
      // rendered fight disagrees with which side is yours" bug, not a
      // cosmetic one. A human-vs-human pairing (Phase 4) has no single
      // correct seatA choice from inside this seat-agnostic function; that
      // case is unchanged (pair.a stays seatA) and left to whatever
      // per-viewer mirroring Phase 4 introduces.
      const swapped = econB.personaId === null && econA.personaId !== null
      const sa = swapped ? pair.b : pair.a
      const sb = swapped ? pair.a : pair.b

      const log = recordFight(state, sa, sb, stageOf(round))
      const logIndex = logs.push(log) - 1

      const saWon = log.winner === 'player'
      const sbWon = log.winner === 'enemy'
      const draw = log.winner === 'draw'
      const starsForSa = saWon ? 0 : log.survivorStarsB   // sa lost → sb's surviving stars
      const starsForSb = sbWon ? 0 : log.survivorStarsA   // sb lost → sa's surviving stars

      const settlementSa = settleSeat(state, sa, { won: saWon, draw, survivorStars: starsForSa, round }, log.quakesA, rng)
      const settlementSb = settleSeat(state, sb, { won: sbWon, draw, survivorStars: starsForSb, round }, log.quakesB, rng)

      seats.push({
        seat: sa, opponentSeat: sb, won: saWon, draw, survivorStars: starsForSa,
        hpLost: settlementSa.hpLost, eliminated: settlementSa.eliminated, logIndex,
      })
      seats.push({
        seat: sb, opponentSeat: sa, won: sbWon, draw, survivorStars: starsForSb,
        hpLost: settlementSb.hpLost, eliminated: settlementSb.eliminated, logIndex,
      })

      if (settlementSa.eliminated) eliminated.push(sa)
      if (settlementSb.eliminated) eliminated.push(sb)
    } else {
      const fight = resolveBotFight(econA, econB)
      const aWon = fight.winner === 'a'
      const bWon = fight.winner === 'b'
      const draw = fight.winner === 'draw'
      const starsForA = aWon ? 0 : fight.survivorStars
      const starsForB = bWon ? 0 : fight.survivorStars

      const settlementA = settleSeat(state, pair.a, { won: aWon, draw, survivorStars: starsForA, round }, fight.quakes, rng)
      const settlementB = settleSeat(state, pair.b, { won: bWon, draw, survivorStars: starsForB, round }, fight.quakes, rng)

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

  // Every living bot re-plans once, after every pair (and the bye) has
  // settled and every elimination has returned to the pool.
  planAllBots(state, rng)

  // The caller resolves its own outcome via checkGameOver(state, seat) —
  // src/main.ts for localSeatIndex today, a future room per connection
  // later. resolveRound is seat-agnostic and never decides game-over itself.
  const survivors = livingPlayers(state)

  // Announce next round's matchup per seat — computed BEFORE overwriting
  // nextOpponent below, so pairSeats' anti-rematch pass still sees THIS
  // round's just-played pairing. Generalises resolveBotRound's trailing
  // `state.nextOpponent = pickNextOpponent(...)`, made per-seat and
  // mutually consistent (survivors only — eliminated seats keep whatever
  // they had, and nothing reads it).
  const nextPairings = pairSeats(state, roundSeed + 1)
  for (const seat of survivors) state.players[seat].nextOpponent = -1
  for (const pair of nextPairings) {
    state.players[pair.a].nextOpponent = pair.b
    if (pair.b !== -1) state.players[pair.b].nextOpponent = pair.a
  }

  state.round++
  return { round, kind: 'pvp', pairings, seats, logs, eliminated, survivors }
}

// The item (Delibird) round: no fights, no pairings. Every living seat
// settles bye-shaped, then every living bot picks one item (equipBotItems
// applies it during that same botPlanRound call) and plans once. The human
// seat's own item pick is a UI choice the CALLER applies to itemBench BEFORE
// calling resolveRound — exactly as src/main.ts's finishItemRound does today.
// This function must never choose for the player.
function resolveItemRound(state: RunState, round: number, rng: Rng): RoundResult {
  const { seats, eliminated } = settleByeShaped(state, round, rng, () => 0, () => null)

  planAllBots(state, rng, bot => {
    const item = chooseBotItem(bot, botOwnedItems(bot), rng)
    if (item) bot.itemBench.push(item)
  })

  state.round++
  return { round, kind: 'item', pairings: [], seats, logs: [], eliminated, survivors: livingPlayers(state) }
}

// The creep (PvE) round: every living HUMAN seat fights the fixed creep
// board with a real recorded fight (recordCreepFight, seatB === -1); every
// living seat — human and bot alike — settles bye-shaped regardless of
// outcome, matching today's behaviour (clearing creeps costs nothing, losing
// to them costs nothing). Every living bot plans once afterward.
function resolveCreepRound(state: RunState, round: number, rng: Rng): RoundResult {
  const stage = stageOf(round)
  const logs: FightLog[] = []
  const logIndexBySeat = new Map<number, number>()

  for (const seat of livingPlayers(state)) {
    if (state.players[seat].personaId !== null) continue
    const log = recordCreepFight(state, seat, round, stage)
    logIndexBySeat.set(seat, logs.push(log) - 1)
  }

  const { seats, eliminated } = settleByeShaped(
    state, round, rng,
    seat => {
      const idx = logIndexBySeat.get(seat)
      return idx !== undefined ? logs[idx].quakesA : 0
    },
    seat => logIndexBySeat.get(seat) ?? null,
  )

  planAllBots(state, rng)

  state.round++
  return { round, kind: 'creep', pairings: [], seats, logs, eliminated, survivors: livingPlayers(state) }
}

// Dispatches on round kind — isItemRound before isCreepRound, because
// isCreepRound deliberately excludes item rounds and round 3 is both an
// opening round and an item round. Neither non-PvP branch touches any seat's
// nextOpponent: the announcement is the PvP branch's job alone, and
// clobbering it on an item/creep round would blank the `Vs {name}` indicator
// for the round after.
export function resolveRound(state: RunState, roundSeed: number): RoundResult {
  const rng = seededRng(roundSeed)
  const round = state.round
  const living = livingPlayers(state)
  const kind: RoundResult['kind'] = isItemRound(round) ? 'item' : isCreepRound(round) ? 'creep' : 'pvp'

  if (living.length === 0) {
    return { round, kind, pairings: [], seats: [], logs: [], eliminated: [], survivors: [] }
  }

  if (kind === 'item') return resolveItemRound(state, round, rng)
  if (kind === 'creep') return resolveCreepRound(state, round, rng)
  return resolvePvpRound(state, round, roundSeed, rng)
}
