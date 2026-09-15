// Proves party/lobby.ts's playback-done ack gate: the next planning phase
// waits for every connected seat with a real fight to explicitly say it's
// done watching, rather than a guessed duration from frame count. This is
// the fix for a real reported bug — two clients in the same lobby, one
// already on the next round's combat while the other was still mid-fight
// on the current one — caused by the old estimate-based wait sometimes
// running out before a slower client had actually finished watching.
//
// Deliberately does NOT pass SKIP_PLAYBACK_DELAY — that flag exists so
// scripts/roomRound.ts and scripts/netClient.ts can skip this wait entirely
// and stay fast; this script's whole point is to exercise it.
//
// Run as: `npx tsx scripts/roomAckWait.ts`

import { withRoom, connect, nextMessage } from './roomHarness'

const PLANNING_MS_TEST = 1500
const OUTER_TIMEOUT_MS = 60_000

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
  console.log(`OK: ${message}`)
}

async function connectAndStart(host: string, roomId: string): Promise<{ a: ReturnType<typeof connect>; b: ReturnType<typeof connect> }> {
  const a = connect(host, roomId, 'A')
  const b = connect(host, roomId, 'B')
  await nextMessage<any>(a, m => m.t === 'welcome')
  await nextMessage<any>(b, m => m.t === 'welcome')

  const firstPhaseBoth = Promise.all([
    nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning'),
    nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning'),
  ])
  a.send(JSON.stringify({ t: 'start' }))
  await firstPhaseBoth
  return { a, b }
}

async function main(): Promise<void> {
  await withRoom(async ({ host }) => {
    // ─── Scenario 1: the room waits for the slower seat's ack ────────────
    // Round 1 is always a creep round with a real recorded fight for every
    // connected seat, even with empty boards (see scripts/roomRound.ts's
    // scenario 2/3-5 comments) — no need to force a PvP pairing to get
    // something to ack.
    {
      const roomId = `ackwait-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { a, b } = await connectAndStart(host, roomId)

      const resolveBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'resolve'),
        nextMessage<any>(b, m => m.t === 'resolve'),
      ])
      const [resolveA, resolveB] = await resolveBoth
      assert(resolveA.kind === 'creep', 'round 1 is a creep round')
      assert(resolveA.seat?.logIndex != null && resolveB.seat?.logIndex != null, 'both seats have a real fight to ack')

      // B acks immediately; A deliberately withholds its ack.
      b.send(JSON.stringify({ t: 'playback-done', round: resolveB.round }))

      const prematurePhase = await nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning', 1200)
        .then(() => true).catch(() => false)
      assert(!prematurePhase, "round 2's planning phase does NOT open while A still hasn't acked")

      const nextPhaseBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning', 3000),
        nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning', 3000),
      ])
      a.send(JSON.stringify({ t: 'playback-done', round: resolveA.round }))
      const [phaseA, phaseB] = await nextPhaseBoth
      assert(phaseA.round === 2 && phaseB.round === 2, "round 2's planning phase opens promptly once A finally acks")

      a.close()
      b.close()
      console.log("PASS: room waits for the slower seat's ack")
    }

    // ─── Scenario 2: a disconnect mid-wait doesn't stall the room ────────
    {
      const roomId = `ackwait-disc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { a, b } = await connectAndStart(host, roomId)

      const resolveBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'resolve'),
        nextMessage<any>(b, m => m.t === 'resolve'),
      ])
      const [resolveA] = await resolveBoth

      // A acks; B disconnects instead of ever acking. Neither event's order
      // matters — whichever the server processes last is the one that sees
      // the required set empty and resolves.
      const nextPhaseA = nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning', 5000)
      a.send(JSON.stringify({ t: 'playback-done', round: resolveA.round }))
      b.close()

      const phaseA = await nextPhaseA
      assert(
        phaseA.round === 2,
        'round 2 opens for the remaining seat once the other disconnects mid-wait, without waiting out the fallback timeout',
      )

      a.close()
      console.log('PASS: disconnect mid-wait does not stall the room')
    }
  }, { PLANNING_MS: String(PLANNING_MS_TEST) })   // SKIP_PLAYBACK_DELAY intentionally NOT set
}

const timeout = new Promise((_resolve, reject) => {
  setTimeout(() => reject(new Error(`roomAckWait: exceeded outer timeout of ${OUTER_TIMEOUT_MS}ms`)), OUTER_TIMEOUT_MS)
})

Promise.race([main(), timeout])
  .then(() => {
    console.log('roomAckWait: all assertions passed')
    process.exit(0)
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
