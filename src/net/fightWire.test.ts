import { describe, it, expect, beforeAll } from 'vitest'
import { newRun } from '../econ/runState'
import { botSeats, botPlanRound, PERSONAS } from '../econ/bots'
import { recordFight } from '../game/round'
import type { FightLog } from '../game/round'
import { createPlaybackState, applyFrame, playbackWinner } from '../game/playback'
import { encodeFightLog, decodeFightLog, FRAMES_PER_CHUNK } from './fightWire'
import '../core/systems/ability'   // register abilities for the headless sim

function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// Builds a real, multi-thousand-frame recorded fight the way planning
// measured it: 8 rounds of bot planning (with extra gold each round so
// boards actually build up and level) on a full six-seat run, then records
// seat 0 vs seat 1's fight at stage 4. Driven from seededRng so the fixture
// is reproducible.
function buildRealFight(): FightLog {
  const run = newRun(botSeats())
  const rng = seededRng(20260817)

  // Temporarily give seat 0 (normally the human) a persona so botPlanRound
  // builds it a real board too — the same idiom round.test.ts uses to
  // simulate an all-bot lobby.
  run.players[0].personaId = PERSONAS[0].id

  for (let r = 1; r <= 8; r++) {
    run.round = r
    for (const econ of run.players) {
      econ.gold += 50
      botPlanRound(run, econ, 0, rng)
    }
  }

  return recordFight(run, 0, 1, 4)
}

// Built once and shared across every test below: recording a fight takes
// about 100ms, but serializing/round-tripping ~20 MiB of it repeatedly is
// what would make this suite slow if rebuilt per test.
let realLog: FightLog

beforeAll(() => {
  realLog = buildRealFight()
  // If a future engine change makes fights trivially short, this suite must
  // fail loudly rather than silently stop proving anything.
  expect(realLog.frames.length).toBeGreaterThanOrEqual(500)
})

describe('fightWire — round trip fidelity', () => {
  it('Test 1: decodeFightLog(encodeFightLog(log)) reproduces the original exactly', async () => {
    const chunks = await encodeFightLog(realLog, 'fight-fidelity')
    const decoded = await decodeFightLog(chunks)

    // Cheap discriminators FIRST — toEqual on a ~20 MiB structure is slow and
    // produces an unreadable diff on failure, so a real problem should show
    // up here before the giant diff ever prints.
    expect(decoded.frames.length).toBe(realLog.frames.length)
    expect(decoded.winner).toBe(realLog.winner)
    expect(decoded.ticksElapsed).toBe(realLog.ticksElapsed)
    expect(decoded.frames[0].tick).toBe(realLog.frames[0].tick)
    expect(decoded.frames[decoded.frames.length - 1].tick)
      .toBe(realLog.frames[realLog.frames.length - 1].tick)

    // Strict tick order/identity, not just a matching length — a length-only
    // pass could mask reordering.
    expect(decoded.frames.map(f => f.tick)).toEqual(realLog.frames.map(f => f.tick))

    // Direct comparison against the original, not a JSON.stringify/parse
    // proxy — round.ts's UnitFrame.attackModifiers is now genuinely
    // plain-data-only (AttackModifierFrame = Omit<AttackModifier, 'onHit'>,
    // stripped at capture time), so nothing non-serializable ever enters a
    // frame in the first place. A prior version of this test (and this
    // fixture) caught the opposite: onHit slipping through a shallow spread,
    // discovered by this exact test — fixed in round.ts, not worked around
    // here. See the plan SUMMARY for the finding.
    expect(decoded).toEqual(realLog)
  })

  it('Test 2: encodeFightLog does not mutate its argument', async () => {
    const before: FightLog = JSON.parse(JSON.stringify(realLog))
    await encodeFightLog(realLog, 'fight-purity')
    expect(realLog).toEqual(before)
  })

  it('Test 3: every chunk stays under 256 KiB and the chunk count matches the frame math', async () => {
    const chunks = await encodeFightLog(realLog, 'fight-bound')
    for (const chunk of chunks) {
      expect(chunk.gzipB64.length).toBeLessThan(262144)
    }
    expect(chunks.length).toBe(Math.max(1, Math.ceil(realLog.frames.length / FRAMES_PER_CHUNK)))
  })

  it('Test 4: meta is present only on chunk index 0, and every decoded non-frame field matches', async () => {
    const chunks = await encodeFightLog(realLog, 'fight-meta')
    expect(chunks[0].meta).not.toBeNull()
    for (let i = 1; i < chunks.length; i++) expect(chunks[i].meta).toBeNull()

    const decoded = await decodeFightLog(chunks)
    const { frames: _decodedFrames, ...decodedMeta } = decoded
    const { frames: _originalFrames, ...originalMeta } = realLog
    expect(decodedMeta).toEqual(originalMeta)
  })

  it('Test 5: a frames: [] log (empty-board forfeit) encodes to exactly 1 chunk and decodes identically', async () => {
    const run = newRun(botSeats())
    run.players[0].board = []
    run.players[1].board = [{ definitionId: 'tangela', tier: 2, hexPos: { col: 0, row: 4 } }]
    const emptyLog = recordFight(run, 0, 1, 1)
    expect(emptyLog.frames).toEqual([])

    const chunks = await encodeFightLog(emptyLog, 'fight-empty')
    expect(chunks.length).toBe(1)
    expect(chunks[0].meta).not.toBeNull()
    expect(chunks[0].frameCount).toBe(0)

    const decoded = await decodeFightLog(chunks)
    expect(decoded.frames).toEqual([])
    expect(decoded).toEqual(emptyLog)
  })

  it('Test 6: chunks handed to decodeFightLog out of order reassemble identically to in-order', async () => {
    const chunks = await encodeFightLog(realLog, 'fight-shuffle')
    // Reverse, then swap the new first/last for good measure — a plain
    // reverse of a short chunk list can still look "mostly ordered".
    const shuffled = [...chunks].reverse()
    if (shuffled.length > 2) {
      const tmp = shuffled[0]
      shuffled[0] = shuffled[shuffled.length - 1]
      shuffled[shuffled.length - 1] = tmp
    }

    const decodedInOrder = await decodeFightLog(chunks)
    const decodedShuffled = await decodeFightLog(shuffled)
    expect(decodedShuffled).toEqual(decodedInOrder)
  })

  it('Test 7: a dropped middle chunk makes decodeFightLog reject, naming the missing index', async () => {
    const chunks = await encodeFightLog(realLog, 'fight-partial')
    expect(chunks.length).toBeGreaterThan(2)   // need a real "middle" chunk to drop
    const droppedIndex = Math.floor(chunks.length / 2)
    const partial = chunks.filter(c => c.index !== droppedIndex)

    await expect(decodeFightLog(partial)).rejects.toThrow(new RegExp(String(droppedIndex)))
  })

  it('Test 8: the decoded log drives playback.ts unchanged, with matching winner', async () => {
    const chunks = await encodeFightLog(realLog, 'fight-playback')
    const decoded = await decodeFightLog(chunks)

    const state = createPlaybackState(decoded)
    expect(() => {
      for (const frame of decoded.frames) applyFrame(state, frame)
    }).not.toThrow()

    expect(playbackWinner(decoded)).toBe(playbackWinner(realLog))
  })
})
