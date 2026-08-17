// Lossless, bounded-chunk wire codec for a recorded FightLog. A real mid-game
// fight serializes to 19-21 MiB of JSON — roughly 20x over the WebSocket
// message limit and 150x over the Durable Object per-value storage limit
// (128 KiB). This module slices `log.frames` into fixed-size runs, gzips and
// base64s each run, and reassembles them back into the exact original log.
//
// Two properties hold and must never regress:
//   1. LOSSLESS — no frame decimation, no coordinate rounding, no field
//      trimming. A decoded log is indistinguishable from the recorded one.
//   2. RECORDED-ONLY — this carries frames the server already simulated;
//      it never carries a replay seed or anything a client could
//      re-simulate combat from. This project deliberately cut client-side
//      deterministic seed-replay in favor of streaming the recorded log
//      (see REQUIREMENTS.md COMBAT-01/COMBAT-02 and PROJECT.md "Out of
//      Scope").
//
// Runtime-agnostic by construction: only CompressionStream/
// DecompressionStream, TextEncoder/TextDecoder, and btoa/atob are used —
// all present as globals in Node, the Workers runtime, and every target
// browser. No transport library import, no DOM global.

import type { FightFrame, FightLog } from '../game/round'

// ─── Chunking ────────────────────────────────────────────────────────────────

// A 300-frame slice of a real ~2000-frame fight gzips to about 50 KiB
// (measured during planning against a real round-8 six-seat run). Even a
// worst-case 3600-frame fight (the engine's hard overtime cap) with a larger
// board stays two orders of magnitude below the 1 MiB WebSocket message
// limit at this chunk size, with no size cliff as fights get longer.
export const FRAMES_PER_CHUNK = 300

// FightLog minus its frames, expressed via Omit so this type can never drift
// from the engine's FightLog — no field is restated here.
export type FightLogMeta = Omit<FightLog, 'frames'>

export interface FightChunk {
  fightId: string
  index: number        // 0-based
  total: number         // total chunk count for this fightId
  meta: FightLogMeta | null   // present on index 0 only
  frameCount: number    // frames encoded in THIS chunk
  gzipB64: string        // base64 of gzip(JSON.stringify(FightFrame[]))
}

// ─── Non-finite number sentinel ──────────────────────────────────────────────

// JSON has no representation for Infinity/-Infinity/NaN — JSON.stringify
// silently turns all three into `null`, which is not lossless. A real field
// hits this: AttackModifier.remainingCharges (src/core/types.ts) uses
// Infinity to mean "unlimited charges" for some ability modifiers, and a
// real recorded fight can carry one into a frame. Found via
// fightWire.test.ts's round-trip fidelity test against a real fight — this
// is not a hypothetical edge case, it fires on ordinary combat.
const NON_FINITE_SENTINEL = '__fightWire_non_finite__'

function nonFiniteReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return `${NON_FINITE_SENTINEL}${value}`   // "…Infinity", "…-Infinity", "…NaN"
  }
  return value
}

function nonFiniteReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith(NON_FINITE_SENTINEL)) {
    const tag = value.slice(NON_FINITE_SENTINEL.length)
    if (tag === 'Infinity') return Infinity
    if (tag === '-Infinity') return -Infinity
    if (tag === 'NaN') return NaN
  }
  return value
}

// ─── Base64 <-> gzip helpers ─────────────────────────────────────────────────

// Chunk size for String.fromCharCode conversion. Do NOT call
// String.fromCharCode(...bytes) on a whole gzip buffer at once — a ~50 KiB
// chunk is 50,000 spread arguments, which blows the call stack. Converting
// in slices of 0x8000 bytes and appending to a string keeps every call small
// regardless of payload size. Do not "simplify" this back into a single
// spread call.
const BASE64_CHUNK_SIZE = 0x8000

async function gzipToBase64(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  void writer.write(bytes)
  void writer.close()
  const gzipped = new Uint8Array(await new Response(cs.readable).arrayBuffer())

  let binary = ''
  for (let i = 0; i < gzipped.length; i += BASE64_CHUNK_SIZE) {
    const slice = gzipped.subarray(i, i + BASE64_CHUNK_SIZE)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

async function base64ToText(b64: string): Promise<string> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  void writer.write(bytes)
  void writer.close()
  const gunzipped = await new Response(ds.readable).arrayBuffer()
  return new TextDecoder().decode(gunzipped)
}

// A lossless structural clone of a FightLog — a plain
// `JSON.parse(JSON.stringify(log))` is NOT lossless (see the non-finite
// sentinel above), so any caller needing a "before" snapshot to compare
// against post-encode (e.g. a mutation-safety test) must go through this,
// not a bare JSON round-trip.
export function cloneFightLog(log: FightLog): FightLog {
  return JSON.parse(JSON.stringify(log, nonFiniteReplacer), nonFiniteReviver)
}

// ─── Encode ──────────────────────────────────────────────────────────────────

// Pure: never mutates `log`. Slices log.frames into FRAMES_PER_CHUNK runs,
// gzips each slice's JSON, and attaches the non-frame metadata to index 0
// only. A log with zero frames (the empty-board forfeit branch of
// recordFight) still produces exactly one chunk — an empty frame array is
// encoded for it rather than special-casing the payload away, so the
// metadata always has a carrier.
export async function encodeFightLog(log: FightLog, fightId: string): Promise<FightChunk[]> {
  const { frames, ...meta } = log
  const total = Math.max(1, Math.ceil(frames.length / FRAMES_PER_CHUNK))

  const chunks: FightChunk[] = []
  for (let index = 0; index < total; index++) {
    const slice: FightFrame[] = frames.slice(index * FRAMES_PER_CHUNK, (index + 1) * FRAMES_PER_CHUNK)
    const gzipB64 = await gzipToBase64(JSON.stringify(slice, nonFiniteReplacer))
    chunks.push({
      fightId,
      index,
      total,
      meta: index === 0 ? meta : null,
      frameCount: slice.length,
      gzipB64,
    })
  }
  return chunks
}

// ─── Decode ──────────────────────────────────────────────────────────────────

// Sorts by index, verifies the set is complete, then gunzips and
// concatenates the frame arrays in index order and reattaches meta. A
// partial reassembly is never returned — a short fight that looks plausible
// is worse than a loud failure, so an incomplete or malformed chunk set
// throws a descriptive Error naming the missing indices.
export async function decodeFightLog(chunks: FightChunk[]): Promise<FightLog> {
  if (chunks.length === 0) throw new Error('decodeFightLog: no chunks provided')

  const total = chunks[0].total
  const sorted = [...chunks].sort((a, b) => a.index - b.index)

  const seen = new Set<number>()
  for (const chunk of sorted) {
    if (chunk.total !== total) {
      throw new Error(`decodeFightLog: inconsistent total across chunks (expected ${total}, got ${chunk.total} at index ${chunk.index})`)
    }
    seen.add(chunk.index)
  }

  const missing: number[] = []
  for (let i = 0; i < total; i++) if (!seen.has(i)) missing.push(i)
  if (missing.length > 0) {
    throw new Error(`decodeFightLog: missing chunk index(es): ${missing.join(', ')}`)
  }
  if (seen.size !== total) {
    throw new Error(`decodeFightLog: duplicate chunk indices detected (expected ${total} unique indices, got ${seen.size})`)
  }

  const metaChunk = sorted.find(c => c.index === 0)!
  if (!metaChunk.meta) {
    throw new Error('decodeFightLog: index 0 chunk is missing its meta payload')
  }
  const meta = metaChunk.meta

  const frames: FightFrame[] = []
  for (const chunk of sorted) {
    const json = await base64ToText(chunk.gzipB64)
    const slice: FightFrame[] = JSON.parse(json, nonFiniteReviver)
    frames.push(...slice)
  }

  return { ...meta, frames }
}
