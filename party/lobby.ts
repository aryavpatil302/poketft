// The PartyKit room: owns exactly one authoritative RunState per lobby.
// Sanctioned exception to the project's named-exports-only convention —
// PartyKit's loader requires a default export.
//
// Imports must stay relative (no path aliases in this project) and must not
// reach into src/main.ts, src/render/, or src/ui/ — all browser-only and
// would drag DOM globals into the Workers bundle.

import type * as Party from 'partykit/server'
import { applyAction, startPlanning } from '../src/game/round'
import type { RunState } from '../src/econ/runState'
import {
  newRoomRun, newSeatTable, assignSeat, freeSeat, seatOf, lobbyView,
  type SeatTable,
} from './seats'
import {
  PROTOCOL_VERSION,
  MAX_ACTIONS_PER_PHASE,
  parseClientMessage,
  type RoomPhase,
  type ServerMessage,
} from '../src/net/protocol'

const MAX_MESSAGE_LENGTH = 4096

export default class Lobby implements Party.Server {
  run!: RunState
  table!: SeatTable
  phase: RoomPhase = 'idle'

  // Per-connection-id action budget for this planning phase. Reset on
  // connect (a fresh connection should not inherit a stale counter from a
  // previous occupant of the same seat) and on resetActionBudget(), which
  // Plan 03-04 will call at the start of every new planning phase.
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
    // accepted mutation.
    await this.room.storage.put('run', this.run)
  }

  // Called on connect (a fresh connection starts unpenalized) and, from
  // Plan 03-04, at the start of every new planning phase.
  resetActionBudget(connId: string): void {
    this.actionBudget.set(connId, 0)
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

    const wasFirstHuman = this.phase === 'idle'
    if (wasFirstHuman) {
      startPlanning(this.run)
      this.phase = 'planning'
    }

    await this.persist()

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
      connections: Array.from(this.room.getConnections()).length,
      storageKeys,
      seats: lobbyView(this.run, this.table).map(s => ({ seat: s.seat, human: s.human })),
    }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  }
}
