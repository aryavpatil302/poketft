// Shared client/server wire vocabulary for the PartyKit room (party/lobby.ts)
// and, from Phase 4, the browser client. Types here import directly from the
// engine (../game/round, ../econ/runState) so the wire vocabulary cannot
// drift from the types it is carrying.

import type { GameAction, ActionReason } from '../game/round'
import type { RunState } from '../econ/runState'

export const PLANNING_MS = 30_000
export const PROTOCOL_VERSION = 1

export type RoomPhase = 'idle' | 'planning' | 'resolving' | 'over'

export type RejectReason = ActionReason | 'not-seated' | 'wrong-phase' | 'malformed' | 'too-large' | 'rate-limited'

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

export type ServerMessage =
  | { t: 'welcome'; protocol: number; seat: number; snapshot: RunState; lobby: LobbySeatView[]; phase: RoomPhase; round: number }
  | { t: 'snapshot'; snapshot: RunState }
  | { t: 'lobby'; lobby: LobbySeatView[] }
  | { t: 'rejected'; reason: RejectReason }

// Narrow parse — never throws. Returns null for non-JSON input, a parsed
// value that is not a plain object, or any `t` other than 'action'. Does NOT
// deeply validate the GameAction payload: applyAction is already a
// validate-before-mutate function and is the sole authority on whether an
// action is legal.
export function parseClientMessage(raw: string): ClientMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const candidate = parsed as { t?: unknown; action?: unknown }
  if (candidate.t !== 'action') return null
  return { t: 'action', action: candidate.action as GameAction }
}
