import { describe, it, expect } from 'vitest'
import type { FightChunk } from './fightWire'
import {
  createFightBuffer, acceptChunk, takeFight, dropFight,
  MAX_TRACKED_FIGHTS, MAX_CHUNKS_PER_FIGHT,
} from './fightBuffer'

// A local chunk factory rather than a real encodeFightLog round trip: this
// module's contract is about indices and identity, never payload bytes, and
// src/net/fightWire.test.ts already covers the codec itself.
function chunk(fightId: string, index: number, total: number): FightChunk {
  return {
    fightId,
    index,
    total,
    meta: null,
    frameCount: 1,
    gzipB64: `${fightId}:${index}`,
  }
}

describe('fightBuffer — reassembly', () => {
  it('a lone total:1 chunk completes immediately and takes as a one-element array', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 0, 1))).toBe('f1')
    const taken = takeFight(buf, 'f1')
    expect(taken).toHaveLength(1)
    expect(taken![0].index).toBe(0)
  })

  it('chunks delivered in reverse index order complete and take back sorted ascending', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 2, 3))).toBeNull()
    expect(acceptChunk(buf, chunk('f1', 1, 3))).toBeNull()
    expect(acceptChunk(buf, chunk('f1', 0, 3))).toBe('f1')

    const taken = takeFight(buf, 'f1')!
    expect(taken.map(c => c.index)).toEqual([0, 1, 2])
  })

  it('a duplicate chunk does not double-count toward completeness and appears once', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 0, 2))).toBeNull()
    // The same index again — completeness must NOT be decided by counting
    // arrivals, so this must not complete a two-chunk fight.
    expect(acceptChunk(buf, chunk('f1', 0, 2))).toBeNull()
    expect(takeFight(buf, 'f1')).toBeNull()

    expect(acceptChunk(buf, chunk('f1', 1, 2))).toBe('f1')
    const taken = takeFight(buf, 'f1')!
    expect(taken.map(c => c.index)).toEqual([0, 1])
  })

  it('two fights interleaved chunk-by-chunk complete independently without contaminating each other', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('a', 0, 2))).toBeNull()
    expect(acceptChunk(buf, chunk('b', 1, 2))).toBeNull()
    expect(acceptChunk(buf, chunk('a', 1, 2))).toBe('a')
    expect(acceptChunk(buf, chunk('b', 0, 2))).toBe('b')

    const takenA = takeFight(buf, 'a')!
    const takenB = takeFight(buf, 'b')!
    expect(takenA.map(c => c.gzipB64)).toEqual(['a:0', 'a:1'])
    expect(takenB.map(c => c.gzipB64)).toEqual(['b:0', 'b:1'])
  })
})

describe('fightBuffer — validation', () => {
  it('rejects a negative index without creating a bucket', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', -1, 2))).toBeNull()
    expect(takeFight(buf, 'f1')).toBeNull()
    // The bucket must not exist at all — a later valid total:1 chunk under
    // the same id must still complete on its own terms.
    expect(acceptChunk(buf, chunk('f1', 0, 1))).toBe('f1')
  })

  it('rejects an index >= total without growing a bucket', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 0, 2))).toBeNull()
    expect(acceptChunk(buf, chunk('f1', 2, 2))).toBeNull()
    // Out-of-range index must not have been stored: index 1 is still missing.
    expect(takeFight(buf, 'f1')).toBeNull()
    expect(acceptChunk(buf, chunk('f1', 1, 2))).toBe('f1')
  })

  it('rejects a total below 1 or above MAX_CHUNKS_PER_FIGHT', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 0, 0))).toBeNull()
    expect(acceptChunk(buf, chunk('f2', 0, -3))).toBeNull()
    expect(acceptChunk(buf, chunk('f3', 0, MAX_CHUNKS_PER_FIGHT + 1))).toBeNull()
    expect(acceptChunk(buf, chunk('f4', 0, Number.MAX_SAFE_INTEGER))).toBeNull()
    for (const id of ['f1', 'f2', 'f3', 'f4']) expect(takeFight(buf, id)).toBeNull()
  })

  it('rejects a non-integer index or total', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 0.5, 2))).toBeNull()
    expect(acceptChunk(buf, chunk('f2', 0, 2.5))).toBeNull()
    expect(acceptChunk(buf, chunk('f3', NaN, 2))).toBeNull()
    for (const id of ['f1', 'f2', 'f3']) expect(takeFight(buf, id)).toBeNull()
  })

  it('rejects a chunk whose total disagrees with the value its bucket already established', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 0, 3))).toBeNull()
    // A chunk claiming a smaller total would otherwise "complete" the fight
    // early and hand decodeFightLog a truncated log.
    expect(acceptChunk(buf, chunk('f1', 1, 2))).toBeNull()
    expect(acceptChunk(buf, chunk('f1', 1, 5))).toBeNull()
    expect(takeFight(buf, 'f1')).toBeNull()

    // The established total still governs: 3 distinct indices complete it.
    expect(acceptChunk(buf, chunk('f1', 1, 3))).toBeNull()
    expect(acceptChunk(buf, chunk('f1', 2, 3))).toBe('f1')
    expect(takeFight(buf, 'f1')!.map(c => c.index)).toEqual([0, 1, 2])
  })
})

describe('fightBuffer — bounding', () => {
  it('evicts the oldest incomplete fight rather than tracking more than MAX_TRACKED_FIGHTS', () => {
    const buf = createFightBuffer()
    // Fill every tracked slot with an incomplete fight, oldest first.
    for (let i = 0; i < MAX_TRACKED_FIGHTS; i++) {
      expect(acceptChunk(buf, chunk(`old-${i}`, 0, 2))).toBeNull()
    }
    // One more distinct fight arrives — the oldest bucket must go.
    expect(acceptChunk(buf, chunk('fresh', 0, 2))).toBeNull()

    // The evicted (oldest) fight no longer has its chunk: completing it needs
    // both indices again, so index 1 alone must not complete it.
    expect(acceptChunk(buf, chunk('old-0', 1, 2))).toBeNull()

    // Every survivor still holds its own chunk and completes with one more.
    expect(acceptChunk(buf, chunk('fresh', 1, 2))).toBe('fresh')
    expect(takeFight(buf, 'fresh')!.map(c => c.index)).toEqual([0, 1])
  })

  it('tracking never exceeds MAX_TRACKED_FIGHTS buckets under a flood of distinct fight ids', () => {
    const buf = createFightBuffer()
    for (let i = 0; i < 500; i++) {
      acceptChunk(buf, chunk(`flood-${i}`, 0, 2))
      expect(buf.fights.size).toBeLessThanOrEqual(MAX_TRACKED_FIGHTS)
    }
    expect(buf.fights.size).toBe(MAX_TRACKED_FIGHTS)
  })

  it('a rejected chunk never creates a bucket, so a malformed flood grows nothing at all', () => {
    const buf = createFightBuffer()
    for (let i = 0; i < 500; i++) acceptChunk(buf, chunk(`bad-${i}`, -1, 2))
    expect(buf.fights.size).toBe(0)
  })
})

describe('fightBuffer — taking and dropping', () => {
  it('takeFight removes the bucket, so the same fight cannot be taken twice', () => {
    const buf = createFightBuffer()
    expect(acceptChunk(buf, chunk('f1', 0, 1))).toBe('f1')
    expect(takeFight(buf, 'f1')).toHaveLength(1)
    expect(takeFight(buf, 'f1')).toBeNull()
  })

  it('takeFight returns null for an unknown or incomplete fightId', () => {
    const buf = createFightBuffer()
    expect(takeFight(buf, 'never-seen')).toBeNull()
    acceptChunk(buf, chunk('f1', 0, 2))
    expect(takeFight(buf, 'f1')).toBeNull()
  })

  it('dropFight discards an in-flight fight and is a no-op on an unknown id', () => {
    const buf = createFightBuffer()
    acceptChunk(buf, chunk('f1', 0, 2))
    dropFight(buf, 'f1')
    // The dropped chunk is gone: index 1 alone must not complete the fight.
    expect(acceptChunk(buf, chunk('f1', 1, 2))).toBeNull()
    expect(() => dropFight(buf, 'never-seen')).not.toThrow()
  })
})
