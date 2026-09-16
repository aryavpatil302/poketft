// The PartyKit room: owns exactly one authoritative RunState per lobby.
// Sanctioned exception to the project's named-exports-only convention —
// PartyKit's loader requires a default export.
//
// Imports must stay relative (no path aliases in this project) and must not
// reach into src/main.ts, src/render/, or src/ui/ — all browser-only and
// would drag DOM globals into the Workers bundle.

import type * as Party from 'partykit/server'
import { applyAction, startPlanning, resolveRound, type RoundResult } from '../src/game/round'
import { resolvePendingCombines } from '../src/econ/combine'
import { isItemRound, rollItemChoices, autoPickItemChoice, ownedItemIds } from '../src/econ/creeps'
import type { RunState } from '../src/econ/runState'
import {
  newRoomRun, newSeatTable, assignSeat, freeSeat, seatOf, lobbyView,
  type SeatTable,
} from './seats'
import {
  PROTOCOL_VERSION,
  planningMsFor,
  skipPlaybackDelay,
  MAX_ACTIONS_PER_PHASE,
  parseClientMessage,
  type RoomPhase,
  type ServerMessage,
} from '../src/net/protocol'
import { encodeFightLog, type FightChunk } from '../src/net/fightWire'
import { TICK_RATE } from '../src/core/constants'

const MAX_MESSAGE_LENGTH = 4096
// Fallback-only safety margin for waitForPlaybackAcks: every connected seat
// with a real fight to watch is expected to explicitly ack ("playback-done")
// once its own client finishes, so the room advances the instant everyone
// genuinely has — not on a guess. This buffer, added on top of the minimum
// possible playback duration (frames / TICK_RATE), only matters for a
// disconnected/crashed/permanently-backgrounded client that never acks, so
// it can afford to be generous rather than tight.
const ACK_TIMEOUT_BUFFER_MS = 8000

// Hashes the room id into a seed, mixed with the round number, for
// resolveRound's seat-pairing rng. FNV-1a-style string fold — cheap, no
// dependency, stable across runs of the same room id.
//
// This seed decides seat PAIRING ONLY. Combat itself draws from
// Math.random() inside resolveRound's recorded fights — this project
// deliberately cut deterministic seed-replay (see src/net/fightWire.ts's
// header comment) — so this value is not a replay handle and nothing
// downstream may treat it as one.
function roundSeedFor(roomId: string, round: number): number {
  let hash = 2166136261
  for (let i = 0; i < roomId.length; i++) {
    hash ^= roomId.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash = hash ^ Math.imul(round, 2654435761)
  return hash >>> 0
}

export default class Lobby implements Party.Server {
  run!: RunState
  table!: SeatTable
  phase: RoomPhase = 'idle'

  // Whether this room has EVER left the lobby, i.e. whether beginPlanning()
  // has run at least once. Persisted alongside `run` (see persist()) rather
  // than inferred from object freshness, because onStart runs on every
  // rehydration — hibernation, a `partykit dev` restart, a Cloudflare
  // eviction in Phase 5 — not only on the room's first ever start. Inferring
  // "fresh object means lobby" would send a mid-game room back to the lobby
  // screen and stall its round loop until someone pressed Start again.
  started = false

  // Absolute epoch-ms deadline for the current planning phase, and the
  // scheduled timer that fires onDeadline() when it arrives. Both null
  // outside 'planning' (or, transiently, right after a fresh onStart before
  // the first connection opens the loop).
  deadline: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  // Ack-tracking for waitForPlaybackAcks: the set of seats still owed for
  // the round named by pendingAckRound, the resolve fn of the Promise that
  // call is awaiting, and the fallback timer backstopping it. All null
  // outside an active wait (i.e. outside 'resolving', between resolveRound
  // returning and beginPlanning() being called).
  private pendingAcks: Set<number> | null = null
  private pendingAckRound: number | null = null
  private ackWaitResolve: (() => void) | null = null
  private ackTimeoutTimer: ReturnType<typeof setTimeout> | null = null

  // Item-pick tracking for resolveItemChoices: the offered choices per seat
  // still owed a pick this item round, the round they were offered for, the
  // resolve fn of the Promise that call is awaiting, and its fallback timer.
  // All null outside an active item-round wait.
  private pendingItemPicks: Map<number, string[]> | null = null
  private pendingItemPickRound: number | null = null
  private itemPickResolve: (() => void) | null = null
  private itemPickTimer: ReturnType<typeof setTimeout> | null = null

  // Per-connection-id action budget for this planning phase. Reset on
  // connect (a fresh connection should not inherit a stale counter from a
  // previous occupant of the same seat) and, with no argument, at the start
  // of every new planning phase (beginPlanning()) — every currently-tracked
  // connection's budget resets together so it never leaks across a round
  // boundary.
  private actionBudget = new Map<string, number>()

  constructor(readonly room: Party.Room) {}

  async onStart(): Promise<void> {
    this.run = (await this.room.storage.get<RunState>('run')) ?? newRoomRun()
    // The seat table is deliberately NOT persisted: connection ids do not
    // survive a room restart, so occupancy must be rebuilt from live
    // connections, never from storage.
    this.table = newSeatTable(this.run)
    // A room that restarted while humans were seated must not resume with
    // ownerless human seats: force every seat's personaId back to its
    // roster value now that the (fresh, all-null) occupants table above
    // says every seat is bot-held again.
    for (let i = 0; i < this.run.players.length; i++) {
      this.run.players[i].personaId = this.table.roster[i].personaId
    }
    this.started = (await this.room.storage.get<boolean>('started')) ?? false
    // A started room comes back 'idle' — the clock is stopped but the game is
    // live, and onConnect's resume branch reopens planning on the next
    // connection with no second Start. A never-started room comes back
    // 'lobby' and waits for its host.
    this.phase = this.started ? 'idle' : 'lobby'
  }

  private async persist(): Promise<void> {
    // The measured RunState is about 5 KiB serialized, comfortably under the
    // 128 KiB Durable Object per-value limit — safe to persist after every
    // accepted mutation. This is the ONLY key this room ever writes: a
    // fight log is 19-34 MiB against a 128 KiB per-value limit, so a log
    // must never reach this call — it would fail at runtime, not build
    // time. broadcastResolve() streams logs over the wire only, never here.
    //
    // `started` is the room's only other key: a single boolean, so the
    // oversized-value reasoning above is untouched by it (see
    // scripts/roomRound.ts scenario 6, which asserts storage holds exactly
    // these two keys and nothing log-shaped).
    await this.room.storage.put('run', this.run)
    await this.room.storage.put('started', this.started)
  }

  // Called with a connId on connect (a fresh connection starts unpenalized).
  // Called with no argument at the start of every new planning phase
  // (beginPlanning()) to reset every currently-tracked connection at once.
  resetActionBudget(connId?: string): void {
    if (connId !== undefined) {
      this.actionBudget.set(connId, 0)
      return
    }
    for (const id of this.actionBudget.keys()) this.actionBudget.set(id, 0)
  }

  private broadcastPhase(): void {
    this.room.broadcast(JSON.stringify(
      { t: 'phase', phase: this.phase, round: this.run.round, deadline: this.deadline, serverNow: Date.now() } satisfies ServerMessage,
    ))
  }

  // Advances the economy to the next round's starting state — banks pending
  // income and rolls each seat's shop respecting shopLocked (startPlanning),
  // plus resets every connection's action budget together. Split out from
  // the old beginPlanning() so onDeadline() can run this IMMEDIATELY,
  // synchronously, right after resolveRound() returns (before this
  // function's own first await) — see onDeadline's comment on why that
  // ordering is what makes it safe for onMessage to accept actions the
  // instant phase flips to 'resolving': there is never a tick where phase
  // is 'resolving' but the shop hasn't been rolled yet. Also what makes
  // reroll/lock/buy/buyXp all safe to allow during that window — the shop
  // they'd act on is this round's real one, rolled exactly once, not a
  // stale leftover that startPlanning would otherwise silently replace out
  // from under a reroll later.
  private advanceEconomy(): void {
    startPlanning(this.run)
    this.resetActionBudget()
  }

  // Opens the visible planning window: flip the phase, set an absolute
  // deadline, schedule the timer that fires resolution when it arrives, and
  // broadcast. Does NOT roll the shop or reset the action budget itself
  // (advanceEconomy already did, earlier — see its own header) except when
  // called via beginPlanning() below for a room with no preceding combat.
  // Also runs resolvePendingCombines() first: any purchase during the
  // combat/wait window that was deferred because completing its triple
  // would have consumed a currently-fielded copy (src/econ/shop.ts's
  // allowBoardConsumption) resolves right here, at the same synchronized
  // instant every connected seat's board/bench becomes live again.
  //
  // Uses setTimeout rather than a Durable Object alarm: connections keep the
  // room alive for the whole planning window, hibernation is not enabled
  // here, and a plain timer is directly observable from the Node harness
  // (scripts/roomRound.ts). Alarm-based scheduling (this.room.storage.
  // setAlarm(this.deadline) with onAlarm() calling onDeadline()) is the
  // hardening path if a room ever needs to resolve with nobody connected —
  // which this milestone explicitly does not do (see onClose below).
  private async openPlanningWindow(): Promise<void> {
    resolvePendingCombines(this.run)
    this.phase = 'planning'
    // Set BEFORE the persist() below so the flag and the run it belongs to
    // are written in the same call — a room cannot come back from storage
    // holding a mid-game run while still claiming it never started.
    this.started = true
    // planningMsFor reads this room's --var PLANNING_MS override (test
    // harnesses only) or falls back to the real gameplay default — see
    // src/net/protocol.ts's comment on why this reads room.env and not
    // process.env.
    const planningMs = planningMsFor(this.room.env)
    this.deadline = Date.now() + planningMs
    this.timer = setTimeout(() => void this.onDeadline(), planningMs)

    await this.persist()
    this.broadcastPhase()
    this.room.broadcast(JSON.stringify({ t: 'snapshot', snapshot: this.run } satisfies ServerMessage))
  }

  // Composition of both steps above, for the two callers with no preceding
  // combat to have already advanced economy for: onConnect's resume-the-loop
  // case, and the host's 'start' message (src/net/protocol.ts's
  // ClientMessage). onDeadline calls the two pieces separately instead (see
  // its own comment).
  private async beginPlanning(): Promise<void> {
    this.advanceEconomy()
    await this.openPlanningWindow()
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.deadline = null
  }

  // Sends each connected seat its settled result plus, when and only when it
  // actually fought, the exact recorded fight. Called from onDeadline after
  // the settled snapshot is persisted and before the next beginPlanning().
  private async broadcastResolve(result: RoundResult): Promise<void> {
    // Encode each distinct log exactly once, keyed by logIndex. Two seats
    // sharing a logIndex therefore share one fightId and one chunk array —
    // precisely what makes a human-vs-human matchup produce a single fight
    // both players watch. Encoding per-seat instead would be both twice the
    // CPU and a correctness hazard, since two separately-encoded copies
    // could in principle diverge.
    const encoded = new Map<number, { fightId: string; chunks: FightChunk[] }>()
    for (const seatResult of result.seats) {
      if (seatResult.logIndex === null || encoded.has(seatResult.logIndex)) continue
      const fightId = `${this.room.id}:${result.round}:${seatResult.logIndex}`
      const chunks = await encodeFightLog(result.logs[seatResult.logIndex], fightId)
      encoded.set(seatResult.logIndex, { fightId, chunks })
    }

    let totalChunks = 0
    let totalBytes = 0

    for (const conn of this.room.getConnections()) {
      const seat = seatOf(this.table, conn.id)
      if (seat === null) continue
      const seatResult = result.seats.find(s => s.seat === seat) ?? null
      // A seat whose logIndex is null — a bye, an abstractly-resolved
      // bot-vs-bot pairing, or an item round, which records no fights at
      // all — gets a resolve with fightId: null and ZERO chunk messages.
      // Guarded explicitly rather than relying on an empty loop: indexing
      // result.logs with a null would produce undefined and hand
      // encodeFightLog a log-shaped nothing.
      const entry = seatResult?.logIndex != null ? encoded.get(seatResult.logIndex) : undefined

      conn.send(JSON.stringify({
        t: 'resolve',
        round: result.round,
        kind: result.kind,
        snapshot: this.run,
        seat: seatResult,
        fightId: entry?.fightId ?? null,
        eliminated: result.eliminated,
        survivors: result.survivors,
      } satisfies ServerMessage))

      if (entry) {
        // Per-connection ordering is FIFO, so these chunks arrive after the
        // resolve that announced them and in index order — the client still
        // reassembles by index, never by arrival, since ordering ACROSS
        // connections is unspecified.
        for (const chunk of entry.chunks) {
          conn.send(JSON.stringify({ t: 'fight-chunk', chunk } satisfies ServerMessage))
          totalChunks++
          totalBytes += chunk.gzipB64.length
        }
      }
    }

    // The only visibility into per-round bandwidth before Phase 5 puts this
    // on a real internet link.
    console.log(
      `[room ${this.room.id}] round ${result.round} (${result.kind}) resolved: ` +
      `${encoded.size} distinct log(s), ${totalChunks} chunk(s) sent, ${totalBytes} base64 bytes total`,
    )
  }

  // Fires when a planning phase's deadline arrives. Ordering here is
  // load-bearing (see the plan's must_haves): the phase flips to 'resolving'
  // as the FIRST statement, before clearTimer or resolveRound run, so there
  // is a deterministic answer to "which side of the deadline did this
  // action land on" — the room is a single-threaded Durable Object, so the
  // event loop (not a race) decides, and onMessage's phase guard reads
  // exactly this flag.
  private async onDeadline(): Promise<void> {
    this.phase = 'resolving'
    this.clearTimer()

    // Delibird's Gift: if the round about to resolve is an item round, every
    // connected human seat needs a real chance to choose before
    // resolveItemRound (src/game/round.ts) runs — its own header comment
    // states the human's pick must already be on itemBench BEFORE it's
    // called; it never chooses for a player itself. Waits for every
    // connected seat to pick or a timeout, auto-picking for stragglers, and
    // applies every final pick before resolveRound below.
    if (isItemRound(this.run.round)) await this.resolveItemChoices(this.run.round)

    const result = resolveRound(this.run, roundSeedFor(this.room.id, this.run.round))
    // Do NOT increment this.run.round here — resolveRound already does it
    // internally; doing it twice would skip every other round, including
    // the creep/item rounds keyed on specific round numbers.

    // Advance economy for the round that just started (bank income, roll
    // shop) IMMEDIATELY, synchronously, in the same tick resolveRound() ran
    // in — before any await below. Skipped when the game just ended (no
    // shop to roll for a seat that's about to see 'over'). This is what
    // lets onMessage safely accept buy/sell/reroll/buyXp/lock the instant
    // phase becomes 'resolving': see advanceEconomy's own header for why.
    if (result.survivors.length > 1) this.advanceEconomy()

    await this.persist()
    await this.broadcastResolve(result)

    if (result.survivors.length <= 1) {
      this.phase = 'over'
      this.broadcastPhase()
      return
    }

    // Wait for combat playback to actually finish before opening the next
    // shop window. Without this, openPlanningWindow() below would start
    // round N+1's 30s countdown the instant this round's fight logs are
    // encoded (near-instant, computationally) — completely unsynchronized
    // with how long clients spend animating the fight they just received. A
    // player could then return from watching combat to find their shop time
    // already half gone, or in an extreme case find the round had already
    // resolved again before they ever saw it. See waitForPlaybackAcks for
    // how "actually finish" is decided. Economy actions (and this seat's
    // shop) are already live throughout this wait, per advanceEconomy above
    // — only the visible planning screen itself waits for everyone.
    await this.waitForPlaybackAcks(result)

    await this.openPlanningWindow()
  }

  // Waits until every currently-connected seat that actually has a recorded
  // fight this round (result.seats[].logIndex !== null) has told us it's
  // done watching (onMessage's 'playback-done' case), or a generous fallback
  // timeout elapses — whichever comes first. Seats with nothing to watch
  // (a bye, an abstractly-resolved bot-vs-bot pairing, an item round) and
  // seats with no live connection (bot-controlled, or a human who dropped)
  // are never waited on.
  private async waitForPlaybackAcks(result: RoundResult): Promise<void> {
    if (skipPlaybackDelay(this.room.env)) return   // unchanged: test harnesses

    const required = new Set<number>()
    for (const conn of this.room.getConnections()) {
      const seat = seatOf(this.table, conn.id)
      if (seat === null) continue
      const seatResult = result.seats.find(s => s.seat === seat)
      if (seatResult?.logIndex != null) required.add(seat)
    }
    if (required.size === 0) return   // nobody connected has anything to watch

    this.pendingAckRound = result.round
    this.pendingAcks = required

    // Fallback only — should rarely fire. Protects against a disconnected,
    // crashed, or permanently-backgrounded client stalling the whole room.
    // Generous on purpose: this is no longer the primary timing mechanism,
    // just a backstop for it.
    const longestFrameCount = Math.max(0, ...result.logs.map(log => log.frames.length))
    const timeoutMs = (longestFrameCount / TICK_RATE) * 1000 + ACK_TIMEOUT_BUFFER_MS

    await new Promise<void>(resolve => {
      this.ackWaitResolve = resolve
      this.ackTimeoutTimer = setTimeout(() => this.resolveAckWait(), timeoutMs)
    })
  }

  // Clears whatever's pending and resolves the wait, exactly once. Called
  // from the fallback timeout, from onMessage once the required set empties,
  // and from onClose if a required seat disconnects mid-wait. Safe to call
  // when nothing is pending (e.g. a stale event after an earlier resolve).
  private resolveAckWait(): void {
    if (this.ackTimeoutTimer !== null) { clearTimeout(this.ackTimeoutTimer); this.ackTimeoutTimer = null }
    const resolve = this.ackWaitResolve
    this.ackWaitResolve = null
    this.pendingAcks = null
    this.pendingAckRound = null
    resolve?.()
  }

  // Rolls each connected human seat's 3 Delibird choices, sends them
  // per-connection (never broadcast — every seat's 3 differ), and waits
  // until every seat has sent a valid pick or a timeout elapses (the same
  // 30s default/test-override a planning phase uses, via planningMsFor) —
  // whichever comes first. Applies every final pick — explicit or
  // auto-picked for a straggler at timeout — to itemBench before returning,
  // so resolveItemRound (src/game/round.ts) sees it already there,
  // fulfilling its own documented contract for the first time in networked
  // play. A seat with no live connection (bot-controlled, or a human who
  // dropped — already reverted to its bot persona) is never waited on;
  // resolveItemRound's own bot-planning pass picks for it exactly as today.
  private async resolveItemChoices(round: number): Promise<void> {
    const pending = new Map<number, string[]>()
    for (const conn of this.room.getConnections()) {
      const seat = seatOf(this.table, conn.id)
      if (seat === null) continue
      const econ = this.run.players[seat]
      if (!econ || econ.eliminated) continue
      const choices = rollItemChoices(ownedItemIds(econ), Math.random)
      pending.set(seat, choices)
      const deadline = Date.now() + planningMsFor(this.room.env)
      conn.send(JSON.stringify({ t: 'item-choices', round, choices, deadline, serverNow: Date.now() } satisfies ServerMessage))
    }
    if (pending.size === 0) return   // nobody connected needs to pick

    this.pendingItemPickRound = round
    this.pendingItemPicks = pending

    const timeoutMs = planningMsFor(this.room.env)
    await new Promise<void>(resolve => {
      this.itemPickResolve = resolve
      this.itemPickTimer = setTimeout(() => this.resolveItemPickWait(), timeoutMs)
    })
  }

  // Clears whatever's pending, auto-picking (from each straggler's OWN
  // offered choices, never an arbitrary one) for any seat that never sent a
  // valid pick, then resolves the wait exactly once. Called from the
  // fallback timeout, from onMessage once every seat has picked, and from
  // onClose if a seat disconnects mid-wait.
  private resolveItemPickWait(): void {
    if (this.itemPickTimer !== null) { clearTimeout(this.itemPickTimer); this.itemPickTimer = null }
    if (this.pendingItemPicks) {
      for (const [seat, choices] of this.pendingItemPicks) {
        const econ = this.run.players[seat]
        const picked = autoPickItemChoice(choices)
        if (econ && picked) econ.itemBench.push(picked)
      }
    }
    const resolve = this.itemPickResolve
    this.itemPickResolve = null
    this.pendingItemPicks = null
    this.pendingItemPickRound = null
    resolve?.()
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): Promise<void> {
    // Read the display name once, at connect time, from the connection
    // URL's query string — never from a message, so a seated connection's
    // name cannot be changed later by a crafted payload.
    const name = new URL(ctx.request.url).searchParams.get('name')
    const seat = assignSeat(this.run, this.table, conn.id, name)
    if (seat === null) {
      conn.send(JSON.stringify({ t: 'rejected', reason: 'not-seated' } satisfies ServerMessage))
      conn.close()
      return
    }
    this.resetActionBudget(conn.id)

    if (this.phase === 'idle') {
      // A STARTED room whose clock is stopped — everyone left (onClose), or
      // it just rehydrated (onStart) — reopens its round loop on the next
      // connection with no second Start required; beginPlanning() itself
      // persists and broadcasts. This is what scripts/roomRound.ts scenario
      // 7's resume behaviour rides on.
      await this.beginPlanning()
    } else {
      // 'lobby' lands here too: seats fill and the welcome/lobby broadcasts
      // below run, but no timer starts until the host sends `start`.
      await this.persist()
    }

    const welcome: ServerMessage = {
      t: 'welcome',
      protocol: PROTOCOL_VERSION,
      seat,
      snapshot: this.run,
      lobby: lobbyView(this.run, this.table),
      phase: this.phase,
      round: this.run.round,
    }
    conn.send(JSON.stringify(welcome))
    if (this.phase === 'planning') {
      // A connection joining mid-planning-phase needs the live deadline
      // immediately, so its countdown is correct from the server's real
      // clock rather than starting fresh from an assumed duration.
      conn.send(JSON.stringify(
        { t: 'phase', phase: this.phase, round: this.run.round, deadline: this.deadline, serverNow: Date.now() } satisfies ServerMessage,
      ))
    }
    this.room.broadcast(JSON.stringify({ t: 'lobby', lobby: lobbyView(this.run, this.table) } satisfies ServerMessage))
    this.room.broadcast(
      JSON.stringify({ t: 'seat-taken', seat, name: this.run.players[seat].name } satisfies ServerMessage),
    )
  }

  async onClose(conn: Party.Connection): Promise<void> {
    this.actionBudget.delete(conn.id)
    const seat = freeSeat(this.run, this.table, conn.id)
    if (seat === null) return

    // A seat we were still waiting on for this round's playback ack just
    // left — stop waiting on it rather than stalling everyone else's next
    // round for the full fallback timeout.
    if (this.pendingAcks?.has(seat)) {
      this.pendingAcks.delete(seat)
      if (this.pendingAcks.size === 0) this.resolveAckWait()
    }

    // Same idea for a seat mid-item-pick: auto-pick from ITS OWN offered
    // choices immediately (matching how a disconnected human seat already
    // gets bot-quality treatment everywhere else, rather than silently
    // getting nothing) rather than stalling everyone else for the full wait.
    if (this.pendingItemPicks?.has(seat)) {
      const choices = this.pendingItemPicks.get(seat)!
      const econ = this.run.players[seat]
      const picked = autoPickItemChoice(choices)
      if (econ && picked) econ.itemBench.push(picked)
      this.pendingItemPicks.delete(seat)
      if (this.pendingItemPicks.size === 0) this.resolveItemPickWait()
    }

    await this.persist()
    this.room.broadcast(JSON.stringify({ t: 'lobby', lobby: lobbyView(this.run, this.table) } satisfies ServerMessage))
    this.room.broadcast(
      JSON.stringify({ t: 'seat-freed', seat, name: this.run.players[seat].name } satisfies ServerMessage),
    )

    if (Array.from(this.room.getConnections()).length === 0) {
      // Nobody is watching — stop burning a timer and resume the loop on
      // the next connect. The settled economy is preserved either way; this
      // just stops the clock, it never touches this.run.
      this.clearTimer()
      this.phase = 'idle'
    }
  }

  async onMessage(raw: string, sender: Party.Connection): Promise<void> {
    if (raw.length > MAX_MESSAGE_LENGTH) {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'too-large' } satisfies ServerMessage))
      return
    }

    const usedSoFar = this.actionBudget.get(sender.id) ?? 0
    if (usedSoFar >= MAX_ACTIONS_PER_PHASE) {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'rate-limited' } satisfies ServerMessage))
      return
    }
    this.actionBudget.set(sender.id, usedSoFar + 1)

    const msg = parseClientMessage(raw)
    if (!msg) {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'malformed' } satisfies ServerMessage))
      return
    }

    // sender.id is the ONLY seat authority in this room: no branch anywhere
    // in this file may resolve a seat from parsed message content. This
    // mirrors the comment applyAction already carries on its own `seat`
    // parameter (src/game/round.ts) — this call site is the boundary that
    // guard was written for.
    const seat = seatOf(this.table, sender.id)
    if (seat === null) {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'not-seated' } satisfies ServerMessage))
      return
    }

    if (msg.t === 'start') {
      // Handled BEFORE the planning-phase guard below, which exists for
      // actions only — a `start` is by definition sent while the room is
      // NOT in 'planning'.
      if (seat !== 0) {
        sender.send(JSON.stringify({ t: 'rejected', reason: 'not-host' } satisfies ServerMessage))
        return
      }
      if (this.phase !== 'lobby') {
        sender.send(JSON.stringify({ t: 'rejected', reason: 'already-started' } satisfies ServerMessage))
        return
      }
      await this.beginPlanning()
      return
    }

    if (msg.t === 'playback-done') {
      // Also handled before the planning-phase guard: this always arrives
      // while phase === 'resolving' (see waitForPlaybackAcks), never
      // 'planning'. Silently ignored if it doesn't match the round we're
      // actually waiting on — a late/stale ack from a round the room has
      // already moved past, or one that arrived with no wait in progress.
      if (this.pendingAcks !== null && this.pendingAckRound === msg.round) {
        this.pendingAcks.delete(seat)
        if (this.pendingAcks.size === 0) this.resolveAckWait()
      }
      return
    }

    if (msg.t === 'pickItem') {
      // Also handled before the planning-phase guard: this always arrives
      // while phase === 'resolving' (see resolveItemChoices), never
      // 'planning'. Silently ignored if it doesn't match the round we're
      // actually waiting on, exactly like playback-done above — EXCEPT an
      // itemId that isn't one of this seat's own 3 offered choices, which
      // is reported back rather than silently dropped (a real client can
      // only ever construct this from stale/forged input, worth surfacing).
      if (this.pendingItemPicks !== null && this.pendingItemPickRound === msg.round) {
        const choices = this.pendingItemPicks.get(seat)
        if (choices !== undefined) {
          if (!choices.includes(msg.itemId)) {
            sender.send(JSON.stringify({ t: 'rejected', reason: 'invalid-item' } satisfies ServerMessage))
            return
          }
          this.run.players[seat].itemBench.push(msg.itemId)
          this.pendingItemPicks.delete(seat)
          if (this.pendingItemPicks.size === 0) this.resolveItemPickWait()
        }
      }
      return
    }

    // An action is applied if and only if the phase is 'planning' OR
    // 'resolving' — i.e. buy/sell/reroll/buyXp/lock work throughout the
    // combat/celebration window too, not only during the dedicated planning
    // screen. Safe specifically because advanceEconomy() (see onDeadline)
    // runs synchronously, before any await, the instant phase becomes
    // 'resolving' — there is no tick where 'resolving' means "shop not
    // rolled yet." Rejected everywhere else ('lobby'/'idle'/'over'):
    // applying a buy there would act on a RunState with no live round at
    // all. Deliberately dropped, never queued.
    if (this.phase !== 'planning' && this.phase !== 'resolving') {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'wrong-phase' } satisfies ServerMessage))
      return
    }

    // A board-fielded copy is never consumed to complete a triple while
    // combat for this round is still playing back (this.phase ===
    // 'resolving') — see src/econ/shop.ts's buyUnit and combine.ts's
    // mergeOnce. resolvePendingCombines (openPlanningWindow) sweeps up
    // anything deferred the instant the next planning phase opens.
    const result = applyAction(this.run, seat, msg.action, Math.random, this.phase !== 'resolving')
    if (!result.ok) {
      sender.send(JSON.stringify({ t: 'rejected', reason: result.reason } satisfies ServerMessage))
      return
    }

    await this.persist()
    this.room.broadcast(JSON.stringify({ t: 'snapshot', snapshot: this.run } satisfies ServerMessage))
  }

  async onRequest(_req: Party.Request): Promise<Response> {
    const storageKeys = Array.from((await this.room.storage.list()).keys()).sort()
    // Deliberately exposes only room metadata — no RunState, no seat
    // contents, no player names (see T-03-08). `seats` reports occupancy
    // only (seat index + human flag), never a name or HP.
    const body = {
      ok: true,
      room: this.room.id,
      phase: this.phase,
      round: this.run.round,
      deadline: this.deadline,
      timerScheduled: this.timer !== null,
      connections: Array.from(this.room.getConnections()).length,
      storageKeys,
      seats: lobbyView(this.run, this.table).map(s => ({ seat: s.seat, human: s.human })),
    }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  }
}
