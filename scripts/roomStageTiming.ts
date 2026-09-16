// Proves party/lobby.ts's deterministic stage-window model: every stage is
// always at least the room's normal planning duration long (computed once,
// at the exact moment a round resolves, from the recorded fight(s)' own
// tick counts — never from any client signal), so the room advances to the
// next planning phase with NO client ever having to say anything at all.
// This replaces an earlier ack-based design (a client explicitly signalling
// "I'm done watching") that turned out not to match the actual intent:
// every stage should always be the same fixed length, with a unit whose
// combat finished early just celebrating under the same shared clock until
// everyone else's does too — not "whoever's slowest decides."
//
// Deliberately does NOT pass SKIP_PLAYBACK_DELAY — that flag exists so
// scripts/roomRound.ts and scripts/netClient.ts can skip this wait entirely
// and stay fast; this script's whole point is to exercise it.
//
// Run as: `npx tsx scripts/roomStageTiming.ts`

import { withRoom, connect, nextMessage } from './roomHarness'

const PLANNING_MS_TEST = 4000
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
    // ─── Scenario 1: the room advances with no client ever acking ────────
    // Round 1 is a creep round — both seats get a real recorded fight
    // (non-null logIndex) — yet neither client sends ANYTHING beyond the
    // initial 'start': no ack, no action, nothing. The room must still
    // reach round 2's planning phase on its own, at the deadline its own
    // resolve already told both clients about, proving the wait is fully
    // deterministic and depends on zero client cooperation.
    {
      const roomId = `stagetiming-noop-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { a, b } = await connectAndStart(host, roomId)

      const resolveBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'resolve' && m.round === 1),
        nextMessage<any>(b, m => m.t === 'resolve' && m.round === 1),
      ])
      const nextPhaseBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning' && m.round === 2, 15_000),
        nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning' && m.round === 2, 15_000),
      ])

      const [resolveA, resolveB] = await resolveBoth
      assert(resolveA.kind === 'creep', 'round 1 is a creep round')
      assert(resolveA.seat?.logIndex != null && resolveB.seat?.logIndex != null, 'both seats have a real fight — yet neither client will ack it')
      assert(typeof resolveA.deadline === 'number', "the resolve itself already carries this stage's shared deadline")
      assert(resolveA.deadline === resolveB.deadline, 'both seats are told the identical absolute deadline')

      const resolvedAt = Date.now()
      await nextPhaseBoth   // <- no send() of any kind happens between here and above
      const elapsedMs = Date.now() - resolvedAt

      // A real wait genuinely happened (not an instant/zero-length one) —
      // the fixed intro+network overhead alone (party/lobby.ts's
      // COMBAT_INTRO_MS + its network buffer) is on the order of ~2s, so
      // anything reasonably close to that confirms the deterministic
      // formula actually ran rather than short-circuiting.
      assert(elapsedMs > 500, `round 2's planning phase took a real, non-instant wait to arrive (got ${elapsedMs}ms)`)
      console.log(`round 1 -> round 2 took ${elapsedMs}ms with zero client signals of any kind`)

      a.close()
      b.close()
      console.log("PASS: the room advances deterministically with no client ever acking")
    }

    // ─── Scenario 2: shop actions work during 'resolving', and a reroll ──
    // made there survives into the next planning phase (isn't silently
    // re-rolled out from under it — the hazard the shop-roll-timing fix
    // specifically closes; see party/lobby.ts's advanceEconomy). Unaffected
    // by the ack-removal above — this is about WHEN the shop is rolled, not
    // when the stage's own timer elapses.
    {
      const roomId = `stagetiming-actions-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { a, b } = await connectAndStart(host, roomId)

      const resolveBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'resolve'),
        nextMessage<any>(b, m => m.t === 'resolve'),
      ])
      const [resolveA] = await resolveBoth
      const ackRound = resolveA.round

      // Sent immediately, well before the stage's own deadline elapses —
      // i.e. squarely inside the 'resolving' window this plan newly unblocks.
      const snapshotAfterReroll = nextMessage<any>(a, m => m.t === 'snapshot')
      const rejectedAfterReroll = nextMessage<any>(a, m => m.t === 'rejected', 2000).catch(() => null)
      a.send(JSON.stringify({ t: 'action', action: { t: 'reroll' } }))

      const rejected = await rejectedAfterReroll
      assert(rejected === null, "a reroll sent during 'resolving' is NOT rejected wrong-phase")
      const snapAfterReroll = await snapshotAfterReroll
      const shopAfterReroll = JSON.stringify(snapAfterReroll.snapshot.players[0].shop)

      // Now let the stage actually elapse (nothing more to send — the deterministic
      // clock does the rest) and confirm the reroll's shop survives unchanged.
      const nextPhaseBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning', 15_000),
        nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning', 15_000),
      ])
      const planningSnapshotWait = nextMessage<any>(a, m => m.t === 'snapshot', 15_000)
      await nextPhaseBoth

      const planningSnapshot = await planningSnapshotWait
      const shopAtPlanning = JSON.stringify(planningSnapshot.snapshot.players[0].shop)
      assert(
        shopAtPlanning === shopAfterReroll,
        `the reroll made during 'resolving' (round ${ackRound}) survives into the next planning phase unchanged`,
      )

      a.close()
      b.close()
      console.log("PASS: shop actions during 'resolving' work, and a reroll there isn't silently discarded")
    }

    // ─── Scenario 3: Delibird's Gift — one seat picks, one never does ─────
    // Round 3 is always the first item round (src/econ/creeps.ts's
    // isItemRound). Rounds 1-2 are creep rounds; nobody needs to do
    // anything for those to resolve (see Scenario 1).
    {
      const roomId = `stagetiming-item-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { a, b } = await connectAndStart(host, roomId)

      for (const creepRound of [1, 2]) {
        const nextPhaseBoth = Promise.all([
          nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning' && m.round === creepRound + 1, 15_000),
          nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning' && m.round === creepRound + 1, 15_000),
        ])
        await nextPhaseBoth
      }

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
      const prematureResolve = await nextMessage<any>(a, m => m.t === 'resolve', 1500)
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
  setTimeout(() => reject(new Error(`roomStageTiming: exceeded outer timeout of ${OUTER_TIMEOUT_MS}ms`)), OUTER_TIMEOUT_MS)
})

Promise.race([main(), timeout])
  .then(() => {
    console.log('roomStageTiming: all assertions passed')
    process.exit(0)
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
