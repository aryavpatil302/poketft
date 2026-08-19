// Shared client/server wire vocabulary for the PartyKit room (party/lobby.ts)
// and, from Phase 4, the browser client. Types here import directly from the
// engine (../game/round, ../econ/runState) so the wire vocabulary cannot
// drift from the types it is carrying.

import type { GameAction, ActionReason, SeatFightResult } from '../game/round'
import type { RunState } from '../econ/runState'
import type { FightChunk } from './fightWire'

export const PLANNING_MS = 30_000
export const PROTOCOL_VERSION = 1

// Per-room override for PLANNING_MS, read from partykit's `--var` binding
// (Party.Room.env) — for automated verification only. scripts/roomRound.ts
// spawns `partykit dev --var PLANNING_MS=2000` so a multi-round integration
// run doesn't spend a real 30s per round; a deployed room is never given
// this flag and always sees the real PLANNING_MS default above.
//
// Deliberately reads `env.PLANNING_MS`, NOT `process.env.PLANNING_MS`: the
// plan that specified this override assumed the latter, but verified
// empirically (spawning `partykit dev` with PLANNING_MS set in the host
// process's environment) that the workerd sandbox's `process` is a
// polyfill object whose `.env` never reflects the host environment or the
// `--var` value — only the per-room `env` binding partykit actually injects
// does. Using process.env here would silently always fall back to the 30s
// default, defeating the whole point of this override.
export function planningMsFor(env: Record<string, unknown> | undefined): number {
  const raw = env?.PLANNING_MS
  const n = Number(raw)
  return raw !== undefined && Number.isFinite(n) && n > 0 ? n : PLANNING_MS
}

// A human clicking rerolls as fast as physically possible cannot approach
// this within one planning phase — it bounds a message flood without ever
// gating real play. Counted per connection id, reset at connect and at the
// start of each new planning phase (see party/lobby.ts's
// resetActionBudget()).
export const MAX_ACTIONS_PER_PHASE = 600

// 'lobby' means the room exists and seats can be taken, but no round has
// started and no timer is running — only the seat-0 host can move it to
// 'planning' (see party/lobby.ts's `start` handling). Deliberately distinct
// from 'idle', which means an ALREADY-STARTED room whose clock is stopped
// because nobody is connected. The distinction is load-bearing across a room
// restart: a rehydrated mid-game room must come back 'idle' (resume on the
// next connect) and never 'lobby' (wait for a second Start that will never
// come).
export type RoomPhase = 'idle' | 'lobby' | 'planning' | 'resolving' | 'over'

export type RejectReason =
  | ActionReason
  | 'not-seated' | 'wrong-phase' | 'malformed' | 'too-large' | 'rate-limited'
  // A `start` from a seat other than 0, and a `start` for a room that has
  // already left the 'lobby' phase, respectively.
  | 'not-host' | 'already-started'

export interface LobbySeatView {
  seat: number
  name: string
  hp: number
  human: boolean
  eliminated: boolean
}

// Load-bearing security properties of ClientMessage, must survive as the
// union grows in later plans:
// (a) It carries NO seat field of any kind — a client has no syntax to name
//     a seat. Seat authority comes only from the room-assigned connection
//     identity (see party/lobby.ts's onMessage, which resolves the acting
//     seat by scanning its own occupants table for the sender's connection
//     id, never from anything in this payload).
// (b) It carries NO state field of any kind — a client has no syntax to push
//     a RunState (or fragment of one). The room's RunState originates only
//     from its own newRoomRun() or its own storage.
export type ClientMessage =
  | { t: 'action'; action: GameAction }
  // Host-only request to leave the 'lobby' phase and open the first planning
  // round. Note it upholds both properties above: no seat field (the room
  // resolves the sender's seat from its own occupants table and rejects
  // 'not-host' for anything but seat 0) and no state field.
  | { t: 'start' }

export type ServerMessage =
  | { t: 'welcome'; protocol: number; seat: number; snapshot: RunState; lobby: LobbySeatView[]; phase: RoomPhase; round: number }
  | { t: 'snapshot'; snapshot: RunState }
  | { t: 'lobby'; lobby: LobbySeatView[] }
  | { t: 'rejected'; reason: RejectReason }
  | { t: 'seat-taken'; seat: number; name: string }
  | { t: 'seat-freed'; seat: number; name: string }
  // `deadline` is an absolute epoch-milliseconds timestamp, paired with
  // `serverNow` (Date.now() at send time) rather than a bare
  // remaining-milliseconds number — a client subtracts the two to correct
  // for its own clock skew instead of trusting its local wall clock, and can
  // recompute the remaining time at any point after receipt without drift.
  | { t: 'phase'; phase: RoomPhase; round: number; deadline: number | null; serverNow: number }
  // `seat` is this connection's own SeatFightResult only (or null for a
  // connection holding no seat) — never any other seat's. `fightId` is null
  // exactly when this seat has no recorded fight (a bye, an abstractly-
  // resolved bot-vs-bot pairing, or an item round). A client must correlate
  // incoming `fight-chunk` messages to this resolve by `fightId`, never by
  // arrival adjacency — broadcast ordering across distinct connections is
  // unspecified (only per-connection order is FIFO).
  | { t: 'resolve'; round: number; kind: 'pvp' | 'creep' | 'item'; snapshot: RunState; seat: SeatFightResult | null; fightId: string | null; eliminated: number[]; survivors: number[] }
  | { t: 'fight-chunk'; chunk: FightChunk }

// Narrow parse — never throws. Returns null for non-JSON input, a parsed
// value that is not a plain object, or any `t` outside the ClientMessage
// union ('action', 'start'). Does NOT deeply validate the GameAction
// payload: applyAction is already a validate-before-mutate function and is
// the sole authority on whether an action is legal.
export function parseClientMessage(raw: string): ClientMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const candidate = parsed as { t?: unknown; action?: unknown }
  if (candidate.t === 'start') return { t: 'start' }
  if (candidate.t !== 'action') return null
  return { t: 'action', action: candidate.action as GameAction }
}

// Every `t` the server is allowed to send. A frame carrying anything else is
// from a future protocol version, a proxy, or an attacker, and is dropped.
const SERVER_MESSAGE_TYPES = new Set<string>([
  'welcome', 'snapshot', 'lobby', 'rejected', 'seat-taken', 'seat-freed',
  'phase', 'resolve', 'fight-chunk',
])

// The client-side mirror of parseClientMessage — never throws. Returns null
// for non-JSON input, a parsed value that is not a plain non-array object,
// any unknown `t`, and a `welcome` whose `protocol` is not PROTOCOL_VERSION
// (a version-skewed server's payload shapes are not ours to interpret).
//
// Deliberately does NOT deep-validate payload bodies: the server is the sole
// authority on content — it owns the RunState and recorded every fight it
// sends. This parse exists only so an UNRECOGNISED frame cannot reach render
// code, which is exactly the reasoning parseClientMessage already carries on
// its own side of the wire.
export function parseServerMessage(raw: unknown): ServerMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const candidate = parsed as { t?: unknown; protocol?: unknown }
  if (typeof candidate.t !== 'string' || !SERVER_MESSAGE_TYPES.has(candidate.t)) return null
  if (candidate.t === 'welcome' && candidate.protocol !== PROTOCOL_VERSION) return null
  return parsed as ServerMessage
}
