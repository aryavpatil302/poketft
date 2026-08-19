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
import { RoomClient } from '../src/net/roomClient'
import { PROTOCOL_VERSION, type ServerMessage } from '../src/net/protocol'
import { REROLL_COST } from '../src/econ/constants'

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

function probeClient(client: RoomClient) {
  const seen: ServerMessage[] = []
  const waiters = new Set<Waiter>()

  client.onMessage(m => {
    seen.push(m)
    for (const waiter of Array.from(waiters)) {
      if (!waiter.predicate(m)) continue
      clearTimeout(waiter.timer)
      waiters.delete(waiter)
      waiter.resolve(m)
    }
  })

  return {
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

  client.close()
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

  await withRoom(({ host }) => afterRestart(host, roomId, roundBefore), vars)
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
