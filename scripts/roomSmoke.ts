// End-to-end smoke assertion: a single Node client connects to a locally
// running room, takes seat 0, buys a unit, and observes the room's own
// authoritative snapshot reflect the purchase — the whole round trip
// verified by one command: `npx tsx scripts/roomSmoke.ts`.

import { withRoom, connect, nextMessage } from './roomHarness'
import { PROTOCOL_VERSION } from '../src/net/protocol'
import { PLAYER_COUNT } from '../src/econ/constants'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
  console.log(`OK: ${message}`)
}

async function main(): Promise<void> {
  await withRoom(async ({ host }) => {
    // Unique per run: `partykit dev`'s local Durable Object storage
    // (.partykit/state) persists across dev-server restarts, so a fixed room
    // id would let one run's mutations leak into the next and make repeated
    // runs of this smoke test non-deterministic.
    const roomId = `smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const sock = connect(host, roomId)

    const welcome = await nextMessage<any>(sock, m => m.t === 'welcome')
    assert(welcome.seat === 0, 'welcome arrives with seat === 0')
    assert(welcome.protocol === PROTOCOL_VERSION, `protocol === PROTOCOL_VERSION (${PROTOCOL_VERSION})`)
    assert(welcome.snapshot.players.length === PLAYER_COUNT, `snapshot.players.length === PLAYER_COUNT (${PLAYER_COUNT})`)
    assert(welcome.snapshot.players[0].personaId === null, 'seat 0 personaId is null (human)')
    assert(
      welcome.snapshot.players.slice(1).every((p: any) => p.personaId !== null),
      'every other seat is bot-held (non-null personaId)',
    )

    // A room now waits in phase 'lobby' until its host starts it — the buy
    // below would otherwise be rejected 'wrong-phase'. Register both waits
    // before sending, since beginPlanning() broadcasts phase and snapshot
    // back to back.
    const startedBoth = Promise.all([
      nextMessage<any>(sock, m => m.t === 'phase' && m.phase === 'planning'),
      nextMessage<any>(sock, m => m.t === 'snapshot'),
    ])
    sock.send(JSON.stringify({ t: 'start' }))
    const [started, opening] = await startedBoth
    assert(started.phase === 'planning', "seat 0's start moves the room to planning")

    // Read the shop from the OPENING snapshot, not the welcome: beginPlanning
    // runs startPlanning(), which rolls every unlocked seat's shop, so the
    // welcome's slots are already stale by the time this buy is sent.
    const seat0 = opening.snapshot.players[0]
    const slot = seat0.shop.findIndex((s: string | null) => s !== null)
    assert(slot !== -1, 'seat 0 shop has at least one non-null slot')
    const definitionId = seat0.shop[slot]
    const goldBefore = seat0.gold
    const poolBefore = opening.snapshot.pool[definitionId]

    sock.send(JSON.stringify({ t: 'action', action: { t: 'buy', slot } }))
    const afterBuy = await nextMessage<any>(sock, m => m.t === 'snapshot')

    const seat0After = afterBuy.snapshot.players[0]
    assert(seat0After.gold < goldBefore, `gold decreased (${goldBefore} -> ${seat0After.gold})`)
    const onBench = seat0After.bench.some((b: any) => b && b.definitionId === definitionId)
    const onBoard = seat0After.board.some((b: any) => b && b.definitionId === definitionId)
    assert(onBench || onBoard, `bought unit ${definitionId} appears on bench or board`)
    const poolAfter = afterBuy.snapshot.pool[definitionId]
    assert(poolAfter === poolBefore - 1, `pool[${definitionId}] decreased by exactly 1 (${poolBefore} -> ${poolAfter})`)

    let sawSnapshotAfterMalformed = false
    sock.addEventListener('message', event => {
      try {
        const parsed = JSON.parse(String(event.data))
        if (parsed.t === 'snapshot') sawSnapshotAfterMalformed = true
      } catch {
        // ignore
      }
    })
    sock.send('not json')
    const rejected = await nextMessage<any>(sock, m => m.t === 'rejected')
    assert(rejected.reason === 'malformed', `malformed payload yields rejected/malformed (got reason: ${rejected.reason})`)

    // Give any stray snapshot broadcast a moment to arrive before asserting
    // none did.
    await new Promise(resolve => setTimeout(resolve, 200))
    assert(!sawSnapshotAfterMalformed, 'no snapshot broadcast followed the malformed payload')

    sock.close()
  })
}

main()
  .then(() => {
    console.log('roomSmoke: all assertions passed')
    process.exit(0)
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
