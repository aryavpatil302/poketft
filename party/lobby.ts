// The PartyKit room: owns exactly one authoritative RunState per lobby.
// Sanctioned exception to the project's named-exports-only convention —
// PartyKit's loader requires a default export.
//
// Imports must stay relative (no path aliases in this project) and must not
// reach into src/main.ts, src/render/, or src/ui/ — all browser-only and
// would drag DOM globals into the Workers bundle.

import type * as Party from 'partykit/server'
import { applyAction, startPlanning } from '../src/game/round'
import { newRun, type RunState } from '../src/econ/runState'
import { PERSONAS, botSeats } from '../src/econ/bots'
import { pickRandomNames } from '../src/econ/botNames'
import { PLAYER_COUNT } from '../src/econ/constants'
import {
  PROTOCOL_VERSION,
  parseClientMessage,
  type RoomPhase,
  type LobbySeatView,
  type ServerMessage,
} from '../src/net/protocol'

const MAX_MESSAGE_LENGTH = 4096

// A room has no privileged human seat — every seat starts bot-held. With 6
// seats and 5 personas, seats 0 and 5 share a persona id; that's fine, a
// persona is a decision-weight profile, not an identity.
function newRoomRun(): RunState {
  const run = newRun(botSeats())
  const names = pickRandomNames(PLAYER_COUNT)
  for (let i = 0; i < run.players.length; i++) {
    const persona = PERSONAS[i % PERSONAS.length]
    run.players[i].personaId = persona.id
    run.players[i].name = names[i] ?? persona.name
  }
  // newRun() alone leaves everyone at STARTING_GOLD (0) — round 1 would be an
  // unaffordable empty shop. src/main.ts's initFreshRun (browser-only, not
  // importable here) grants every fresh single-player run the same small
  // stake before the first roll; mirrored here so the room matches
  // single-player's fresh-run behavior instead of diverging from it.
  for (const p of run.players) p.gold = 5
  return run
}

function lobbyView(run: RunState, occupants: (string | null)[]): LobbySeatView[] {
  return run.players.map((p, seat) => ({
    seat,
    name: p.name,
    hp: p.hp,
    human: occupants[seat] !== null,
    eliminated: p.eliminated,
  }))
}

export default class Lobby implements Party.Server {
  run!: RunState
  occupants: (string | null)[] = []
  phase: RoomPhase = 'idle'

  constructor(readonly room: Party.Room) {}

  async onStart(): Promise<void> {
    this.run = (await this.room.storage.get<RunState>('run')) ?? newRoomRun()
    this.occupants = Array(PLAYER_COUNT).fill(null)
    this.phase = 'idle'
  }

  private async persist(): Promise<void> {
    // The measured RunState is about 5 KiB serialized, comfortably under the
    // 128 KiB Durable Object per-value limit — safe to persist after every
    // accepted mutation.
    await this.room.storage.put('run', this.run)
  }

  async onConnect(conn: Party.Connection): Promise<void> {
    const seat = this.occupants.findIndex(o => o === null)
    if (seat === -1) {
      conn.send(JSON.stringify({ t: 'rejected', reason: 'not-seated' } satisfies ServerMessage))
      conn.close()
      return
    }

    const wasEmpty = this.occupants.every(o => o === null)
    this.occupants[seat] = conn.id
    // Setting personaId to null is what makes the seat human — the same
    // discriminator Phase 1 and Phase 2 settle on.
    this.run.players[seat].personaId = null

    if (wasEmpty) {
      startPlanning(this.run)
      this.phase = 'planning'
    }

    await this.persist()

    const welcome: ServerMessage = {
      t: 'welcome',
      protocol: PROTOCOL_VERSION,
      seat,
      snapshot: this.run,
      lobby: lobbyView(this.run, this.occupants),
      phase: this.phase,
      round: this.run.round,
    }
    conn.send(JSON.stringify(welcome))
    this.room.broadcast(JSON.stringify({ t: 'lobby', lobby: lobbyView(this.run, this.occupants) } satisfies ServerMessage))
  }

  onClose(conn: Party.Connection): void {
    // Tracer scope only: free the seat. Full revert semantics (restoring the
    // bot persona) are Plan 03-03's job.
    const seat = this.occupants.findIndex(o => o === conn.id)
    if (seat !== -1) this.occupants[seat] = null
  }

  async onMessage(raw: string, sender: Party.Connection): Promise<void> {
    if (raw.length > MAX_MESSAGE_LENGTH) {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'too-large' } satisfies ServerMessage))
      return
    }

    const msg = parseClientMessage(raw)
    if (!msg) {
      sender.send(JSON.stringify({ t: 'rejected', reason: 'malformed' } satisfies ServerMessage))
      return
    }

    const seat = this.occupants.findIndex(o => o === sender.id)
    if (seat === -1) {
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
    // contents, no player names (see T-03-08).
    const body = {
      ok: true,
      room: this.room.id,
      phase: this.phase,
      round: this.run.round,
      connections: Array.from(this.room.getConnections()).length,
      storageKeys,
    }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  }
}
