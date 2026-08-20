// Drives the BROWSER's own RoomClient module against a real `partykit dev`
// room from Node. The distinguishing property versus scripts/roomSmoke.ts and
// friends: those drive raw PartySocket, this imports src/net/roomClient and
// exercises the exact code src/main.ts runs. This repo has no browser
// automation, so this script is the only automated coverage the browser
// networking path has — which is precisely why roomClient.ts is forbidden
// from touching any DOM global.
//
// Run as: `npm run net:client`

import { withRoom, ROOM_PORT } from './roomHarness'
import { RoomClient, type RoomClientStatus } from '../src/net/roomClient'
import { PROTOCOL_VERSION, type RejectReason, type ServerMessage } from '../src/net/protocol'
// The REAL countdown module the browser runs, not a re-implementation of its
// arithmetic: scenario 13 below feeds it two clients' actual `phase` frames so
// the clock-skew property is asserted against a live server rather than only
// in roomClock.test.ts's unit tests.
import { captureDeadline, remainingMs } from '../src/net/roomClock'
// Scenario 14 drives the REAL reassembly, decode, orientation and playback
// modules src/main.ts imports — not a reimplementation of their arithmetic.
// A private copy here would prove only that this script agrees with itself.
import { createFightBuffer, acceptChunk, takeFight, type FightBuffer } from '../src/net/fightBuffer'
import { decodeFightLog, type FightChunk } from '../src/net/fightWire'
import { mirrorFightLogForSeat } from '../src/game/playbackPerspective'
import { createPlaybackState, applyFrame, playbackLength, playbackWinner } from '../src/game/playback'
import { REROLL_COST, PLAYER_COUNT } from '../src/econ/constants'
import { UNIT_MAP } from '../src/data/units'
import type { RunState } from '../src/econ/runState'

// Shortens the room's planning window so a multi-round run doesn't spend a
// real 30s per round (partykit --var, surfaced on Party.Room.env — see
// src/net/protocol.ts's planningMsFor comment for why NOT process.env).
const PLANNING_MS_TEST = 2000
// Scenarios 10-11 need the OPPOSITE trade-off: their assertions (a burst plus
// a quiescence wait, then a spend-down to broke) all have to land inside ONE
// planning phase, and a 2s window would settle the round out from under them
// and turn a real assertion into a flaky 'wrong-phase'. PLANNING_MS is a
// per-PROCESS `--var`, so those two get their own server process.
const PLANNING_MS_ACTIONS = 20000
const OUTER_TIMEOUT_MS = 8 * 60_000

let scenariosRun = 0

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
  console.log(`OK: ${message}`)
}

// Every assertion in a scenario carries that scenario's label, so a failure in
// a 60-line run says which of them broke without counting OK: lines by hand.
function scenario(label: string): (condition: boolean, message: string) => void {
  return (condition, message) => assert(condition, `[${label}] ${message}`)
}

function scenarioPassed(label: string): void {
  scenariosRun++
  console.log(`PASS: ${label}`)
}

interface RoomStatus {
  phase: string
  round: number
  timerScheduled: boolean
  connections: number
  storageKeys: string[]
}

async function roomStatus(host: string, roomId: string): Promise<RoomStatus> {
  const res = await fetch(`http://${host}/parties/main/${roomId}`)
  return await res.json() as RoomStatus
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Client probe ─────────────────────────────────────────────────────────────

// Wraps a RoomClient's fan-out callbacks in the await-the-next-matching-frame
// shape the room*.ts scripts already use, so a waiter can always be registered
// BEFORE the send that triggers its reply — the ordering roomRound.ts had to
// learn the hard way for cross-connection broadcasts.
interface Waiter {
  predicate: (m: ServerMessage) => boolean
  resolve: (m: ServerMessage) => void
  timer: ReturnType<typeof setTimeout>
}

interface StatusEvent {
  status: RoomClientStatus
  reason?: RejectReason
}

function probeClient(client: RoomClient) {
  const seen: ServerMessage[] = []
  const waiters = new Set<Waiter>()
  const statuses: StatusEvent[] = []
  const statusListeners = new Set<(e: StatusEvent) => void>()

  client.onMessage(m => {
    seen.push(m)
    for (const waiter of Array.from(waiters)) {
      if (!waiter.predicate(m)) continue
      clearTimeout(waiter.timer)
      waiters.delete(waiter)
      waiter.resolve(m)
    }
  })

  client.onStatus((status, reason) => {
    const event: StatusEvent = { status, reason }
    statuses.push(event)
    for (const listener of Array.from(statusListeners)) listener(event)
  })

  return {
    // Resolves on a matching status transition, replaying any already seen —
    // a rejection can land before the caller gets a chance to await it.
    nextStatus(predicate: (e: StatusEvent) => boolean, timeoutMs = 10_000): Promise<StatusEvent> {
      const already = statuses.find(predicate)
      if (already) return Promise.resolve(already)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          statusListeners.delete(listener)
          reject(new Error(`netClient: timed out after ${timeoutMs}ms waiting on a status transition. Seen: ${statuses.map(e => e.status).join(', ')}`))
        }, timeoutMs)
        const listener = (event: StatusEvent): void => {
          if (!predicate(event)) return
          clearTimeout(timer)
          statusListeners.delete(listener)
          resolve(event)
        }
        statusListeners.add(listener)
      })
    },

    // The number of times a registered message handler has actually fired —
    // scenario 4 asserts this does NOT move when garbage is fed in.
    get handled(): number { return seen.length },

    next(predicate: (m: ServerMessage) => boolean, timeoutMs = 10_000): Promise<any> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(waiter)
          reject(new Error(`netClient: timed out after ${timeoutMs}ms. Frames seen: ${seen.map(m => m.t).join(', ')}`))
        }, timeoutMs)
        const waiter: Waiter = { predicate, resolve, timer }
        waiters.add(waiter)
      })
    },
  }
}

// ─── Restart plumbing ─────────────────────────────────────────────────────────

// Waits until the previous `partykit dev` process has actually released the
// port. Without this the second withRoom's healthcheck can answer from the
// DYING server, and the "restart" would never have happened.
async function waitForRoomDown(port: number): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/parties/main/healthcheck`)
    } catch {
      return
    }
    await sleep(200)
  }
  throw new Error(`netClient: the previous partykit dev process never released port ${port}`)
}

// ─── Scenarios 1-4, against the first room process ────────────────────────────

// Returns the round observed just before the process is torn down, which
// scenario 5 asserts the restarted room resumes from rather than regressing.
async function beforeRestart(host: string, roomId: string): Promise<number> {
  // ─── 1. Seat and welcome ────────────────────────────────────────────────
  const s1 = scenario('seat and welcome')
  const clientA = new RoomClient({ host, room: roomId, name: 'Host' })
  const probeA = probeClient(clientA)
  const welcomeWaitA = probeA.next(m => m.t === 'welcome')
  clientA.connect()
  const welcomeA = await welcomeWaitA

  s1(welcomeA.protocol === PROTOCOL_VERSION, `welcome carries PROTOCOL_VERSION (${PROTOCOL_VERSION})`)
  s1(welcomeA.seat === 0, 'the first client is given seat 0')
  s1(clientA.seat === 0, 'RoomClient.seat reflects the server-assigned seat')
  s1(clientA.status === 'open', "RoomClient.status is 'open' after the socket opens")
  scenarioPassed('seat and welcome')

  // ─── 2. Host-gated start ────────────────────────────────────────────────
  const s2 = scenario('host-gated start')
  const beforeStart = await roomStatus(host, roomId)
  s2(beforeStart.phase === 'lobby', `an unstarted room sits in phase 'lobby' (got '${beforeStart.phase}')`)
  s2(beforeStart.timerScheduled === false, 'no planning timer is scheduled before the host starts')

  const clientB = new RoomClient({ host, room: roomId, name: 'Friend' })
  const probeB = probeClient(clientB)
  const welcomeWaitB = probeB.next(m => m.t === 'welcome')
  clientB.connect()
  const welcomeB = await welcomeWaitB
  s2(welcomeB.seat === 1, 'the second client is given seat 1')

  // T-04-03: the seat is resolved from the connection identity, so a non-host
  // cannot open the round no matter what it sends.
  const notHostWait = probeB.next(m => m.t === 'rejected')
  clientB.sendStart()
  const notHost = await notHostWait
  s2(notHost.reason === 'not-host', `a start from seat 1 is rejected 'not-host' (got '${notHost.reason}')`)

  const afterNotHost = await roomStatus(host, roomId)
  s2(afterNotHost.phase === 'lobby', `the room is still in 'lobby' after the rejected start (got '${afterNotHost.phase}')`)

  // Registered before the send: beginPlanning broadcasts phase and snapshot
  // back to back to every connection.
  const planningA = probeA.next(m => m.t === 'phase' && m.phase === 'planning')
  const planningB = probeB.next(m => m.t === 'phase' && m.phase === 'planning')
  const openingA = probeA.next(m => m.t === 'snapshot')
  clientA.sendStart()
  const [phaseA, phaseB, opening] = await Promise.all([planningA, planningB, openingA])
  s2(phaseA.phase === 'planning', "the host's start moves the room to 'planning' for seat 0")
  s2(phaseB.phase === 'planning', "the host's start moves the room to 'planning' for seat 1 too")
  scenarioPassed('host-gated start')

  // ─── 3. Action round-trip ───────────────────────────────────────────────
  const s3 = scenario('action round-trip')
  // The planning window is deliberately short here, so a reroll can legitimately
  // land after the deadline and come back 'wrong-phase'. That is the room
  // behaving correctly, not a failure — retry against the next planning phase's
  // own opening snapshot rather than asserting on a stale gold baseline.
  let goldBefore: number = opening.snapshot.players[0].gold
  let observedGoldAfter: number | null = null

  for (let attempt = 0; attempt < 4 && observedGoldAfter === null; attempt++) {
    const replyWait = probeA.next(m => m.t === 'snapshot' || m.t === 'rejected', 15_000)
    clientA.sendAction({ t: 'reroll' })
    const reply = await replyWait

    if (reply.t === 'snapshot' && reply.snapshot.players[0].gold === goldBefore - REROLL_COST) {
      observedGoldAfter = reply.snapshot.players[0].gold
      break
    }

    const nextOpening = probeA.next(m => m.t === 'snapshot', 20_000)
    await probeA.next(m => m.t === 'phase' && m.phase === 'planning', 20_000)
    goldBefore = (await nextOpening).snapshot.players[0].gold
  }

  s3(
    observedGoldAfter === goldBefore - REROLL_COST,
    `a reroll sent through RoomClient.sendAction reduces seat 0 gold by exactly REROLL_COST (${goldBefore} -> ${observedGoldAfter})`,
  )
  scenarioPassed('action round-trip')

  // ─── 4. Unrecognised frames are dropped ─────────────────────────────────
  const s4 = scenario('unrecognised frames are dropped')
  const droppedBefore = clientA.droppedFrames
  const handledBefore = probeA.handled

  const garbage: string[] = [
    'not json',
    '[]',
    '{"t":"nope"}',
    // A welcome from a server speaking a protocol version this client does not
    // know: structurally valid, semantically unreadable, so it must not land.
    JSON.stringify({ ...welcomeA, protocol: PROTOCOL_VERSION + 1 }),
  ]

  let threw = false
  for (const raw of garbage) {
    try {
      // Fed through receiveRaw, which is the SAME function the socket's own
      // message listener calls — not a reimplementation that could drift.
      clientA.receiveRaw(raw)
    } catch {
      threw = true
    }
  }

  s4(!threw, 'no garbage frame throws out of the client')
  s4(
    clientA.droppedFrames === droppedBefore + garbage.length,
    `droppedFrames increased by exactly ${garbage.length} (${droppedBefore} -> ${clientA.droppedFrames})`,
  )
  s4(
    probeA.handled === handledBefore,
    `no registered message handler fired for any garbage frame (handled stayed at ${handledBefore})`,
  )
  scenarioPassed('unrecognised frames are dropped')

  // Let at least one round settle, so the restart below is genuinely mid-game
  // rather than mid-first-planning-phase.
  await probeA.next(m => m.t === 'resolve', 30_000)
  const settled = await roomStatus(host, roomId)

  clientA.close()
  clientB.close()
  await sleep(300)
  return settled.round
}

// ─── Scenario 5, against a freshly restarted room process ─────────────────────

async function afterRestart(host: string, roomId: string, roundBefore: number): Promise<void> {
  const s5 = scenario('a started room survives a restart')

  // Read the status endpoint FIRST: the HTTP request itself is what
  // rehydrates the Durable Object and runs onStart, and connecting a client
  // would immediately flip the phase to 'planning' and hide what onStart
  // actually chose.
  const observedPhases: string[] = []
  for (let i = 0; i < 3; i++) {
    observedPhases.push((await roomStatus(host, roomId)).phase)
    await sleep(150)
  }
  s5(
    !observedPhases.includes('lobby'),
    `phase is never observed as 'lobby' after a mid-round restart (saw ${observedPhases.join(', ')})`,
  )
  s5(
    observedPhases[0] === 'idle',
    `a rehydrated started room comes back 'idle', not 'lobby' (got '${observedPhases[0]}')`,
  )

  const client = new RoomClient({ host, room: roomId, name: 'Rejoiner' })
  const probe = probeClient(client)
  const planningWait = probe.next(m => m.t === 'phase' && m.phase === 'planning', 20_000)
  client.connect()
  // Note what is NOT here: no sendStart(). The round loop must reopen on its
  // own, because the room persisted that it had already been started.
  const resumed = await planningWait

  s5(resumed.phase === 'planning', "'planning' resumes with no client having sent start")
  s5(
    resumed.round >= roundBefore,
    `the run resumed rather than restarting (round was ${roundBefore}, now ${resumed.round})`,
  )

  const alreadyStartedWait = probe.next(m => m.t === 'rejected', 10_000)
  client.sendStart()
  const alreadyStarted = await alreadyStartedWait
  s5(
    alreadyStarted.reason === 'already-started',
    `a second start after the game began is rejected 'already-started' (got '${alreadyStarted.reason}')`,
  )
  scenarioPassed('a started room survives a restart')

  // ─── 6. Drop ────────────────────────────────────────────────────────────
  const s6 = scenario('drop')
  const closedWait = probe.nextStatus(e => e.status === 'closed')
  client.close()
  const closed = await closedWait
  s6(closed.status === 'closed', "the status callback fires 'closed' when the socket goes away")
  s6(client.status === 'closed', "RoomClient.status reports 'closed' after the drop")

  // Take the baseline only once the room is provably quiesced (nobody
  // connected, no timer scheduled). Reading it while a 2s deadline is still
  // armed would let a legitimate round transition masquerade as a
  // server-side effect of the send below.
  const quiesceDeadline = Date.now() + 10_000
  let quiesced: RoomStatus | null = null
  while (Date.now() < quiesceDeadline) {
    const status = await roomStatus(host, roomId)
    if (status.connections === 0 && status.timerScheduled === false) { quiesced = status; break }
    await sleep(150)
  }
  s6(quiesced !== null, 'the room stops its timer once the dropped client is gone')
  const roundAtDrop = quiesced!.round

  let sendThrew = false
  try {
    // Must be inert, not buffered: a queued intent replayed into a socket that
    // reopens minutes later would spend gold against a round long since
    // settled (T-04-05).
    client.sendAction({ t: 'reroll' })
  } catch {
    sendThrew = true
  }
  s6(!sendThrew, 'sendAction after a drop does not throw')

  await sleep(600)
  const afterDrop = await roomStatus(host, roomId)
  s6(
    afterDrop.round === roundAtDrop,
    `sendAction after a drop had no server-side effect (round stayed at ${roundAtDrop})`,
  )
  scenarioPassed('drop')

  // ─── 7. Full lobby ──────────────────────────────────────────────────────
  const s7 = scenario('full lobby')
  const occupants: RoomClient[] = []
  for (let seat = 0; seat < PLAYER_COUNT; seat++) {
    const filler = new RoomClient({ host, room: roomId, name: `Filler${seat}` })
    const fillerProbe = probeClient(filler)
    const welcomeWait = fillerProbe.next(m => m.t === 'welcome', 15_000)
    filler.connect()
    await welcomeWait
    occupants.push(filler)
  }
  s7(occupants.length === PLAYER_COUNT, `all ${PLAYER_COUNT} seats are occupied (PLAYER_COUNT, not a hardcoded count)`)

  const overflow = new RoomClient({ host, room: roomId, name: 'Overflow' })
  const overflowProbe = probeClient(overflow)
  const refusedWait = overflowProbe.nextStatus(e => e.status === 'rejected', 15_000)
  overflow.connect()
  const refused = await refusedWait
  s7(refused.status === 'rejected', 'a connection to a full lobby is reported rejected rather than hanging')
  s7(
    refused.reason === 'not-seated',
    `the rejection carries reason 'not-seated' (got '${refused.reason}')`,
  )
  s7(overflow.status === 'rejected', "RoomClient.status is 'rejected', never flattened to 'closed'")
  scenarioPassed('full lobby')

  overflow.close()
  for (const filler of occupants) filler.close()
  await sleep(200)
}

// ─── Scenarios 8-9: what the Lobby Screen renders and dismisses on ────────────

// Runs against a FRESH room id that has never been started, so the room is
// genuinely in phase 'lobby' — scenarios 1-7 leave their room mid-game, and
// a started room would never produce the pre-Start behaviour these two are
// about. Reuses the caller's already-running server process; only the room
// (a Durable Object keyed by id) is new.
//
// These two exist because this repo has no browser automation. Everything the
// Lobby Screen renders is a pure function of the `lobby` broadcasts asserted
// here, and everything it dismisses on is the `phase` broadcast asserted
// here — so proving the wire behaviour is as close to proving the screen as
// this project can get automatically.
async function lobbyScreenFlow(host: string, roomId: string): Promise<void> {
  // ─── 8. Seat list liveness ──────────────────────────────────────────────
  const s8 = scenario('seat list liveness')

  const humansIn = (lobby: Array<{ seat: number; human: boolean }>): number[] =>
    lobby.filter(s => s.human).map(s => s.seat)

  const clientA = new RoomClient({ host, room: roomId, name: 'Amber' })
  const probeA = probeClient(clientA)
  const welcomeWaitA = probeA.next(m => m.t === 'welcome', 15_000)
  clientA.connect()
  const welcomeA = await welcomeWaitA

  s8(welcomeA.phase === 'lobby', `a room nobody has started reports phase 'lobby' (got '${welcomeA.phase}')`)
  s8(
    JSON.stringify(humansIn(welcomeA.lobby)) === JSON.stringify([0]),
    `the first client's welcome.lobby reports exactly one human seat, at seat 0 (got ${JSON.stringify(humansIn(welcomeA.lobby))})`,
  )

  // Registered BEFORE B connects: the room broadcasts the fresh view to
  // everyone the moment the seat is taken, and a waiter registered afterwards
  // could miss it. Predicated on the human COUNT rather than bare `t`,
  // because A also receives its own connect-time lobby broadcast.
  const twoHumansWait = probeA.next(m => m.t === 'lobby' && humansIn(m.lobby).length === 2, 15_000)
  const clientB = new RoomClient({ host, room: roomId, name: 'Teal' })
  const probeB = probeClient(clientB)
  const welcomeWaitB = probeB.next(m => m.t === 'welcome', 15_000)
  clientB.connect()
  const welcomeB = await welcomeWaitB
  const grown = await twoHumansWait

  s8(welcomeB.seat === 1, `the joining client is given seat 1 (got ${welcomeB.seat})`)
  s8(
    JSON.stringify(humansIn(grown.lobby)) === JSON.stringify([0, 1]),
    `the host receives a lobby broadcast naming exactly seats 0 and 1 in ascending order (got ${JSON.stringify(humansIn(grown.lobby))})`,
  )

  const oneHumanWait = probeA.next(m => m.t === 'lobby' && humansIn(m.lobby).length === 1, 15_000)
  clientB.close()
  const shrunk = await oneHumanWait
  s8(
    JSON.stringify(humansIn(shrunk.lobby)) === JSON.stringify([0]),
    `a disconnect drops the seat back out of the list with no client-side polling (got ${JSON.stringify(humansIn(shrunk.lobby))})`,
  )
  // NOTE: scenarioPassed('seat list liveness') is deliberately NOT called here.
  // Scenario 8 has one more property to prove — that the hp the seat list
  // renders is the room's shared authoritative number — and hp is only
  // interesting once a round has actually settled, which needs the running
  // round loop that only scenario 9's Start opens. The PASS line is therefore
  // held back to the end of this function so it reports the whole property.

  // ─── 9. Host-gated dismissal ────────────────────────────────────────────
  const s9 = scenario('host-gated dismissal')

  // A second client rejoins so the dismissal can be observed on BOTH sides.
  const clientC = new RoomClient({ host, room: roomId, name: 'Coral' })
  const probeC = probeClient(clientC)
  const welcomeWaitC = probeC.next(m => m.t === 'welcome', 15_000)
  clientC.connect()
  await welcomeWaitC

  // Both waiters registered before the send, for the same cross-connection
  // ordering reason as above.
  const planningA = probeA.next(m => m.t === 'phase' && m.phase === 'planning', 15_000)
  const planningC = probeC.next(m => m.t === 'phase' && m.phase === 'planning', 15_000)
  clientA.sendStart()
  const [phaseA, phaseC] = await Promise.all([planningA, planningC])

  s9(phaseA.phase === 'planning', "the host's Start reaches the HOST as a phase 'planning' broadcast")
  s9(phaseC.phase === 'planning', "the host's Start reaches the GUEST as a phase 'planning' broadcast too")
  s9(
    phaseA.round === phaseC.round,
    `both clients dismiss on the SAME round (host ${phaseA.round}, guest ${phaseC.round})`,
  )
  scenarioPassed('host-gated dismissal')

  // ─── 8 (concluded). The seat list's HP is the room's, not a local tally ──
  // The in-game seat list (src/main.ts's renderLobby) renders `hp` straight
  // out of these views. If two clients could disagree about a seat's hp, the
  // list would be showing a locally-derived number dressed up as shared
  // state — so both sides are compared against ONE post-resolve view each.
  const resolveA = probeA.next(m => m.t === 'resolve', 20_000)
  const resolveC = probeC.next(m => m.t === 'resolve', 20_000)
  await Promise.all([resolveA, resolveC])

  // A `lobby` view is broadcast on connect and close ONLY, so a third client
  // joining is what makes the post-resolve view observable on both sides.
  // Both waiters are registered before the connect, the same cross-connection
  // ordering rule the rest of this file follows.
  const lobbyAfterA = probeA.next(m => m.t === 'lobby', 15_000)
  const lobbyAfterC = probeC.next(m => m.t === 'lobby', 15_000)
  const clientD = new RoomClient({ host, room: roomId, name: 'Dusk' })
  const probeD = probeClient(clientD)
  const welcomeWaitD = probeD.next(m => m.t === 'welcome', 15_000)
  clientD.connect()
  await welcomeWaitD
  const [viewA, viewC] = await Promise.all([lobbyAfterA, lobbyAfterC])

  const hpOf = (lobby: Array<{ seat: number; hp: number }>): number[] =>
    lobby.slice().sort((x, y) => x.seat - y.seat).map(s => s.hp)

  s8(
    viewA.lobby.length === PLAYER_COUNT,
    `a lobby view covers every seat in the room (${viewA.lobby.length} of ${PLAYER_COUNT})`,
  )
  s8(
    JSON.stringify(hpOf(viewA.lobby)) === JSON.stringify(hpOf(viewC.lobby)),
    `after a resolve both clients' lobby views report identical per-seat hp (${JSON.stringify(hpOf(viewA.lobby))})`,
  )
  scenarioPassed('seat list liveness')

  clientA.close()
  clientC.close()
  clientD.close()
  await sleep(200)
}

// ─── Scenario 13: two clients, one deadline ───────────────────────────────────

// NET-05's clock property, asserted against a real room: two tabs must show
// the SAME remaining seconds at the same wall-clock moment even when their
// system clocks disagree.
//
// The room sends an absolute `deadline` paired with its own `serverNow`
// precisely so a client can subtract the two into a DURATION and track that
// against its own monotonic clock — src/net/roomClock.ts is the single place
// that subtraction happens, and this scenario drives THAT module rather than
// restating its arithmetic, so a regression in it fails here too.
async function deadlineAgreement(host: string, roomId: string): Promise<void> {
  const s13 = scenario('deadline agreement')

  const clientA = new RoomClient({ host, room: roomId, name: 'ClockA' })
  const probeA = probeClient(clientA)
  const welcomeWaitA = probeA.next(m => m.t === 'welcome', 15_000)
  clientA.connect()
  const welcomeA = await welcomeWaitA
  s13(welcomeA.phase === 'lobby', `the clock room has never been started (phase '${welcomeA.phase}')`)

  const clientB = new RoomClient({ host, room: roomId, name: 'ClockB' })
  const probeB = probeClient(clientB)
  const welcomeWaitB = probeB.next(m => m.t === 'welcome', 15_000)
  clientB.connect()
  await welcomeWaitB

  // Registered before the Start, for the usual cross-connection reason.
  const planningA = probeA.next(m => m.t === 'phase' && m.phase === 'planning', 15_000)
  const planningB = probeB.next(m => m.t === 'phase' && m.phase === 'planning', 15_000)
  clientA.sendStart()
  const [phaseA, phaseB] = await Promise.all([planningA, planningB])

  s13(
    phaseA.round === phaseB.round,
    `both clients open the SAME round (${phaseA.round} and ${phaseB.round})`,
  )
  s13(
    phaseA.deadline !== null && phaseA.deadline === phaseB.deadline,
    `both clients receive one identical absolute deadline (${phaseA.deadline} and ${phaseB.deadline})`,
  )
  // beginPlanning builds ONE JSON string and broadcasts it, so this is exact
  // rather than merely close — asserted with a tolerance anyway, because the
  // property NET-05 needs is "close enough to agree on a second", and pinning
  // it to byte-identity would make this fail the day the room sends the two
  // frames separately for an unrelated reason.
  const SERVER_NOW_TOLERANCE_MS = 250
  s13(
    Math.abs(phaseA.serverNow - phaseB.serverNow) <= SERVER_NOW_TOLERANCE_MS,
    `both clients' serverNow agree within ${SERVER_NOW_TOLERANCE_MS}ms (${Math.abs(phaseA.serverNow - phaseB.serverNow)}ms apart)`,
  )

  // DELIBERATELY different monotonic origins: performance.now() has a
  // different epoch in every process (and every browser tab), which is the
  // whole reason roomClock stores a duration plus a local reference instead of
  // the server's absolute timestamp. If either client compared `deadline`
  // against its own wall clock, these two would diverge by the origin gap.
  const ORIGIN_A = 0
  const ORIGIN_B = 1_000_000
  const clockA = captureDeadline(phaseA, ORIGIN_A)
  const clockB = captureDeadline(phaseB, ORIGIN_B)
  s13(
    clockA !== null && clockB !== null,
    'captureDeadline accepts both clients\' planning frames',
  )

  // Read at the same simulated instant on each client's own monotonic scale.
  const ELAPSED_MS = 500
  const leftA = remainingMs(clockA, ORIGIN_A + ELAPSED_MS)
  const leftB = remainingMs(clockB, ORIGIN_B + ELAPSED_MS)
  const AGREEMENT_TOLERANCE_MS = 100
  s13(
    leftA > 0 && leftB > 0,
    `both clocks still have time on them ${ELAPSED_MS}ms in (${Math.round(leftA)}ms and ${Math.round(leftB)}ms)`,
  )
  s13(
    Math.abs(leftA - leftB) <= AGREEMENT_TOLERANCE_MS,
    `two monotonic origins ${ORIGIN_B - ORIGIN_A}ms apart still agree on the remaining time within ${AGREEMENT_TOLERANCE_MS}ms (${Math.round(Math.abs(leftA - leftB))}ms apart)`,
  )
  scenarioPassed('deadline agreement')

  clientA.close()
  clientB.close()
  await sleep(200)
}

// ─── Scenarios 10-11: serial application and visible rejection ────────────────

// The two properties plan 04-03's `dispatchAction` is built on, proven against
// a real room rather than argued for:
//   - the client NEVER optimistically applies what it sent, so a burst of
//     clicks has to come back as a burst of server snapshots that each applied
//     exactly once — no lost update, no double-apply;
//   - a refusal arrives as a `rejected` frame carrying a REASON, which is the
//     only thing reportActionRejected has to render. Without this scenario
//     that UI would be rendering a frame nobody had ever observed.
//
// Runs against a FRESH room id (never started) on its own long-window server
// process — see PLANNING_MS_ACTIONS.
async function actionSemantics(host: string, roomId: string): Promise<void> {
  // ─── 10. Rapid-fire actions apply serially, with no lost update ─────────
  const s10 = scenario('rapid-fire actions apply serially')

  const client = new RoomClient({ host, room: roomId, name: 'Burst' })
  const probe = probeClient(client)
  const welcomeWait = probe.next(m => m.t === 'welcome', 15_000)
  client.connect()
  const welcome = await welcomeWait
  s10(welcome.phase === 'lobby', `the burst room has never been started (phase '${welcome.phase}')`)

  // Registered before the send: beginPlanning broadcasts phase and the opening
  // snapshot back to back.
  const planningWait = probe.next(m => m.t === 'phase' && m.phase === 'planning', 15_000)
  const openingWait = probe.next(m => m.t === 'snapshot', 15_000)
  client.sendStart()
  await planningWait
  const opening = await openingWait

  // Every snapshot from here on, counted and kept — the burst's OWN evidence.
  // A second onMessage handler alongside the probe's, deliberately: what this
  // scenario needs is a running count and a last-changed timestamp, not a
  // one-shot waiter.
  let snapshotsObserved = 0
  let latest: RunState = opening.snapshot
  let lastSnapshotAt = Date.now()
  client.onMessage(m => {
    if (m.t !== 'snapshot') return
    snapshotsObserved++
    latest = m.snapshot
    lastSnapshotAt = Date.now()
  })

  const BURST = 5
  const goldBefore: number = opening.snapshot.players[0].gold
  // Computed, never assumed: the room's opening stake is not this script's to
  // own, and a burst longer than the seat can afford is the interesting case
  // (the tail comes back 'no-gold' and must leave gold untouched). Rerolls are
  // applied in sequence, so exactly floor(gold / REROLL_COST) of them land.
  const affordable = Math.min(BURST, Math.floor(goldBefore / REROLL_COST))
  const expectedGold = goldBefore - affordable * REROLL_COST

  // Fired back to back with no await between them — the whole point.
  for (let i = 0; i < BURST; i++) client.sendAction({ t: 'reroll' })

  // Wait, don't guess: hold until the client's latest snapshot has stopped
  // changing for QUIESCE_MS. Sleeping a fixed duration would make the
  // assertion below a race against the room rather than a statement about it.
  const QUIESCE_MS = 500
  const burstDeadline = Date.now() + 15_000
  while (Date.now() < burstDeadline && Date.now() - lastSnapshotAt < QUIESCE_MS) await sleep(50)

  console.log(`    (burst: ${BURST} rerolls sent, ${snapshotsObserved} intermediate snapshot(s) observed before quiescence)`)
  s10(
    snapshotsObserved === affordable,
    `exactly ${affordable} of the ${BURST} rapid rerolls produced a snapshot — none applied twice, none silently dropped (observed ${snapshotsObserved})`,
  )
  s10(
    latest.players[0].gold === expectedGold,
    `gold moved by exactly ${affordable} * REROLL_COST: ${goldBefore} -> ${latest.players[0].gold} (expected ${expectedGold})`,
  )
  scenarioPassed('rapid-fire actions apply serially')

  // ─── 11. Rejections are reported, not swallowed ─────────────────────────
  const s11 = scenario('rejections are reported, not swallowed')

  // Written as a spend-down LOOP rather than assuming scenario 10 left this
  // seat broke, so a change to the room's opening stake cannot quietly turn
  // this scenario vacuous.
  let gold: number = latest.players[0].gold
  while (gold >= REROLL_COST) {
    const spendWait = probe.next(m => m.t === 'snapshot', 15_000)
    client.sendAction({ t: 'reroll' })
    gold = (await spendWait).snapshot.players[0].gold
  }
  s11(gold < REROLL_COST, `seat 0 is spent down below REROLL_COST (${gold} < ${REROLL_COST})`)

  const noGoldWait = probe.next(m => m.t === 'rejected', 15_000)
  client.sendAction({ t: 'reroll' })
  const noGold = await noGoldWait
  s11(
    noGold.reason === 'no-gold',
    `an unaffordable reroll comes back as a rejected frame carrying reason 'no-gold' (got '${noGold.reason}')`,
  )

  // Not a typo: the shop has SHOP_SLOTS entries, so 99 is out of range. The
  // room does NOT deep-validate a GameAction payload on parse (by design —
  // applyAction is the sole authority), so this asserts the authority actually
  // refuses it rather than indexing past the end and accepting.
  const badSlotWait = probe.next(m => m.t === 'rejected', 15_000)
  client.sendAction({ t: 'buy', slot: 99 })
  const badSlot = await badSlotWait
  s11(
    badSlot.reason === 'empty-slot',
    `an out-of-range shop slot is refused with reason 'empty-slot' rather than accepted (got '${badSlot.reason}')`,
  )
  scenarioPassed('rejections are reported, not swallowed')

  client.close()
  await sleep(200)
}

// ─── Scenario 12: two clients, one shared pool ────────────────────────────────

// NET-02's edge probe: two seats shopping against ONE pool at the same time.
// The room applies actions serially, but "serial" is an implementation detail
// of party/lobby.ts's onMessage — this asserts the PROPERTY that falls out of
// it (nothing duplicated, nothing lost, no seat's action reaching another
// seat's board) against a real room rather than assuming it.
//
// Runs against a FRESH room id on the long-planning-window process, because
// every assertion below has to land inside ONE planning phase: a settlement
// would re-roll shops, let five bot seats shop against the same pool, and turn
// the conservation arithmetic into a statement about botPlanRound.
async function sharedPoolConservation(host: string, roomId: string): Promise<void> {
  const s12 = scenario('two clients against one pool')

  const poolTotal = (pool: Record<string, number>): number =>
    Object.values(pool).reduce((sum, copies) => sum + copies, 0)

  // The first slot this seat can actually afford. Cost comes from UNIT_MAP
  // rather than being assumed, so a shop that rolled something expensive is
  // skipped instead of producing a 'no-gold' that would be counted as an
  // interesting rejection when it is really just this script overreaching.
  const firstAffordableSlot = (econ: { shop: Array<string | null>; gold: number }): number =>
    econ.shop.findIndex(id => id !== null && (UNIT_MAP.get(id)?.cost ?? Infinity) <= econ.gold)

  const clientA = new RoomClient({ host, room: roomId, name: 'PoolA' })
  const probeA = probeClient(clientA)
  const welcomeWaitA = probeA.next(m => m.t === 'welcome', 15_000)
  clientA.connect()
  const welcomeA = await welcomeWaitA
  s12(welcomeA.phase === 'lobby', `the pool room has never been started (phase '${welcomeA.phase}')`)

  const clientB = new RoomClient({ host, room: roomId, name: 'PoolB' })
  const probeB = probeClient(clientB)
  const welcomeWaitB = probeB.next(m => m.t === 'welcome', 15_000)
  clientB.connect()
  const welcomeB = await welcomeWaitB
  s12(welcomeA.seat === 0 && welcomeB.seat === 1, `the two clients hold seats 0 and 1 (got ${welcomeA.seat} and ${welcomeB.seat})`)

  // Running "latest snapshot" per client, for choosing the next shop slot.
  // The per-buy ASSERTIONS below never read these — they compare the two
  // clients' own copies of one specific broadcast instead.
  let latestA: RunState = welcomeA.snapshot
  let latestB: RunState = welcomeB.snapshot
  clientA.onMessage(m => { if (m.t === 'snapshot') latestA = m.snapshot })
  clientB.onMessage(m => { if (m.t === 'snapshot') latestB = m.snapshot })

  const openingWaitA = probeA.next(m => m.t === 'snapshot', 15_000)
  const openingWaitB = probeB.next(m => m.t === 'snapshot', 15_000)
  clientA.sendStart()
  const [openA, openB] = await Promise.all([openingWaitA, openingWaitB])
  latestA = openA.snapshot
  latestB = openB.snapshot
  s12(
    JSON.stringify(openA.snapshot.pool) === JSON.stringify(openB.snapshot.pool),
    'both clients open the round on an identical pool map',
  )

  const openingPoolTotal = poolTotal(openA.snapshot.pool)
  const openingRound: number = openA.snapshot.round

  // ─── Interleaved buys ───────────────────────────────────────────────────
  // Both seats' buys go out back to back with no await between them, so the
  // room really does have two intents in flight against one pool — the case
  // this scenario exists for. Each seat's own waiter is keyed on ITS OWN shop
  // slot clearing, so the two remain individually attributable despite that.
  const TARGET_BUYS = 2
  const MAX_ROUNDS = 6
  let buysA = 0
  let buysB = 0

  for (let attempt = 0; attempt < MAX_ROUNDS && (buysA < TARGET_BUYS || buysB < TARGET_BUYS); attempt++) {
    const slotA = buysA < TARGET_BUYS ? firstAffordableSlot(latestA.players[0]) : -1
    const slotB = buysB < TARGET_BUYS ? firstAffordableSlot(latestB.players[1]) : -1
    if (slotA === -1 && slotB === -1) break

    // Four waiters, all registered BEFORE either send: each seat's own view of
    // its own buy, and each seat's view of the OTHER seat's buy. A `snapshot`
    // is broadcast to every connection, so the two waiters keyed on the same
    // predicate resolve on the SAME broadcast — which is what makes comparing
    // them a statement about the wire rather than about one client's maths.
    const appliedA = (m: ServerMessage): boolean =>
      m.t === 'snapshot' && m.snapshot.players[0].shop[slotA] === null
    const appliedB = (m: ServerMessage): boolean =>
      m.t === 'snapshot' && m.snapshot.players[1].shop[slotB] === null

    const ownA = slotA === -1 ? null : probeA.next(m => m.t === 'rejected' || appliedA(m), 15_000).catch(() => null)
    const mirrorA = slotA === -1 ? null : probeB.next(appliedA, 15_000).catch(() => null)
    const ownB = slotB === -1 ? null : probeB.next(m => m.t === 'rejected' || appliedB(m), 15_000).catch(() => null)
    const mirrorB = slotB === -1 ? null : probeA.next(appliedB, 15_000).catch(() => null)

    if (slotA !== -1) clientA.sendAction({ t: 'buy', slot: slotA })
    if (slotB !== -1) clientB.sendAction({ t: 'buy', slot: slotB })

    const [seenOwnA, seenMirrorA, seenOwnB, seenMirrorB] =
      await Promise.all([ownA, mirrorA, ownB, mirrorB])

    if (seenOwnA && seenOwnA.t === 'snapshot') {
      buysA++
      s12(
        seenMirrorA !== null && seenMirrorA.t === 'snapshot' &&
          JSON.stringify(seenMirrorA.snapshot.pool) === JSON.stringify(seenOwnA.snapshot.pool),
        `after seat 0's buy #${buysA} both clients report an identical pool map`,
      )
    }
    if (seenOwnB && seenOwnB.t === 'snapshot') {
      buysB++
      s12(
        seenMirrorB !== null && seenMirrorB.t === 'snapshot' &&
          JSON.stringify(seenMirrorB.snapshot.pool) === JSON.stringify(seenOwnB.snapshot.pool),
        `after seat 1's buy #${buysB} both clients report an identical pool map`,
      )
    }
  }

  s12(buysA >= TARGET_BUYS, `seat 0 completed at least ${TARGET_BUYS} buys (got ${buysA})`)
  s12(buysB >= TARGET_BUYS, `seat 1 completed at least ${TARGET_BUYS} buys (got ${buysB})`)

  // ─── Conservation ───────────────────────────────────────────────────────
  // The expected delta is DERIVED from the buys that were actually observed to
  // apply, never a hardcoded number: a rejected buy (pool-empty when the other
  // seat won the race for the last copy) is a correct outcome, and hardcoding
  // would turn it into a failure.
  const totalBuys = buysA + buysB
  const afterBuysTotal = poolTotal(latestA.pool)
  s12(
    afterBuysTotal === openingPoolTotal - totalBuys,
    `exactly ${totalBuys} copies left the shared pool across ${totalBuys} successful buys — none duplicated, none vanished (${openingPoolTotal} -> ${afterBuysTotal})`,
  )
  s12(
    JSON.stringify(latestA.pool) === JSON.stringify(latestB.pool),
    "both clients' latest snapshots still agree on the full pool map after the interleaved burst",
  )

  // ─── Fielding: moveBench over the wire ──────────────────────────────────
  // Distinct hexes per seat, so a board entry appearing on the WRONG seat
  // would be visible as a foreign hex rather than hiding behind a coincidence.
  const HEX_A = { col: 2, row: 6 }
  const HEX_B = { col: 4, row: 5 }

  const benchIdxA = latestA.players[0].bench.findIndex(u => u !== null)
  const benchIdxB = latestB.players[1].bench.findIndex(u => u !== null)
  s12(benchIdxA !== -1 && benchIdxB !== -1, 'both seats have a bought unit on the bench to field')

  const fieldedA = (m: ServerMessage): boolean =>
    m.t === 'snapshot' &&
    m.snapshot.players[0].board.some(e => e.hexPos.col === HEX_A.col && e.hexPos.row === HEX_A.row)
  const fieldedB = (m: ServerMessage): boolean =>
    m.t === 'snapshot' &&
    m.snapshot.players[1].board.some(e => e.hexPos.col === HEX_B.col && e.hexPos.row === HEX_B.row)

  const fieldOwnA = probeA.next(m => m.t === 'rejected' || fieldedA(m), 15_000).catch(() => null)
  const fieldMirrorA = probeB.next(fieldedA, 15_000).catch(() => null)
  const fieldOwnB = probeB.next(m => m.t === 'rejected' || fieldedB(m), 15_000).catch(() => null)
  const fieldMirrorB = probeA.next(fieldedB, 15_000).catch(() => null)

  clientA.sendAction({ t: 'moveBench', benchIndex: benchIdxA, to: HEX_A })
  clientB.sendAction({ t: 'moveBench', benchIndex: benchIdxB, to: HEX_B })

  const [ownFieldA, mirrorFieldA, ownFieldB, mirrorFieldB] =
    await Promise.all([fieldOwnA, fieldMirrorA, fieldOwnB, fieldMirrorB])

  s12(
    ownFieldA !== null && ownFieldA.t === 'snapshot',
    `seat 0's moveBench was applied over the wire, not refused (${ownFieldA === null ? 'timed out' : ownFieldA.t === 'rejected' ? `rejected '${ownFieldA.reason}'` : 'snapshot'})`,
  )
  s12(
    ownFieldB !== null && ownFieldB.t === 'snapshot',
    `seat 1's moveBench was applied over the wire, not refused (${ownFieldB === null ? 'timed out' : ownFieldB.t === 'rejected' ? `rejected '${ownFieldB.reason}'` : 'snapshot'})`,
  )
  s12(
    mirrorFieldA !== null && mirrorFieldB !== null,
    "each seat's placement is broadcast to the other client too",
  )

  // ─── Isolation, and conservation across a move ──────────────────────────
  const finalA = latestA
  const finalB = latestB
  s12(
    JSON.stringify(finalA) === JSON.stringify(finalB),
    "both clients hold byte-identical RunStates once both placements have landed",
  )
  s12(
    finalA.players[0].board.length === 1 &&
      finalA.players[0].board[0].hexPos.col === HEX_A.col && finalA.players[0].board[0].hexPos.row === HEX_A.row,
    `seat 0's board holds exactly its own fielded unit, on its own hex (${JSON.stringify(finalA.players[0].board.map(e => e.hexPos))})`,
  )
  s12(
    finalA.players[1].board.length === 1 &&
      finalA.players[1].board[0].hexPos.col === HEX_B.col && finalA.players[1].board[0].hexPos.row === HEX_B.row,
    `seat 1's board holds exactly its own fielded unit, on its own hex (${JSON.stringify(finalA.players[1].board.map(e => e.hexPos))})`,
  )
  s12(
    !finalA.players[0].board.some(e => e.hexPos.col === HEX_B.col && e.hexPos.row === HEX_B.row) &&
      !finalA.players[1].board.some(e => e.hexPos.col === HEX_A.col && e.hexPos.row === HEX_A.row),
    "neither seat's placement reached the other seat's board (T-04-42)",
  )
  // A move relocates a unit; it must not mint or destroy a pool copy.
  s12(
    poolTotal(finalA.pool) === afterBuysTotal,
    `fielding changed no pool copy at all — a move relocates, it never mints or returns (${afterBuysTotal} -> ${poolTotal(finalA.pool)})`,
  )
  // Everything above is attributable to these two seats' own actions only if
  // no round settled underneath the scenario — a settlement would have let
  // five bot seats shop against the same pool.
  s12(
    finalA.round === openingRound,
    `no round settled during the scenario, so every pool change is attributable to these two seats (round stayed at ${openingRound})`,
  )
  scenarioPassed('two clients against one pool')

  clientA.close()
  clientB.close()
  await sleep(200)
}

// ─── Scenario 14: the full networked round ────────────────────────────────────

// COMBAT-02 and COMBAT-03's end-to-end probe, and the last scenario in this
// file. Two clients are driven until the room pairs them against EACH OTHER,
// then the fight the server streamed them is reassembled, decoded, oriented
// and replayed — through the REAL src/net/fightBuffer.ts and
// src/game/playbackPerspective.ts modules src/main.ts imports, never a
// reimplementation of their arithmetic. A copy here would prove only that
// this script and the browser agree with themselves.
//
// scripts/roomRound.ts already proves the same byte-identity property against
// raw PartySockets; this one proves it through the browser's own client stack
// AND adds the viewer-orientation half, which roomRound.ts predates.

// Accumulates a client's `fight-chunk` stream exactly the way src/main.ts's
// handleFightChunk does: accept, and on completion take the index-sorted set
// straight back out, so the buffer stays near-empty rather than growing a
// bucket per round.
function attachChunkSink(client: RoomClient): Map<string, FightChunk[]> {
  const buffer: FightBuffer = createFightBuffer()
  const completed = new Map<string, FightChunk[]>()
  client.onMessage(m => {
    if (m.t !== 'fight-chunk') return
    const fightId = acceptChunk(buffer, m.chunk)
    if (fightId === null) return
    const chunks = takeFight(buffer, fightId)
    if (chunks !== null) completed.set(fightId, chunks)
  })
  return completed
}

// Board hexes a seat can field onto (own half, rows 4-7). Cycled modulo
// length — a hex an earlier placement already took just swaps, which is
// harmless churn here.
const ROUND_FIELD_HEXES = [
  { col: 3, row: 6 }, { col: 4, row: 6 }, { col: 2, row: 6 },
  { col: 5, row: 6 }, { col: 3, row: 5 }, { col: 4, row: 5 },
]

// Best-effort: buy the first affordable shop slot and field it. Never throws
// on a rejection — 'no-gold', 'pool-empty' and a 2s planning window closing
// mid-round-trip are all correct outcomes of a live shared economy, not
// failures. Its only job is making the eventual PvP fight non-trivial: two
// empty boards settle instantly with no frames to play back.
async function buyAndFieldVia(
  client: RoomClient,
  probe: ReturnType<typeof probeClient>,
  seatIdx: number,
  getLatest: () => RunState,
  hexCursor: { i: number },
): Promise<void> {
  const econ = getLatest().players[seatIdx]
  const slot = econ.shop.findIndex(id => id !== null && (UNIT_MAP.get(id)?.cost ?? Infinity) <= econ.gold)
  if (slot === -1) return

  const bought = probe.next(
    m => m.t === 'rejected' || (m.t === 'snapshot' && m.snapshot.players[seatIdx].shop[slot] === null),
    5000,
  ).catch(() => null)
  client.sendAction({ t: 'buy', slot })
  const res = await bought
  if (!res || res.t !== 'snapshot') return

  const after = res.snapshot as RunState
  const benchIdx = after.players[seatIdx].bench.findIndex(u => u !== null)
  if (benchIdx === -1) return

  const hex = ROUND_FIELD_HEXES[hexCursor.i % ROUND_FIELD_HEXES.length]
  hexCursor.i++
  const fielded = probe.next(
    m => m.t === 'rejected' ||
      (m.t === 'snapshot' &&
        m.snapshot.players[seatIdx].board.some(e => e.hexPos.col === hex.col && e.hexPos.row === hex.row)),
    5000,
  ).catch(() => null)
  client.sendAction({ t: 'moveBench', benchIndex: benchIdx, to: hex })
  await fielded
}

async function fullNetworkedRound(host: string, roomId: string): Promise<void> {
  const s14 = scenario('the full networked round')

  const clientA = new RoomClient({ host, room: roomId, name: 'RoundA' })
  const probeA = probeClient(clientA)
  const chunksA = attachChunkSink(clientA)
  const welcomeWaitA = probeA.next(m => m.t === 'welcome', 15_000)
  clientA.connect()
  const welcomeA = await welcomeWaitA

  const clientB = new RoomClient({ host, room: roomId, name: 'RoundB' })
  const probeB = probeClient(clientB)
  const chunksB = attachChunkSink(clientB)
  const welcomeWaitB = probeB.next(m => m.t === 'welcome', 15_000)
  clientB.connect()
  const welcomeB = await welcomeWaitB

  s14(welcomeA.phase === 'lobby', `the round room has never been started (phase '${welcomeA.phase}')`)
  s14(welcomeA.seat === 0 && welcomeB.seat === 1, `the two clients hold seats 0 and 1 (got ${welcomeA.seat} and ${welcomeB.seat})`)

  // Latest state per client, for choosing the next shop slot. Both `snapshot`
  // and `resolve` carry one, and a resolve's is the settled state the next
  // planning phase opens from — reading only `snapshot` would leave the
  // buy/field helper one round stale.
  let latestA: RunState = welcomeA.snapshot
  let latestB: RunState = welcomeB.snapshot
  clientA.onMessage(m => { if (m.t === 'snapshot' || m.t === 'resolve') latestA = m.snapshot })
  clientB.onMessage(m => { if (m.t === 'snapshot' || m.t === 'resolve') latestB = m.snapshot })

  const openingA = probeA.next(m => m.t === 'phase' && m.phase === 'planning', 15_000)
  const openingB = probeB.next(m => m.t === 'phase' && m.phase === 'planning', 15_000)
  clientA.sendStart()
  await Promise.all([openingA, openingB])

  // ─── Drive rounds until the room pairs 0 against 1 ──────────────────────
  const MAX_ROUNDS = 20
  const hexCursorA = { i: 0 }
  const hexCursorB = { i: 0 }
  let pairAnnouncedForNextRound = latestA.players[0].nextOpponent === 1
  let targetA: any = null
  let targetB: any = null
  let rounds = 0

  for (; rounds < MAX_ROUNDS && targetA === null; rounds++) {
    // Both waiters registered BEFORE anything can trigger them: the room
    // broadcasts this round's resolve and the NEXT round's phase from the
    // same onDeadline continuation, often milliseconds apart.
    const resolveBoth = Promise.all([
      probeA.next(m => m.t === 'resolve', 20_000),
      probeB.next(m => m.t === 'resolve', 20_000),
    ])
    const nextPhaseBoth = Promise.all([
      probeA.next(m => m.t === 'phase' && m.phase === 'planning', 20_000).catch(() => null),
      probeB.next(m => m.t === 'phase' && m.phase === 'planning', 20_000).catch(() => null),
    ])

    await buyAndFieldVia(clientA, probeA, 0, () => latestA, hexCursorA)
    await buyAndFieldVia(clientB, probeB, 1, () => latestB, hexCursorB)

    const [ra, rb] = await resolveBoth
    s14(ra.round === rb.round, `both clients see the same resolved round (${ra.round})`)
    s14(ra.kind === rb.kind, `both clients see the same round kind (${ra.kind})`)

    if (pairAnnouncedForNextRound && ra.kind === 'pvp' && ra.seat?.opponentSeat === 1) {
      s14(rb.seat?.opponentSeat === 0, `round ${ra.round}: the room paired seat 1 back against seat 0`)
      targetA = ra
      targetB = rb
      break
    }
    pairAnnouncedForNextRound = ra.snapshot.players[0].nextOpponent === 1

    if (ra.survivors.length <= 1) {
      throw new Error(`netClient: the run ended (round ${ra.round}) before a 0-vs-1 pairing was ever announced`)
    }
    await nextPhaseBoth
  }
  s14(targetA !== null, `a 0-vs-1 human pairing was forced within ${MAX_ROUNDS} rounds (took ${rounds + 1})`)

  // ─── One fight, two reassemblies ────────────────────────────────────────
  const fightId: string = targetA.fightId
  s14(!!fightId && fightId === targetB.fightId, `both clients were told the same non-null fightId (${fightId})`)

  const chunkDeadline = Date.now() + 15_000
  while ((!chunksA.has(fightId) || !chunksB.has(fightId)) && Date.now() < chunkDeadline) await sleep(50)
  const setA = chunksA.get(fightId)
  const setB = chunksB.get(fightId)
  s14(
    setA !== undefined && setB !== undefined,
    'both clients completed the fight through acceptChunk — completion is holding `total` distinct indices, never counting arrivals',
  )
  if (setA === undefined || setB === undefined) throw new Error('netClient: unreachable — chunk sets missing after the assertion above')

  s14(
    setA[0].total === setB[0].total && setA.length === setA[0].total && setB.length === setB[0].total,
    `both clients completed at the same total (${setA[0].total} chunk(s) each)`,
  )
  const ascending = (chunks: FightChunk[]): boolean => chunks.every((c, i) => c.index === i)
  s14(ascending(setA) && ascending(setB), 'takeFight handed back index-sorted arrays on both clients')
  s14(
    setA.map(c => c.gzipB64).join('|') === setB.map(c => c.gzipB64).join('|'),
    'the two reassembled chunk sets are byte-identical — one server-run fight, encoded once (COMBAT-01)',
  )

  const logA = await decodeFightLog(setA)
  const logB = await decodeFightLog(setB)
  s14(JSON.stringify(logA) === JSON.stringify(logB), 'both clients decode to deep-equal FightLogs')
  s14(logA.frames.length > 0, `the decoded fight has frames to play back (${logA.frames.length})`)

  // ─── Orientation ────────────────────────────────────────────────────────
  // Mirrored for whichever seat the recorder put on the 'enemy' half — that
  // is the viewer the transform exists for, and picking it off the log rather
  // than hardcoding a seat keeps this assertion real whichever way
  // resolvePvpRound happened to order the pairing.
  const seatOnEnemyHalf: number = logA.seatB
  s14(
    (logA.seatA === 0 && logA.seatB === 1) || (logA.seatA === 1 && logA.seatB === 0),
    `the recorded log is the 0-vs-1 fight (seatA ${logA.seatA}, seatB ${logA.seatB})`,
  )

  const rawWinner = logA.winner
  const oriented = mirrorFightLogForSeat(logB, seatOnEnemyHalf)
  s14(
    logB.winner === rawWinner,
    'mirrorFightLogForSeat did not mutate its input — the source log still reports its recorded winner',
  )
  if (rawWinner === 'draw') {
    s14(oriented.winner === 'draw', "a draw stays a draw through the orientation transform")
  } else {
    s14(
      oriented.winner === (rawWinner === 'player' ? 'enemy' : 'player'),
      `the seatB viewer's oriented log reports the opposite winner (${rawWinner} -> ${oriented.winner}) — a presentation swap, not a re-derivation`,
    )
  }
  s14(oriented.seatA === logB.seatB && oriented.seatB === logB.seatA, 'the oriented log swaps seatA and seatB')
  s14(
    oriented.frames.length === logB.frames.length,
    `the orientation transform added and dropped no frame (${logB.frames.length})`,
  )
  const ticksUnchanged = oriented.frames.every((f, i) => f.tick === logB.frames[i].tick)
  s14(ticksUnchanged, 'every frame keeps its recorded tick — the transform reorders nothing')
  const eventsUnchanged = oriented.frames.every((f, i) => f.events.length === logB.frames[i].events.length)
  s14(eventsUnchanged, 'every frame keeps its exact event count — the transform adds and drops no event')

  // ─── Playback ───────────────────────────────────────────────────────────
  // The same three functions src/main.ts calls, in the same order.
  const playbackState = createPlaybackState(oriented)
  let applied = 0
  for (const f of oriented.frames) { applyFrame(playbackState, f); applied++ }
  s14(applied === oriented.frames.length, `every frame of the oriented log applied through applyFrame without throwing (${applied})`)
  s14(playbackLength(oriented) === oriented.frames.length, 'playbackLength matches the oriented frame count')

  // The property COMBAT-03 is actually about: each client, having oriented
  // ITS OWN copy to ITS OWN seat, reads the outcome the room settled for it.
  for (const [label, seat, log, resolveMsg] of [
    ['A', 0, logA, targetA],
    ['B', 1, logB, targetB],
  ] as const) {
    const own = mirrorFightLogForSeat(log, seat)
    const winner = playbackWinner(own)
    const result = resolveMsg.seat
    if (result.draw) {
      s14(winner === 'draw', `${label} (seat ${seat}): playbackWinner reports a draw, matching its own SeatFightResult`)
    } else {
      s14(
        winner === (result.won ? 'player' : 'enemy'),
        `${label} (seat ${seat}): playbackWinner on its own oriented log says '${winner}', matching SeatFightResult.won=${result.won}`,
      )
    }
  }
  scenarioPassed('the full networked round')

  clientA.close()
  clientB.close()
  await sleep(200)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Unique per run: `partykit dev`'s local Durable Object storage
  // (.partykit/state) survives dev-server restarts — which is exactly what
  // scenario 5 relies on, and exactly why a fixed room id would let one run's
  // mutations leak into the next.
  const roomId = `net-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const vars = { PLANNING_MS: String(PLANNING_MS_TEST) }

  const roundBefore = await withRoom(({ host }) => beforeRestart(host, roomId), vars)

  // The room PROCESS goes away here, so the second withRoom below re-runs
  // onStart against the same persisted storage. A client-side reconnect would
  // not do that, and would not exercise the case this scenario exists for.
  console.log('--- restarting the room process ---')
  await waitForRoomDown(ROOM_PORT)

  await withRoom(async ({ host }) => {
    await afterRestart(host, roomId, roundBefore)
    // Scenarios 8-9 need a room that has NEVER been started (phase 'lobby'),
    // which the room above stopped being back in scenario 2. They get their
    // own fresh room id on the SAME already-running server process — a
    // Durable Object is keyed by id, so a new id is a new room without the
    // cost of a third `partykit dev` spawn.
    await lobbyScreenFlow(host, `${roomId}-lobby`)
  }, vars)

  // A THIRD process, unlike scenarios 8-9's fresh-room-same-process trick:
  // PLANNING_MS is a `--var` bound at process start, and scenarios 10-11 need
  // a planning window an order of magnitude longer than the one above.
  console.log('--- restarting the room process with a long planning window ---')
  await waitForRoomDown(ROOM_PORT)

  await withRoom(
    async ({ host }) => {
      await actionSemantics(host, `${roomId}-actions`)
      // Scenario 12 needs the same long window (all of its assertions have to
      // land inside one planning phase) but a room nobody has spent down —
      // scenarios 10-11 deliberately leave seat 0 broke. Fresh room id, same
      // process, exactly the trick scenarios 8-9 use.
      await sharedPoolConservation(host, `${roomId}-pool`)
      // Scenario 13 wants a fresh never-started room (it asserts on the FIRST
      // planning frame) and the long window, so its 500ms simulated read lands
      // comfortably inside the budget rather than against an about-to-expire
      // 2s one. Fresh room id, same process — the scenarios 8-9 trick again.
      await deadlineAgreement(host, `${roomId}-clock`)
    },
    { PLANNING_MS: String(PLANNING_MS_ACTIONS) },
  )

  // A FOURTH process, back on the short window: scenario 14 has to drive real
  // rounds until the room pairs its two humans against each other, and a 20s
  // planning phase would make that a multi-minute wait rather than a test.
  console.log('--- restarting the room process for the full-round scenario ---')
  await waitForRoomDown(ROOM_PORT)

  await withRoom(({ host }) => fullNetworkedRound(host, `${roomId}-round`), vars)
}

const timeout = new Promise((_resolve, reject) => {
  setTimeout(() => reject(new Error(`netClient: exceeded outer timeout of ${OUTER_TIMEOUT_MS}ms`)), OUTER_TIMEOUT_MS)
})

Promise.race([main(), timeout])
  .then(() => {
    // Reports the count actually run rather than a hardcoded total: later
    // plans append scenarios to this file, and a frozen number would rot on
    // the first append.
    console.log(`netClient: all assertions passed across ${scenariosRun} scenario(s)`)
    process.exit(0)
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
