// Client-side reassembly of the room's `fight-chunk` stream into the
// index-sorted array decodeFightLog expects.
//
// Ordering across connections is UNSPECIFIED — party/lobby.ts's
// broadcastResolve sends a fight's chunks per connection in index order, but
// only per-connection delivery is FIFO. Two fights can therefore interleave,
// a chunk can arrive before the `resolve` that announced its fightId, and a
// reconnect can redeliver one. So completeness is decided by HOLDING `total`
// DISTINCT INDICES — never by counting arrivals, never by adjacency to the
// resolve message. Buckets are keyed by fightId and stored index -> chunk, so
// a duplicate is idempotent by construction rather than by a scan.
//
// The caps and the per-chunk validation below exist because a chunk stream is
// attacker-reachable in principle, even though this project's threat model has
// the client talking to its own deployment: an unbounded sequence of chunks
// with novel fightIds, or one chunk claiming a billion-chunk total, would
// otherwise grow client memory without limit before decode ever runs.
//
// Pure and DOM-free: no globals, no transport import, only the FightChunk type.

import type { FightChunk } from './fightWire'

// ─── Bounds ──────────────────────────────────────────────────────────────────

// A client is ever shown one fight at a time; the one spare covers a resolve
// landing while the previous fight is still playing back.
export const MAX_TRACKED_FIGHTS = 2

// Far above any real fight: FRAMES_PER_CHUNK is 300, so this admits a
// 150,000-frame log while the engine hard-draws at 3600 ticks (12 chunks).
// Its job is bounding a hostile stream, not fitting a real one.
export const MAX_CHUNKS_PER_FIGHT = 512

// ─── Buffer shape ────────────────────────────────────────────────────────────

interface FightBucket {
  total: number                      // established by the first accepted chunk
  chunks: Map<number, FightChunk>    // index -> chunk; duplicates collapse here
  sequence: number                   // insertion order, for the eviction rule
}

export interface FightBuffer {
  fights: Map<string, FightBucket>
  nextSequence: number
}

export function createFightBuffer(): FightBuffer {
  return { fights: new Map(), nextSequence: 0 }
}

// ─── Validation ──────────────────────────────────────────────────────────────

// A chunk that fails any of these never creates a bucket and never grows one.
function isPlausible(chunk: FightChunk): boolean {
  if (!Number.isInteger(chunk.total)) return false
  if (chunk.total < 1 || chunk.total > MAX_CHUNKS_PER_FIGHT) return false
  if (!Number.isInteger(chunk.index)) return false
  if (chunk.index < 0 || chunk.index >= chunk.total) return false
  return true
}

// Drops the bucket that has been in flight longest. Called only when a NEW
// fightId would push the tracked count past MAX_TRACKED_FIGHTS — the oldest
// incomplete fight is the one a client is least likely to still be waiting on.
function evictOldest(buf: FightBuffer): void {
  let oldestId: string | null = null
  let oldestSequence = Infinity
  for (const [fightId, bucket] of buf.fights) {
    if (bucket.sequence < oldestSequence) {
      oldestSequence = bucket.sequence
      oldestId = fightId
    }
  }
  if (oldestId !== null) buf.fights.delete(oldestId)
}

// ─── Accept ──────────────────────────────────────────────────────────────────

// Returns the fightId when THIS chunk completed the fight, null otherwise —
// including for every rejected chunk. Completion fires exactly once per fight,
// on the arrival that brings the bucket to `total` distinct indices.
export function acceptChunk(buf: FightBuffer, chunk: FightChunk): string | null {
  if (!isPlausible(chunk)) return null

  let bucket = buf.fights.get(chunk.fightId)
  if (!bucket) {
    if (buf.fights.size >= MAX_TRACKED_FIGHTS) evictOldest(buf)
    bucket = { total: chunk.total, chunks: new Map(), sequence: buf.nextSequence++ }
    buf.fights.set(chunk.fightId, bucket)
  } else if (bucket.total !== chunk.total) {
    // The first accepted chunk establishes the total. A later chunk claiming
    // a different one would otherwise "complete" the fight early and hand
    // decodeFightLog a silently truncated log.
    return null
  }

  bucket.chunks.set(chunk.index, chunk)
  return bucket.chunks.size === bucket.total ? chunk.fightId : null
}

// ─── Take / drop ─────────────────────────────────────────────────────────────

// Returns the complete chunk set sorted ascending by index and removes the
// bucket, so the same fight can never be taken twice. Returns null for an
// unknown or still-incomplete fightId — a partial reassembly is never handed
// out, matching decodeFightLog's own refusal to decode one.
export function takeFight(buf: FightBuffer, fightId: string): FightChunk[] | null {
  const bucket = buf.fights.get(fightId)
  if (!bucket) return null
  if (bucket.chunks.size !== bucket.total) return null

  buf.fights.delete(fightId)
  return [...bucket.chunks.values()].sort((a, b) => a.index - b.index)
}

// Discards an in-flight fight — used when a resolve supersedes one the client
// never finished receiving. A no-op for an unknown id.
export function dropFight(buf: FightBuffer, fightId: string): void {
  buf.fights.delete(fightId)
}
