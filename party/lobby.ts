// The PartyKit room: owns exactly one authoritative RunState per lobby.
// Sanctioned exception to the project's named-exports-only convention —
// PartyKit's loader requires a default export.
//
// Imports must stay relative (no path aliases in this project) and must not
// reach into src/main.ts, src/render/, or src/ui/ — all browser-only and
// would drag DOM globals into the Workers bundle.

import type * as Party from 'partykit/server'
import { applyAction, startPlanning, resolveRound, type RoundResult } from '../src/game/round'
import type { RunState } from '../src/econ/runState'
import {
  newRoomRun, newSeatTable, assignSeat, freeSeat, seatOf, lobbyView,
  type SeatTable,
} from './seats'
import {
  PROTOCOL_VERSION,
  planningMsFor,
  MAX_ACTIONS_PER_PHASE,
  parseClientMessage,
  type RoomPhase,
  type ServerMessage,
} from '../src/net/protocol'
import { encodeFightLog, type FightChunk } from '../src/net/fightWire'

const MAX_MESSAGE_LENGTH = 4096

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

  // Absolute epoch-ms deadline for the current planning phase, and the
  // scheduled timer that fires onDeadline() when it arrives. Both null
  // outside 'planning' (or, transiently, right after a fresh onStart before
  // the first connection opens the loop).
  deadline: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

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
    this.phase = 'idle'
  }

  private async persist(): Promise<void> {
    // The measured RunState is about 5 KiB serialized, comfortably under the
    // 128 KiB Durable Object per-value limit — safe to persist after every
    // accepted mutation. This is the ONLY key this room ever writes: a
    // fight log is 19-34 MiB against a 128 KiB per-value limit, so a log
    // must never reach this call — it would fail at runtime, not build
    // time. broadcastResolve() streams logs over the wire only, never here.
    await this.room.storage.put('run', this.run)
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

  // Opens a new planning phase: bank pending income + roll shops
  // (startPlanning), flip the phase, set an absolute deadline, reset every
  // connection's action budget together, and schedule the timer that fires
  // resolution when the deadline arrives.
  //
  // Uses setTimeout rather than a Durable Object alarm: connections keep the
  // room alive for the whole planning window, hibernation is not enabled
  // here, and a plain timer is directly observable from the Node harness
  // (scripts/roomRound.ts). Alarm-based scheduling (this.room.storage.
  // setAlarm(this.deadline) with onAlarm() calling onDeadline()) is the
  // hardening path if a room ever needs to resolve with nobody connected —
  // which this milestone explicitly does not do (see onClose below).
  private async beginPlanning(): Promise<void> {
    startPlanning(this.run)
    this.phase = 'planning'
    // planningMsFor reads this room's --var PLANNING_MS override (test
    // harnesses only) or falls back to the real gameplay default — see
    // src/net/protocol.ts's comment on why this reads room.env and not
    // process.env.
    const planningMs = planningMsFor(this.room.env)
    this.deadline = Date.now() + planningMs
    this.resetActionBudget()
    this.timer = setTimeout(() => void this.onDeadline(), planningMs)

    await this.persist()
    this.broadcastPhase()
    this.room.broadcast(JSON.stringify({ t: 'snapshot', snapshot: this.run } satisfies ServerMessage))
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

    const result = resolveRound(this.run, roundSeedFor(this.room.id, this.run.round))
    // Do NOT increment this.run.round here — resolveRound already does it
    // internally; doing it twice would skip every other round, including
    // the creep/item rounds keyed on specific round numbers.
    await this.persist()
    await this.broadcastResolve(result)

    if (result.survivors.length <= 1) {
      this.phase = 'over'
      this.broadcastPhase()
      return
    }
    await this.beginPlanning()
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
      // The first human seat of a fresh (or emptied-out) room opens the
      // round loop; beginPlanning() itself persists and broadcasts.
      await this.beginPlanning()
    } else {
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

    // An action is applied if and only if its handler runs while the phase
    // is still 'planning'. Deliberately dropped, never queued: applying a
    // buy after settlement would spend post-settlement gold against a
    // pre-settlement shop that no longer exists.
    if (this.phase !== 'planning') {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'wrong-phase' } satisfies ServerMessage))
      return
    }

    const result = applyAction(this.run, seat, msg.action)
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
