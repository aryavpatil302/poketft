// Pure, transport-free seat lifecycle: assignment, revert, and the bot
// roster that makes revert possible. This module must import nothing from
// `partykit/server` or any transport library — that constraint is what
// makes the entire seat lifecycle testable in vitest with no server
// running (see party/seats.test.ts). party/lobby.ts is the sole caller.

import { newRun, type RunState } from '../src/econ/runState'
import { PERSONAS, botSeats } from '../src/econ/bots'
import { pickRandomNames } from '../src/econ/botNames'
import { PLAYER_COUNT } from '../src/econ/constants'
import type { LobbySeatView } from '../src/net/protocol'

export interface SeatRosterEntry {
  personaId: string
  name: string
}

export interface SeatTable {
  occupants: (string | null)[]   // connection id per seat; null = bot-held
  roster: SeatRosterEntry[]      // the ORIGINAL bot identity per seat, captured at room creation
}

const MAX_DISPLAY_NAME_LENGTH = 24

// A room has no privileged human seat — every seat starts bot-held. With 6
// seats and 5 personas, seats 0 and 5 share a persona id; that's fine, a
// persona is a decision-weight profile, not an identity.
export function newRoomRun(): RunState {
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

// Captures the roster (each seat's ORIGINAL bot identity) by reading the
// run's current state — so a room resumed from storage rebuilds a roster
// consistent with whatever it persisted. Connection ids never survive a
// room restart, so the returned table always starts with every seat
// unoccupied; party/lobby.ts's onStart is responsible for forcing every
// seat's personaId back to its roster value once this table exists, so a
// room that restarted mid-human-session does not resume with an
// ownerless human seat.
export function newSeatTable(run: RunState): SeatTable {
  const roster: SeatRosterEntry[] = run.players.map((p, i) => {
    // Resume-after-restart path: a persisted seat can be mid-human
    // (personaId === null) if the room restarted while someone was seated.
    // There is no live connection to attribute that seat to anymore, so
    // fall back to the same persona newRoomRun() would have assigned it.
    if (p.personaId !== null) return { personaId: p.personaId, name: p.name }
    const persona = PERSONAS[i % PERSONAS.length]
    return { personaId: persona.id, name: persona.name }
  })
  return {
    occupants: Array(run.players.length).fill(null),
    roster,
  }
}

// No locking or compare-and-swap is needed here: a PartyKit room is a
// single-threaded Durable Object, so onConnect handlers never interleave
// and two connections can never observe the same seat as free at once. The
// unit test proves the sequential property (assignSeat called N times in a
// row returns N distinct seats); the runtime's single-threaded guarantee is
// what makes that sequential property sufficient for correctness.
export function assignSeat(
  run: RunState,
  table: SeatTable,
  connId: string,
  displayName: string | null,
): number | null {
  const seat = table.occupants.findIndex(o => o === null)
  if (seat === -1) return null
  // Nothing else on the seat changes — a seat a bot has been playing keeps
  // its board, gold, and level, and the arriving human inherits it. That is
  // deliberate: the shared pool is accounted against those holdings.
  table.occupants[seat] = connId
  run.players[seat].personaId = null
  run.players[seat].name = sanitizeDisplayName(displayName, seat)
  return seat
}

// Reverting a seat to bot control must never wipe or reset its economy —
// the shared unit pool is accounted against this seat's holdings (bench and
// board), and clearing them would leak copies into nowhere. shopLocked is
// the one deliberate exception: a bot never locks its shop, and
// startPlanning skips the roll for a locked seat, so a seat left locked
// would have its shop frozen for the rest of the run.
export function freeSeat(run: RunState, table: SeatTable, connId: string): number | null {
  const seat = table.occupants.findIndex(o => o === connId)
  if (seat === -1) return null
  table.occupants[seat] = null
  run.players[seat].personaId = table.roster[seat].personaId
  run.players[seat].name = table.roster[seat].name
  run.players[seat].shopLocked = false
  return seat
}

export function seatOf(table: SeatTable, connId: string): number | null {
  const seat = table.occupants.findIndex(o => o === connId)
  return seat === -1 ? null : seat
}

// Trust-boundary control, not cosmetics: this value is attacker-supplied
// (the connect URL's `name` query parameter) and is rendered directly in
// Phase 4's lobby UI.
export function sanitizeDisplayName(raw: string | null, seat: number): string {
  const fallback = `Player ${seat + 1}`
  if (raw === null) return fallback
  // Strip C0 controls (< 0x20) and DEL (0x7F), plus angle brackets.
  const stripped = raw.replace(/[\x00-\x1F\x7F<>]/g, '').trim()
  if (stripped.length === 0) return fallback
  return stripped.slice(0, MAX_DISPLAY_NAME_LENGTH)
}

export function lobbyView(run: RunState, table: SeatTable): LobbySeatView[] {
  return run.players.map((p, seat) => ({
    seat,
    name: p.name,
    hp: p.hp,
    human: table.occupants[seat] !== null,
    eliminated: p.eliminated,
  }))
}
