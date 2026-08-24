// Minimal, crash-safe per-room storage for the Node production host
// (party/nodeHost.ts). Implements only the three Storage operations
// party/lobby.ts calls — get, put, list — confirmed by direct read of that
// file. Deliberately NOT a general DurableObjectStorage polyfill: Lobby never
// calls delete, transactions, or alarms, so none of that is implemented here.

import { randomUUID } from 'node:crypto'
import { open, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// Independent of the client-side lobby-code alphabet (src/net/lobbyUrl.ts) —
// that check lives in the browser and a raw socket can bypass it entirely.
// This is the server-side floor: whatever a room id is, it must be safe to
// become a file name with zero interpretation, before it ever reaches disk.
//
// Capped at 64 chars, not 128: a real lobby code is 6 chars
// (src/net/lobbyUrl.ts's LOBBY_CODE_LENGTH), and this project's own test
// harnesses use longer synthetic ids like `smoke-<timestamp>-<rand>`
// (~25 chars) — 64 leaves generous headroom for both without inviting an
// attacker to hand a room id long enough to matter for disk usage.
export const SAFE_ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/

export class FileRoomStorage {
  private readonly filePath: string
  private cache: Record<string, unknown> | null = null

  // Serializes every write to this room's file. party/lobby.ts's onClose can
  // fire for several connections in near-simultaneous succession (e.g. four
  // sockets closing together), and each one calls persist() independently
  // with no await between them at the call site — so without this queue, two
  // persist() calls for the SAME room can interleave their writeFile/rename
  // pairs arbitrarily, which surfaced as a real ENOENT crash: one call's temp
  // file got renamed away by another call before its own rename ran.
  // Chaining every write onto this promise forces them to run one at a time,
  // in call order — matching the concurrency model of a real Durable Object,
  // which also processes one request at a time per room.
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(private readonly roomId: string, private readonly dataDir: string) {
    if (!SAFE_ROOM_ID.test(roomId)) throw new Error(`unsafe room id: ${roomId}`)
    this.filePath = join(dataDir, `${roomId}.json`)
  }

  private async load(): Promise<Record<string, unknown>> {
    if (this.cache) return this.cache
    try {
      this.cache = JSON.parse(await readFile(this.filePath, 'utf8')) as Record<string, unknown>
    } catch (err) {
      // A missing file means "this room has never persisted anything" —
      // starting from {} is correct. Any OTHER error (permission denied,
      // disk I/O failure, a corrupt/truncated read) must NOT be treated the
      // same way: silently starting from {} here would then get WRITTEN back
      // on the next put(), permanently destroying whatever was on disk. Only
      // ENOENT is a legitimate "fresh room."
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`FileRoomStorage: refusing to treat unreadable ${this.filePath} as empty`, { cause: err })
      }
      this.cache = {}
    }
    return this.cache
  }

  async get<T>(key: string): Promise<T | undefined> {
    const data = await this.load()
    return data[key] as T | undefined
  }

  async put<T>(key: string, value: T): Promise<void> {
    const data = await this.load()
    data[key] = value
    await this.enqueueWrite(data)
  }

  async list(): Promise<Map<string, unknown>> {
    return new Map(Object.entries(await this.load()))
  }

  // Lets the host process wait for this room's in-flight write (if any)
  // before exiting, so a `systemctl restart` or SIGTERM can't truncate a
  // persist() that's already in progress. Safe to call with nothing pending
  // — resolves immediately in that case.
  drain(): Promise<void> {
    return this.writeQueue
  }

  // Queues onto writeQueue rather than writing directly, and returns the
  // queued write's own promise (not the queue tail) so THIS call's caller
  // still awaits exactly its own write completing — while the queue itself
  // is what actually orders it behind any writes already pending.
  private enqueueWrite(data: Record<string, unknown>): Promise<void> {
    const thisWrite = this.writeQueue.then(() => this.writeToDisk(data))
    // Swallowed on the queue chain only, so one failed write doesn't
    // permanently wedge every write after it — the error still propagates to
    // the caller of THIS put() via `thisWrite` itself, unswallowed below.
    // Logged here too: a swallowed rejection with no log line is invisible
    // to whoever operates this process, even though party/lobby.ts's caller
    // still sees (and, today, crashes on) the same error — see
    // party/nodeHost.ts's dispatch wrapping for why that no longer crashes
    // the whole server.
    this.writeQueue = thisWrite.catch(err => {
      console.error(`[nodeStorage] write failed for room ${this.roomId}:`, err)
    })
    return thisWrite
  }

  // Temp-file-then-rename rather than a direct write: rename(2) is atomic on
  // POSIX filesystems, so a crash mid-write can never leave a half-written,
  // corrupt run.json behind — the room either sees the old state or the new
  // state on its next onStart, never a torn one. The temp name includes a
  // random UUID (not just pid+timestamp) so two writes landing in the same
  // millisecond can never collide on the same temp path.
  //
  // fsync's on both the temp file and the containing directory: without
  // them, "atomic" only holds if the process outlives the write — a power
  // loss (or a hard container kill) between writeFile and the OS actually
  // flushing it to disk can still leave the rename pointing at data that
  // never made it past the page cache. This is the one case a rename alone
  // does not cover.
  private async writeToDisk(data: Record<string, unknown>): Promise<void> {
    await mkdir(this.dataDir, { recursive: true })
    const tmp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`
    const fh = await open(tmp, 'w')
    try {
      await fh.writeFile(JSON.stringify(data), 'utf8')
      await fh.sync()
    } finally {
      await fh.close()
    }
    await rename(tmp, this.filePath)
    const dirHandle = await open(dirname(this.filePath), 'r')
    try {
      await dirHandle.sync()
    } finally {
      await dirHandle.close()
    }
    // No `this.cache = data` here: `data` already IS `this.cache` — put()
    // mutates the cached object in place before ever calling this — so
    // reassigning it back to itself was a no-op that read like a defensive
    // copy which didn't actually exist.
  }
}

// Removes any `*.json.<pid>.<uuid>.tmp` file left behind by a process that
// died between writeFile and rename (e.g. WR-05's shutdown-truncation case,
// or a hard kill) — otherwise these accumulate forever, since nothing else
// ever names or cleans them up. Safe to call on every boot: a live write's
// tmp file is only ever open for the few milliseconds between creation and
// rename, so any tmp file found at startup is necessarily orphaned.
export async function sweepStaleTempFiles(dataDir: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dataDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
    throw err
  }
  for (const name of entries) {
    if (!name.endsWith('.tmp')) continue
    await rm(join(dataDir, name), { force: true })
  }
}
