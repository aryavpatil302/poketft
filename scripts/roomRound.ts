// End-to-end round loop: two Node clients shop against a real self-driving
// room, ride out a real (shortened) deadline, and reassemble/play back the
// exact human-vs-human fight the server ran — the LOBBY-04/COMBAT-01
// requirement pair this whole phase exists for.
//
// Run as: `npx tsx scripts/roomRound.ts`

import { withRoom, connect, nextMessage } from './roomHarness'
import { decodeFightLog, type FightChunk } from '../src/net/fightWire'
import { createPlaybackState, applyFrame, playbackLength, playbackWinner } from '../src/game/playback'
import {
  REROLL_COST, BASE_INCOME_BY_ROUND, BASE_INCOME_CAP, MAX_INTEREST, streakBonus,
} from '../src/econ/constants'
import type PartySocket from 'partysocket'

// Shortens the room's planning window from the real 30s default to 2s for
// this run only (via partykit's --var, surfaced on Party.Room.env — see
// src/net/protocol.ts's planningMsFor comment for why NOT process.env).
const PLANNING_MS_TEST = 2000
const OUTER_TIMEOUT_MS = 5 * 60_000

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
  console.log(`OK: ${message}`)
}

function safeParse(raw: unknown): any {
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

// Board hexes a seat can field a unit onto (own half, rows 4-7). Cycled
// modulo length — a hex already occupied by a prior placement just swaps,
// which is harmless churn for this test's purposes.
const FIELD_HEXES = [
  { col: 3, row: 6 }, { col: 4, row: 6 }, { col: 2, row: 6 },
  { col: 5, row: 6 }, { col: 3, row: 5 }, { col: 4, row: 5 },
]

// Best-effort: buy the first affordable shop slot and field it onto an open
// board hex. Never throws on a rejection (no-gold/pool-empty/etc. are
// expected outcomes of an evolving shared economy, not bugs) — this exists
// only to make later rounds' recorded fights non-trivial (a real PvP fight
// between two empty boards would settle instantly with no frames).
async function buyAndField(
  sock: PartySocket, seatIdx: number, getLatest: () => any, hexCursor: { i: number },
): Promise<void> {
  const snap = getLatest()
  if (!snap) return
  const econ = snap.players[seatIdx]
  const slot = econ.shop.findIndex((s: string | null) => s !== null)
  if (slot === -1) return

  sock.send(JSON.stringify({ t: 'action', action: { t: 'buy', slot } }))
  // Match only a 'snapshot' that specifically proves THIS buy applied
  // (its shop slot cleared) — not just any 'snapshot', which could
  // otherwise false-positive-match an incidental broadcast from the
  // round's own natural transition (the same ambiguity class scenario 2's
  // branch-detection above had to work around) and silently swallow the
  // real response.
  const res = await nextMessage<any>(
    sock, m => m.t === 'rejected' || (m.t === 'snapshot' && m.snapshot.players[seatIdx].shop[slot] === null), 5000,
  ).catch(() => null)
  if (!res || res.t !== 'snapshot') return

  const bench = res.snapshot.players[seatIdx].bench
  const benchIdx = bench.findIndex((u: any) => u !== null)
  if (benchIdx === -1) return

  const hex = FIELD_HEXES[hexCursor.i % FIELD_HEXES.length]
  hexCursor.i++
  sock.send(JSON.stringify({ t: 'action', action: { t: 'moveBench', benchIndex: benchIdx, to: hex } }))
  await nextMessage<any>(
    sock,
    m => m.t === 'rejected' ||
      (m.t === 'snapshot' && m.snapshot.players[seatIdx].board.some((e: any) => e.hexPos.col === hex.col && e.hexPos.row === hex.row)),
    5000,
  ).catch(() => null)
}

async function main(): Promise<void> {
  await withRoom(async ({ host }) => {
    const roomId = `round-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    // Persistent trackers, attached immediately on connect so no message is
    // ever missed to a listener registered too late (the same race class
    // 03-03's SUMMARY documents for cross-connection broadcasts).
    let snapA: any = null
    let snapB: any = null
    const chunksA = new Map<string, FightChunk[]>()
    const chunksB = new Map<string, FightChunk[]>()

    function attach(sock: PartySocket, setSnap: (s: any) => void, chunkBucket: Map<string, FightChunk[]>): void {
      sock.addEventListener('message', event => {
        const m = safeParse(event.data)
        if (!m) return
        if (m.snapshot) setSnap(m.snapshot)
        if (m.t === 'fight-chunk') {
          const list = chunkBucket.get(m.chunk.fightId) ?? []
          list.push(m.chunk)
          chunkBucket.set(m.chunk.fightId, list)
        }
      })
    }

    const a = connect(host, roomId, 'Host')
    attach(a, s => { snapA = s }, chunksA)
    const b = connect(host, roomId, 'Friend')
    attach(b, s => { snapB = s }, chunksB)

    // ─── Scenario 1: shared deadline ───────────────────────────────────────
    const [firstPhaseA, welcomeA] = await Promise.all([
      nextMessage<any>(a, m => m.t === 'phase'),
      nextMessage<any>(a, m => m.t === 'welcome'),
    ])
    const [firstPhaseB, welcomeB] = await Promise.all([
      nextMessage<any>(b, m => m.t === 'phase'),
      nextMessage<any>(b, m => m.t === 'welcome'),
    ])
    assert(welcomeA.seat === 0, 'client A (Host) takes seat 0')
    assert(welcomeB.seat === 1, 'client B (Friend) takes seat 1')
    assert(firstPhaseA.phase === 'planning' && firstPhaseB.phase === 'planning', 'both clients observe phase: planning')
    assert(firstPhaseA.round === firstPhaseB.round, `both clients see the same round (${firstPhaseA.round})`)
    assert(firstPhaseA.deadline === firstPhaseB.deadline, 'both clients see the same absolute deadline')
    const driftA = Math.abs((firstPhaseA.deadline - firstPhaseA.serverNow) - PLANNING_MS_TEST)
    const driftB = Math.abs((firstPhaseB.deadline - firstPhaseB.serverNow) - PLANNING_MS_TEST)
    assert(driftA < 300 && driftB < 300, `deadline - serverNow is within tolerance of PLANNING_MS (${PLANNING_MS_TEST}ms); observed drift A=${driftA}ms B=${driftB}ms`)
    console.log('PASS: shared deadline')

    // ─── Scenario 2: deadline boundary ─────────────────────────────────────
    // Round 1 is a creep round with an empty board on both seats (no buys
    // yet) — recordCreepFight's empty-board branch makes seat 0's loss (and
    // therefore its round-2 income) fully deterministic, no combat RNG
    // involved, so the predicted gold below is a genuine computation, not a
    // guess.
    const msUntilDeadline = firstPhaseA.deadline - Date.now()
    const sendAt = Math.max(0, msUntilDeadline - 400)
    await new Promise(resolve => setTimeout(resolve, sendAt))

    const preGold = snapA.players[0].gold
    assert(preGold === 5, `seat 0 starts with the 5-gold stake before any reroll (got ${preGold})`)

    // Register the round-1 resolve wait for BOTH clients before the deadline
    // can fire, so neither resolve is missed to a listener attached late.
    const resolveBothRound1 = Promise.all([
      nextMessage<any>(a, m => m.t === 'resolve'),
      nextMessage<any>(b, m => m.t === 'resolve'),
    ])

    a.send(JSON.stringify({ t: 'action', action: { t: 'reroll' } }))
    const reroll1Res = await nextMessage<any>(a, m => m.t === 'snapshot' || m.t === 'rejected')
    assert(reroll1Res.t === 'snapshot', 'a legal action sent shortly before the deadline is accepted')
    const g1 = reroll1Res.snapshot.players[0].gold
    assert(g1 === preGold - REROLL_COST, `gold reflects exactly one reroll cost (${preGold} -> ${g1})`)

    const [ra1, rb1] = await resolveBothRound1
    assert(ra1.round === 1 && rb1.round === 1, 'round 1 resolves for both clients')
    assert(ra1.kind === 'creep', 'round 1 is a creep round')
    assert(ra1.snapshot.players[0].gold === g1, "settlement itself doesn't touch gold (human income is deferred to pendingIncome)")

    // Immediately race a second reroll against the room's own transition
    // into round 2's planning phase. A plain "wait for the next snapshot or
    // rejected" predicate is NOT reliable here: the round transition itself
    // broadcasts its own unrelated 'snapshot' (round 2's freshly rolled
    // shop) regardless of what happens to this message, and that broadcast
    // can arrive before this specific message's own response. Instead,
    // listen for an explicit 'rejected' addressed to this action within a
    // bounded window — unambiguous, since 'rejected' is only ever a direct
    // reply to the message that triggered it — and otherwise conclude
    // accepted from the persistent snapshot tracker's final state, which by
    // then reflects our mutation applied on top of (i.e. strictly after)
    // round 2's own natural transition broadcast.
    let sawRejected: any = null
    const rejectListener = (event: MessageEvent) => {
      const m = safeParse(event.data)
      if (m && m.t === 'rejected') sawRejected = m
    }
    a.addEventListener('message', rejectListener)
    a.send(JSON.stringify({ t: 'action', action: { t: 'reroll' } }))
    await new Promise(resolve => setTimeout(resolve, 700))
    a.removeEventListener('message', rejectListener)

    // Predicted round-2 income for seat 0, computed independently from the
    // same formula settleRound/startPlanning use — deterministic here
    // because the empty-board creep loss above has no RNG in it.
    const base = BASE_INCOME_BY_ROUND[0] ?? BASE_INCOME_CAP
    const interest = Math.min(MAX_INTEREST, Math.floor(g1 / 10))
    const predictedIncome = base + interest + streakBonus(1) /* first loss, streak magnitude 1 */ + 0 /* no win bonus */

    if (sawRejected) {
      assert(sawRejected.reason === 'wrong-phase', 'the second reroll landed during resolution and was rejected with wrong-phase')
      const expected = g1 + predictedIncome
      assert(
        snapA.players[0].gold === expected,
        `rejected branch: gold reflects income only, no second reroll deduction (expected ${expected}, got ${snapA.players[0].gold})`,
      )
      console.log('BRANCH: second action landed during resolution (rejected, wrong-phase)')
    } else {
      const expected = g1 + predictedIncome - REROLL_COST
      assert(
        snapA.players[0].gold === expected,
        `accepted branch: gold reflects income AND the second reroll's cost, never a half-applied value (expected ${expected}, got ${snapA.players[0].gold})`,
      )
      console.log('BRANCH: second action landed after the next planning phase opened (accepted)')
    }
    console.log('PASS: deadline boundary')

    // ─── Scenarios 3-5: drive rounds, force a 0-vs-1 pairing ──────────────
    let lastRound = 1
    let pairAnnouncedForNextRound = ra1.snapshot.players[0].nextOpponent === 1
    const hexCursorA = { i: 0 }
    const hexCursorB = { i: 0 }
    let targetResolveA: any = null
    let targetResolveB: any = null
    const MAX_ROUNDS = 20
    let attempts = 0

    for (; attempts < MAX_ROUNDS && !targetResolveA; attempts++) {
      const roundStart = Date.now()

      // Register BOTH this round's resolve-wait AND the phase-wait for
      // whatever round follows it, together, before either message can
      // possibly arrive. This matters because the server broadcasts
      // phase(round+1)+snapshot(round+1) from inside the SAME onDeadline()
      // continuation that produced this round's resolve — often only
      // milliseconds apart — so attaching the phase listener only AFTER
      // synchronously finishing this round's resolve-processing risks
      // attaching it after that message already dispatched and was missed
      // (the exact race scenario 2's own branch-detection above had to work
      // around at the round-1/round-2 boundary).
      const resolveBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'resolve', 15_000),
        nextMessage<any>(b, m => m.t === 'resolve', 15_000),
      ])
      // .catch(() => null): if this round turns out to be the target (we
      // `break` below without ever awaiting this promise), it must not
      // become an unhandled rejection once its 15s timeout elapses.
      const nextPhaseBoth = Promise.all([
        nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning', 15_000).catch(() => null),
        nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning', 15_000).catch(() => null),
      ])

      // Starting round 2 (round 1 was kept buy-free for scenario 2's clean
      // income math), buy+field opportunistically so a later PvP fight has
      // real units on both boards instead of settling instantly at 0 frames.
      await buyAndField(a, 0, () => snapA, hexCursorA)
      await buyAndField(b, 1, () => snapB, hexCursorB)

      const [ra, rb] = await resolveBoth
      assert(ra.round === rb.round && ra.round === lastRound + 1, `resolve.round increases by exactly 1 (${lastRound} -> ${ra.round})`)
      assert(ra.kind === rb.kind, `both clients see the same round kind (${ra.kind})`)
      assert(
        JSON.stringify(ra.snapshot.pool) === JSON.stringify(rb.snapshot.pool),
        `both clients' snapshots report the same pool after round ${ra.round}`,
      )
      assert(ra.snapshot.round === rb.snapshot.round, `both clients' snapshots report the same round after resolve (${ra.snapshot.round})`)
      lastRound = ra.round

      if (ra.kind === 'creep') {
        assert(ra.seat?.logIndex !== null, `creep round ${ra.round}: seat A's logIndex is non-null`)
        assert(rb.seat?.logIndex !== null, `creep round ${ra.round}: seat B's logIndex is non-null`)
      } else if (ra.kind === 'item') {
        assert(ra.fightId === null && rb.fightId === null, `item round ${ra.round}: both clients get fightId: null`)
        assert(!ra.seat || ra.seat.logIndex === null, `item round ${ra.round}: seat A's logIndex is null`)
        assert(!rb.seat || rb.seat.logIndex === null, `item round ${ra.round}: seat B's logIndex is null`)
      }
      console.log(`round ${ra.round} (${ra.kind}) resolved in ${Date.now() - roundStart}ms`)

      if (pairAnnouncedForNextRound && ra.kind === 'pvp') {
        assert(ra.seat?.opponentSeat === 1 && rb.seat?.opponentSeat === 0, `round ${ra.round}: the engine honoured its own 0-vs-1 announcement`)
        targetResolveA = ra
        targetResolveB = rb
        break
      }

      pairAnnouncedForNextRound = ra.snapshot.players[0].nextOpponent === 1

      if (ra.survivors.length <= 1) {
        throw new Error(`game ended (round ${ra.round}, ${ra.survivors.length} survivor(s)) before a 0-vs-1 pairing was ever announced`)
      }

      // Consume (and sanity-check) the next round's phase burst — already
      // safely captured above, registered before this round's resolve even
      // arrived.
      const [phaseA, phaseB] = await nextPhaseBoth
      assert(!!phaseA && !!phaseB, 'both clients received a phase message for the next round within 15s')
      assert(phaseA.round === ra.round + 1 && phaseB.round === ra.round + 1, `both clients see the next planning phase (round ${phaseA.round})`)
    }
    assert(!!targetResolveA, `a 0-vs-1 pairing was forced within ${MAX_ROUNDS} rounds (took ${attempts} rounds)`)
    console.log('PASS: rounds advance')
    console.log('PASS: creep and item rounds carry no PvP log')

    // ─── Scenario 5: the human-vs-human fight (COMBAT-01) ─────────────────
    const fightId = targetResolveA.fightId
    assert(!!fightId && fightId === targetResolveB.fightId, `both clients received the same non-null fightId (${fightId})`)

    const totalA = targetResolveA; const totalB = targetResolveB
    void totalA; void totalB

    // Wait for every chunk to land on both connections (fightId already
    // known, chunk collectors have been running since connect time).
    async function waitAllChunks(bucket: Map<string, FightChunk[]>, expectedTotal: number): Promise<FightChunk[]> {
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        const list = bucket.get(fightId)
        if (list && list.length >= expectedTotal) return list
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      throw new Error(`timed out waiting for all ${expectedTotal} chunks of fight ${fightId}`)
    }

    // The first chunk of either bucket tells us the expected total.
    const firstChunkDeadline = Date.now() + 10_000
    while (!chunksA.get(fightId) && Date.now() < firstChunkDeadline) await new Promise(r => setTimeout(r, 50))
    const expectedTotal = chunksA.get(fightId)?.[0]?.total ?? 1

    const chunksListA = await waitAllChunks(chunksA, expectedTotal)
    const chunksListB = await waitAllChunks(chunksB, expectedTotal)
    assert(chunksListA.length === expectedTotal && chunksListB.length === expectedTotal, `both clients received all ${expectedTotal} chunk(s)`)

    const sortedA = [...chunksListA].sort((x, y) => x.index - y.index)
    const sortedB = [...chunksListB].sort((x, y) => x.index - y.index)
    const bytesA = sortedA.map(c => c.gzipB64).join('|')
    const bytesB = sortedB.map(c => c.gzipB64).join('|')
    assert(bytesA === bytesB, 'reassembled gzipB64 bytes are byte-identical between the two clients')

    const decodedA = await decodeFightLog(sortedA)
    const decodedB = await decodeFightLog(sortedB)
    assert(JSON.stringify(decodedA) === JSON.stringify(decodedB), 'both clients decode to deep-equal FightLogs')

    assert(decodedA.frames.length > 100, `the decoded log has more than 100 frames (got ${decodedA.frames.length})`)
    let strictlyIncreasing = true
    for (let i = 1; i < decodedA.frames.length; i++) {
      if (decodedA.frames[i].tick <= decodedA.frames[i - 1].tick) { strictlyIncreasing = false; break }
    }
    assert(strictlyIncreasing, 'frame tick values are strictly increasing — the room forwarded the recorded order verbatim')

    const playbackState = createPlaybackState(decodedA)
    for (const frame of decodedA.frames) applyFrame(playbackState, frame)
    assert(playbackLength(decodedA) === decodedA.frames.length, 'playbackLength matches the decoded frame count')

    const winnerSide = playbackWinner(decodedA)
    const winningSeat = winnerSide === 'player' ? decodedA.seatA : winnerSide === 'enemy' ? decodedA.seatB : null

    for (const [label, resolveMsg] of [['A', targetResolveA], ['B', targetResolveB]] as const) {
      const seatResult = resolveMsg.seat
      if (winnerSide === 'draw') {
        assert(seatResult.draw === true, `${label}: draw settlement agrees with playback draw`)
      } else {
        const shouldHaveWon = seatResult.seat === winningSeat
        assert(seatResult.won === shouldHaveWon, `${label} (seat ${seatResult.seat}): won=${seatResult.won} agrees with playback winner (seat ${winningSeat})`)
        if (shouldHaveWon) {
          assert(seatResult.hpLost === 0, `${label}: the winning seat lost zero HP`)
        } else {
          assert(seatResult.hpLost > 0, `${label}: the losing seat lost HP > 0`)
        }
      }
    }
    console.log('PASS: the human-vs-human fight (COMBAT-01)')

    // ─── Scenario 6: nothing oversized was persisted ───────────────────────
    const statusRes = await fetch(`http://${host}/parties/main/${roomId}`)
    const status = await statusRes.json() as { storageKeys: string[] }
    assert(JSON.stringify(status.storageKeys) === JSON.stringify(['run']), `storageKeys is exactly ["run"] after the PvP resolve (got ${JSON.stringify(status.storageKeys)})`)
    console.log('PASS: nothing oversized was persisted')

    // ─── Scenario 7: zero-connection pause ─────────────────────────────────
    // Capture a clean, known round to assert against on reconnect: wait for
    // the natural continuation into the next planning phase first.
    const [postPvpPhaseA] = await Promise.all([
      nextMessage<any>(a, m => m.t === 'phase' && m.phase === 'planning', 10_000),
      nextMessage<any>(b, m => m.t === 'phase' && m.phase === 'planning', 10_000),
    ])
    const roundBeforeClose = postPvpPhaseA.round

    a.close()
    b.close()

    const pauseDeadline = Date.now() + 10_000
    let paused: any = null
    while (Date.now() < pauseDeadline) {
      const res = await fetch(`http://${host}/parties/main/${roomId}`)
      const body = await res.json() as any
      if (body.connections === 0 && body.timerScheduled === false && body.phase === 'idle') { paused = body; break }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    assert(!!paused, 'with zero connections the room stops its timer and returns to idle')
    assert(paused.timerScheduled === false, 'timerScheduled === false with nobody connected')
    assert(paused.phase === 'idle', "phase === 'idle' with nobody connected")

    const c = connect(host, roomId, 'Rejoiner')
    const freshPhase = await nextMessage<any>(c, m => m.t === 'phase' && m.phase === 'planning', 10_000)
    assert(freshPhase.round === roundBeforeClose, `reconnecting resumes at the same round, no regression (was ${roundBeforeClose}, now ${freshPhase.round})`)
    assert(freshPhase.deadline !== null, 'a fresh deadline is scheduled on reconnect')
    console.log('PASS: zero-connection pause')

    c.close()
  }, { PLANNING_MS: String(PLANNING_MS_TEST) })
}

const timeout = new Promise((_resolve, reject) => {
  setTimeout(() => reject(new Error(`roomRound: exceeded outer timeout of ${OUTER_TIMEOUT_MS}ms`)), OUTER_TIMEOUT_MS)
})

Promise.race([main(), timeout])
  .then(() => {
    console.log('roomRound: all assertions passed')
    process.exit(0)
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
