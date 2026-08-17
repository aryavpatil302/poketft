// Two-client integration run against a live `partykit dev` room: proves
// deterministic seating, that a forged seat field in a client payload is
// inert (not honored, not fatal), room-full rejection, shared-pool
// conservation under interleaved concurrent play, and that a disconnect
// reverts a seat's persona/name while preserving its economy exactly.
//
// Run as: `npx tsx scripts/roomSeats.ts`

import { withRoom, connect, nextMessage } from './roomHarness'
import { REROLL_COST, BENCH_SLOTS, copiesHeld } from '../src/econ/constants'
import type PartySocket from 'partysocket'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
  console.log(`OK: ${message}`)
}

// Reproduces src/game/round.test.ts's heldCopies helper exactly — a
// mismatch between the two would itself be a real finding, not a
// convenience worth reinventing differently.
function heldCopies(snapshot: any, definitionId: string): number {
  let total = 0
  for (const econ of snapshot.players) {
    for (const b of econ.bench) {
      if (b && b.definitionId === definitionId) total += copiesHeld(b.tier)
    }
    for (const u of econ.board) {
      if (u.definitionId === definitionId) total += copiesHeld(u.tier)
    }
  }
  return total
}

function poolTotal(snapshot: any, id: string): number {
  return snapshot.pool[id] + heldCopies(snapshot, id)
}

function safeParse(raw: unknown): any {
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  await withRoom(async ({ host }) => {
    const roomId = `seats-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    // ─── Scenario 1: deterministic seating ────────────────────────────────
    const a = connect(host, roomId, 'Host')
    const welcomeA = await nextMessage<any>(a, m => m.t === 'welcome')
    assert(welcomeA.seat === 0, 'client A (Host) takes seat 0')
    const originalSeat1PersonaId = welcomeA.snapshot.players[1].personaId
    const originalSeat1Name = welcomeA.snapshot.players[1].name

    // Attach A's listener BEFORE B connects — the room broadcasts to A as
    // part of B's onConnect handler, which can beat a listener registered
    // only after awaiting B's own welcome.
    const arrivalPromise = nextMessage<any>(a, m => m.t === 'lobby' || m.t === 'seat-taken')

    const b = connect(host, roomId, 'Friend')
    const welcomeB = await nextMessage<any>(b, m => m.t === 'welcome')
    assert(welcomeB.seat === 1, 'client B (Friend) takes seat 1')

    const arrivalMsg = await arrivalPromise
    assert(!!arrivalMsg, "client A received a lobby/seat-taken update reflecting B's arrival")

    const lobbyAfterBoth = welcomeB.lobby
    assert(lobbyAfterBoth[0].human === true && lobbyAfterBoth[1].human === true, 'lobby reports seats 0 and 1 as human: true')
    assert(
      lobbyAfterBoth.slice(2).every((s: any) => s.human === false),
      'lobby reports seats 2-5 as human: false',
    )
    assert(lobbyAfterBoth[0].name === 'Host' && lobbyAfterBoth[1].name === 'Friend', 'names rendered are the sanitized Host/Friend')

    console.log('PASS: deterministic seating')

    // ─── Scenario 2: seat isolation under a forged payload ────────────────
    const beforeForge = welcomeB.snapshot
    const seat0GoldBefore = beforeForge.players[0].gold
    const seat0ShopBefore = JSON.stringify(beforeForge.players[0].shop)
    const seat1GoldBefore = beforeForge.players[1].gold

    b.send(JSON.stringify({ t: 'action', seat: 0, action: { t: 'reroll' } }))
    const afterForge = await nextMessage<any>(b, m => m.t === 'snapshot' || m.t === 'rejected')
    assert(afterForge.t === 'snapshot', 'a forged extra `seat` field does not make the payload fatal — the legitimate action still applies')

    const seat1AfterForge = afterForge.snapshot.players[1]
    assert(
      seat1AfterForge.gold === seat1GoldBefore - REROLL_COST,
      `seat 1 (the true sender) paid the reroll cost (${seat1GoldBefore} -> ${seat1AfterForge.gold})`,
    )
    const seat0AfterForge = afterForge.snapshot.players[0]
    assert(seat0AfterForge.gold === seat0GoldBefore, 'seat 0 gold is byte-identical before/after the forged payload')
    assert(JSON.stringify(seat0AfterForge.shop) === seat0ShopBefore, 'seat 0 shop is byte-identical before/after the forged payload')

    console.log('PASS: forged-seat isolation')

    // ─── Scenario 3: room-full rejection ───────────────────────────────────
    const extras: PartySocket[] = []
    for (const name of ['C', 'D', 'E', 'F']) {
      const sock = connect(host, roomId, name)
      await nextMessage<any>(sock, m => m.t === 'welcome')
      extras.push(sock)
    }

    const seventh = connect(host, roomId, 'Overflow')
    const rejectedMsg = await nextMessage<any>(seventh, m => m.t === 'rejected')
    assert(rejectedMsg.reason === 'not-seated', 'a 7th connection to a full (6-seat) room is rejected with not-seated')
    seventh.close()
    await new Promise(resolve => setTimeout(resolve, 300))
    assert(seventh.readyState === seventh.CLOSED, "the rejected connection's socket closes")

    for (const sock of extras) sock.close()
    await new Promise(resolve => setTimeout(resolve, 300))

    const statusRes = await fetch(`http://${host}/parties/main/${roomId}`)
    const status = await statusRes.json() as { seats: Array<{ seat: number; human: boolean }> }
    assert(
      status.seats[0].human === true && status.seats[1].human === true,
      'after the four extra connections close, seats 0 and 1 remain human',
    )
    assert(
      status.seats.slice(2).every(s => s.human === false),
      'after the four extra connections close, seats 2-5 are bot-held again',
    )

    console.log('PASS: room-full rejection')

    // ─── Scenario 4: interleaved concurrent play, pool conservation ───────
    // Establish a fresh baseline snapshot right before the burst — a `lock`
    // action always succeeds regardless of gold/state, so it's a safe way
    // to get one.
    a.send(JSON.stringify({ t: 'action', action: { t: 'lock', locked: false } }))
    const baselineMsg = await nextMessage<any>(a, m => m.t === 'snapshot')
    const baseline = baselineMsg.snapshot

    // Because a rejected action legitimately produces no broadcast, we do
    // NOT wait for a snapshot after every send — that would deadlock on the
    // first rejected action. Instead we drive the burst by counting
    // `snapshot` (only counted once, via A's socket, since a broadcast
    // reaches every connection regardless of sender) plus `rejected`
    // (counted per-sender, since rejections are unicast) messages received,
    // and drain until the count settles or a timeout elapses.
    let acceptedTotal = 0
    let rejectedForA = 0
    let rejectedForB = 0
    let latest = baseline

    a.addEventListener('message', event => {
      const parsed = safeParse(event.data)
      if (!parsed) return
      if (parsed.t === 'snapshot') { acceptedTotal++; latest = parsed.snapshot }
      else if (parsed.t === 'rejected') rejectedForA++
    })
    b.addEventListener('message', event => {
      const parsed = safeParse(event.data)
      if (!parsed) return
      if (parsed.t === 'rejected') rejectedForB++
    })

    const ACTIONS_TOTAL = 34
    const kinds: Array<'reroll' | 'buy' | 'sell'> = ['reroll', 'buy', 'sell']
    for (let i = 0; i < ACTIONS_TOTAL; i++) {
      const sock = i % 2 === 0 ? a : b
      const seatIdx = i % 2 === 0 ? 0 : 1
      const kind = kinds[i % kinds.length]
      const econ = latest.players[seatIdx]

      let action: any
      if (kind === 'reroll') {
        action = { t: 'reroll' }
      } else if (kind === 'buy') {
        const slot = econ.shop.findIndex((s: string | null) => s !== null)
        action = slot !== -1 ? { t: 'buy', slot } : { t: 'reroll' }
      } else {
        action = { t: 'sell', from: 'bench', index: 0 }
      }
      sock.send(JSON.stringify({ t: 'action', action }))
    }

    const drainDeadline = Date.now() + 15_000
    let lastSeenCount = -1
    let stableSince = Date.now()
    while (Date.now() < drainDeadline) {
      const seenNow = acceptedTotal + rejectedForA + rejectedForB
      if (seenNow !== lastSeenCount) { lastSeenCount = seenNow; stableSince = Date.now() }
      if (seenNow >= ACTIONS_TOTAL && Date.now() - stableSince > 300) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    console.log(
      `Interleaved burst: ${ACTIONS_TOTAL} actions fired, ${acceptedTotal} accepted (broadcasts observed), ` +
      `${rejectedForA + rejectedForB} rejected (A: ${rejectedForA}, B: ${rejectedForB})`,
    )

    // One more guaranteed-successful action settles a final snapshot after
    // the burst has fully drained.
    a.send(JSON.stringify({ t: 'action', action: { t: 'lock', locked: false } }))
    const finalMsg = await nextMessage<any>(a, m => m.t === 'snapshot')
    const finalSnapshot = finalMsg.snapshot

    const idsToCheck = new Set<string>(Object.keys(baseline.pool))
    for (const snap of [baseline, finalSnapshot]) {
      for (const econ of snap.players) {
        for (const bu of econ.bench) if (bu) idsToCheck.add(bu.definitionId)
        for (const u of econ.board) idsToCheck.add(u.definitionId)
      }
    }
    const mismatches: string[] = []
    for (const id of idsToCheck) {
      const before = poolTotal(baseline, id)
      const after = poolTotal(finalSnapshot, id)
      if (before !== after) mismatches.push(`${id}: ${before} -> ${after}`)
    }
    assert(
      mismatches.length === 0,
      `poolTotal invariant holds for all ${idsToCheck.size} definition ids observed` +
      (mismatches.length ? ` (mismatches: ${mismatches.join(', ')})` : ''),
    )

    for (const econ of finalSnapshot.players) {
      assert(econ.gold >= 0, `seat gold stayed non-negative (${econ.name}: ${econ.gold})`)
      assert(econ.bench.length <= BENCH_SLOTS, `seat bench stayed within its slot count (${econ.name}: ${econ.bench.length})`)
    }

    console.log('PASS: interleaved pool conservation')

    // ─── Scenario 5: disconnect revert ─────────────────────────────────────
    const recordedSeat1 = finalSnapshot.players[1]

    // Attach the listener before closing B — same ordering reason as the
    // arrival listener above.
    const revertPromise = nextMessage<any>(a, m => m.t === 'lobby' || m.t === 'seat-freed')
    b.close()
    const revertMsg = await revertPromise
    assert(!!revertMsg, "client A observed a lobby/seat-freed broadcast after B's disconnect")

    a.send(JSON.stringify({ t: 'action', action: { t: 'lock', locked: false } }))
    const afterRevertMsg = await nextMessage<any>(a, m => m.t === 'snapshot')
    const seat1AfterRevert = afterRevertMsg.snapshot.players[1]

    assert(seat1AfterRevert.personaId === originalSeat1PersonaId, 'seat 1 personaId reverted to its original bot persona')
    assert(seat1AfterRevert.name === originalSeat1Name, 'seat 1 name reverted to its original bot name')
    assert(seat1AfterRevert.shopLocked === false, 'seat 1 shopLocked reset to false on revert')
    assert(seat1AfterRevert.gold === recordedSeat1.gold, 'seat 1 gold preserved across the revert')
    assert(seat1AfterRevert.level === recordedSeat1.level, 'seat 1 level preserved across the revert')
    assert(seat1AfterRevert.xp === recordedSeat1.xp, 'seat 1 xp preserved across the revert')
    assert(seat1AfterRevert.hp === recordedSeat1.hp, 'seat 1 hp preserved across the revert')
    assert(JSON.stringify(seat1AfterRevert.bench) === JSON.stringify(recordedSeat1.bench), 'seat 1 bench preserved across the revert')
    assert(JSON.stringify(seat1AfterRevert.board) === JSON.stringify(recordedSeat1.board), 'seat 1 board preserved across the revert')
    assert(
      JSON.stringify(seat1AfterRevert.itemBench) === JSON.stringify(recordedSeat1.itemBench),
      'seat 1 itemBench preserved across the revert',
    )

    const c = connect(host, roomId, 'Newcomer')
    const welcomeC = await nextMessage<any>(c, m => m.t === 'welcome')
    assert(welcomeC.seat === 1, 'a reconnecting client is assigned the freed lowest seat (1), not seat 2')

    console.log('PASS: disconnect revert with lowest-seat reassignment')

    a.close()
    c.close()
  })
}

main()
  .then(() => {
    console.log('roomSeats: all assertions passed')
    process.exit(0)
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
