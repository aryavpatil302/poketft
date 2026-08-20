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
import { REROLL_COST, PLAYER_COUNT } from '../src/econ/constants'

// Shortens the room's planning window so a multi-round run doesn't spend a
// real 30s per round (partykit --var, surfaced on Party.Room.env — see
// src/net/protocol.ts's planningMsFor comment for why NOT process.env).
const PLANNING_MS_TEST = 2000
const OUTER_TIMEOUT_MS = 5 * 60_000

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
  scenarioPassed('seat list liveness')

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

  clientA.close()
  clientC.close()
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
