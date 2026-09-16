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

    // ─── Scenario 3: shop actions work during 'resolving', and a reroll ──
    // made there survives into the next planning phase (isn't silently
    // re-rolled out from under it — the hazard this plan's shop-roll-timing
    // fix specifically closes; see party/lobby.ts's advanceEconomy).
    {
      const roomId = `ackwait-actions-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { a, b } = await connectAndStart(host, roomId)

      const resolveBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'resolve'),
        nextMessage<any>(b, m => m.t === 'resolve'),
      ])
      const [resolveA] = await resolveBoth
      // resolveRound's returned .round is the round that just resolved
      // (captured BEFORE resolveRound's internal increment) — this is what
      // pendingAckRound is set from, and what a real client's
      // currentCombatRound tracks (src/main.ts's handleNetResolve). A
      // snapshot's own .round is already post-increment — using that here
      // instead would silently mismatch every ack below.
      const ackRound = resolveA.round

      // Sent immediately, well before either seat acks playback-done — i.e.
      // squarely inside the 'resolving' window this plan newly unblocks.
      const snapshotAfterReroll = nextMessage<any>(a, m => m.t === 'snapshot')
      const rejectedAfterReroll = nextMessage<any>(a, m => m.t === 'rejected', 2000).catch(() => null)
      a.send(JSON.stringify({ t: 'action', action: { t: 'reroll' } }))

      const rejected = await rejectedAfterReroll
      assert(rejected === null, "a reroll sent during 'resolving' is NOT rejected wrong-phase")
      const snapAfterReroll = await snapshotAfterReroll
      const shopAfterReroll = JSON.stringify(snapAfterReroll.snapshot.players[0].shop)

      // Now let the round actually advance (both ack, wait for planning).
      // The snapshot listener is registered ALONGSIDE the phase listener,
      // before either message can arrive — openPlanningWindow sends its
      // snapshot broadcast immediately after the phase broadcast, often
      // within the same tick, so attaching it only after awaiting the phase
      // message risks missing it (the same race scripts/roomRound.ts's own
      // scenarios are careful to avoid).
      const nextPhaseBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning', 5000),
        nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning', 5000),
      ])
      const planningSnapshotWait = nextMessage<any>(a, m => m.t === 'snapshot', 5000)
      a.send(JSON.stringify({ t: 'playback-done', round: ackRound }))
      b.send(JSON.stringify({ t: 'playback-done', round: ackRound }))
      await nextPhaseBoth

      // The snapshot broadcast alongside beginPlanning's phase-open carries
      // the SAME shop the reroll produced — proving openPlanningWindow no
      // longer re-rolls over it.
      const planningSnapshot = await planningSnapshotWait
      const shopAtPlanning = JSON.stringify(planningSnapshot.snapshot.players[0].shop)
      assert(
        shopAtPlanning === shopAfterReroll,
        "the reroll made during 'resolving' survives into the next planning phase unchanged",
      )

      a.close()
      b.close()
      console.log("PASS: shop actions during 'resolving' work, and a reroll there isn't silently discarded")
    }

    // ─── Scenario 4: Delibird's Gift — one seat picks, one times out ──────
    // Round 3 is always the first item round (src/econ/creeps.ts's
    // isItemRound). Rounds 1-2 are creep rounds — every connected seat gets
    // a real recorded fight there too, so (like every other scenario in
    // this file) both must ack playback-done before the room opens the
    // next round's planning phase.
    {
      const roomId = `ackwait-item-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { a, b } = await connectAndStart(host, roomId)

      for (const creepRound of [1, 2]) {
        const resolveBoth = Promise.all([
          nextMessage<any>(a, m => m.t === 'resolve' && m.round === creepRound),
          nextMessage<any>(b, m => m.t === 'resolve' && m.round === creepRound),
        ])
        const nextPhaseBoth = Promise.all([
          nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning' && m.round === creepRound + 1, 10_000),
          nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning' && m.round === creepRound + 1, 10_000),
        ])
        await resolveBoth
        a.send(JSON.stringify({ t: 'playback-done', round: creepRound }))
        b.send(JSON.stringify({ t: 'playback-done', round: creepRound }))
        await nextPhaseBoth
      }

      // Round 3's own deadline fires next; the room rolls each connected
      // seat's OWN 3 choices and sends item-choices — before resolving the
      // round at all (party/lobby.ts's resolveItemChoices runs ahead of
      // resolveRound).
      const itemChoicesBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'item-choices' && m.round === 3, 10_000),
        nextMessage<any>(b, m => m.t === 'item-choices' && m.round === 3, 10_000),
      ])
      const [choicesA, choicesB] = await itemChoicesBoth
      assert(Array.isArray(choicesA.choices) && choicesA.choices.length === 3, 'seat A is offered exactly 3 item choices')
      assert(Array.isArray(choicesB.choices) && choicesB.choices.length === 3, 'seat B is offered exactly 3 item choices')

      // A picks promptly; B never responds at all.
      const pickedItem = choicesA.choices[0]
      a.send(JSON.stringify({ t: 'pickItem', round: 3, itemId: pickedItem }))

      // The round must NOT resolve just because A picked — B hasn't, and
      // nothing should proceed until either B picks or the timeout elapses.
      const prematureResolve = await nextMessage<any>(a, m => m.t === 'resolve', 1200)
        .then(() => true).catch(() => false)
      assert(!prematureResolve, 'round 3 does NOT resolve just because one seat picked — it waits for the other or a timeout')

      // Eventually (the item-pick deadline elapses) it resolves anyway,
      // auto-picking for B from B's own offered choices.
      const resolveBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'resolve', 10_000),
        nextMessage<any>(b, m => m.t === 'resolve', 10_000),
      ])
      const [resolveA] = await resolveBoth
      assert(resolveA.kind === 'item', 'round 3 resolves as an item round')
      assert(
        resolveA.snapshot.players[0].itemBench.includes(pickedItem),
        "seat A's own picked item landed in its itemBench",
      )
      const bItemBench: string[] = resolveA.snapshot.players[1].itemBench
      assert(bItemBench.length > 0, 'seat B (never responded) still got an item')
      assert(
        bItemBench.every(id => choicesB.choices.includes(id)),
        "seat B's auto-picked item came from B's OWN offered 3 choices, not an arbitrary one",
      )

      a.close()
      b.close()
      console.log("PASS: Delibird's Gift — one seat picks, the other times out and gets auto-picked")
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
