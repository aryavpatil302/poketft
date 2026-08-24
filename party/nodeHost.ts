// Production Node.js host for party/lobby.ts's Lobby class — runs behind a
// TLS-terminating reverse proxy (see deploy/Caddyfile, DEPLOY.md) instead of
// PartyKit's own `partykit deploy`, which is blocked by two unrelated
// PartyKit/Cloudflare-side issues (see DEPLOY.md). Imports Lobby UNCHANGED so
// that path stays open for the future if it's ever fixed.
//
// Implements exactly the subset of Party.Room / Party.Connection /
// Party.Storage / Party.ConnectionContext / Party.Request that party/lobby.ts
// actually calls — confirmed by direct read of that file:
//   room.storage.{get,put,list}, room.{broadcast,getConnections,env,id},
//   conn.{id,send,close}, ctx.request.url, and onRequest's `_req` param is
//   entirely unused. Casts to the real Party.* types (`as unknown as
//   Party.X`) are deliberate: those interfaces carry Cloudflare-Workers-only
//   members (DurableObjectStorage transactions/alarms, the full WebSocket
//   event-target surface, blockConcurrencyWhile, analytics, etc.) this
//   project's Lobby never touches. Where a member IS supplied, its signature
//   is checked against Party.Room's real type via `satisfies` before the
//   cast (see makeRoomContext) so a future signature drift fails at build
//   time instead of at 2am on a real server.
//
// This is a real internet-facing process once deployed — every handler
// dispatch below is wrapped so a single bad frame, a single storage error,
// or a single room hitting capacity can only fail THAT request/connection,
// never bring down every other room's game. Anything that reaches
// process.on('uncaughtException') below is a bug that slipped past those
// wrappers, logged loudly and then exited so systemd restarts cleanly rather
// than continuing to run with unknown broken state.
//
// Run directly with `npx tsx party/nodeHost.ts [--port N]`, or via
// `npm run room:serve` for local testing, or via the systemd unit in
// deploy/poketft-room.service in production. scripts/roomHarness.ts's
// ROOM_BACKEND=node toggle spawns this exact command for automated tests.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket as WsSocket } from 'ws'
import type * as Party from 'partykit/server'
import Lobby from './lobby'
import { FileRoomStorage, SAFE_ROOM_ID, sweepStaleTempFiles } from './nodeStorage'

const PARTY_NAME = 'main'
// Matches the /parties/:party/:roomId convention scripts/roomHarness.ts's
// healthcheck URL and Lobby.onRequest already assume — the same contract,
// just served by this process instead of `partykit dev`.
const ROOM_ROUTE = /^\/parties\/([^/]+)\/([^/]+)\/?$/
// Above the 4096-char app-level check in lobby.ts's onMessage — this ceiling
// exists only to stop an oversized single WS frame from being buffered into
// memory before that check ever runs. A frame over this limit makes `ws`
// emit an 'error' on the socket — see the per-connection error handler below
// for why that must never be left unhandled.
const MAX_WS_PAYLOAD_BYTES = 64 * 1024
// broadcastResolve streams a whole fight log (up to ~34 MiB uncompressed,
// per party/lobby.ts's own comment on the Durable Object storage-value
// limit) to every connection in a room, one chunk at a time. A peer that's
// stalled (a dead mobile connection the heartbeat hasn't caught yet, a slow
// client) has nowhere for that data to go except this process's own memory,
// via `ws`'s internal send buffer — against MemoryMax=512M in the systemd
// unit, one stuck peer can OOM-kill every room, not just its own. Past this
// ceiling, drop the connection rather than let it keep buffering.
const MAX_BUFFERED_BYTES = 16 * 1024 * 1024

// However many simultaneous rooms this process will host. Each costs one
// Lobby (a full 6-seat RunState) plus, once anyone connects, one on-disk
// JSON file — nothing evicts a room from memory until it's both empty and
// idle (see IDLE_EVICT_MS), and nothing before this cap stops an
// unauthenticated caller from spinning up an unbounded number of them just
// by hitting distinct room ids. 200 is generous for a friends-only game
// while still bounding worst-case memory/disk to something a t3.micro
// survives; raise it only alongside the instance size.
const MAX_ROOMS = 200
// A room with zero live connections for this long is swept out of memory on
// the next sweep tick (below) — its on-disk state is NOT deleted, so a
// player returning to the same link later still rehydrates correctly via a
// fresh Lobby, the same way a real PartyKit Durable Object would evict and
// re-instantiate. Only ever evicts empty rooms: onClose already clears a
// room's timer and drops it to 'idle' once its connection count hits zero,
// so there is nothing left running to interrupt.
const IDLE_EVICT_MS = 10 * 60 * 1000
const EVICTION_SWEEP_MS = 60 * 1000
// A dead TCP peer (phone losing signal, a NAT timeout with no clean FIN)
// never fires 'close' on its own — without a heartbeat, that connection
// holds its seat forever and a real player gets rejected as "room full."
const HEARTBEAT_INTERVAL_MS = 30_000

// Only the one env key party/lobby.ts ever reads (planningMsFor, in
// src/net/protocol.ts) is forwarded into room.env — NOT the entire
// process.env. A stray PLANNING_MS in a shell, an /etc/environment line, or
// a systemd drop-in should never be able to silently change production round
// timing with no log line; this allowlist is also literally the only thing
// that could make that visible instead of ambient.
const ALLOWED_ROOM_ENV_KEYS = ['PLANNING_MS'] as const

// WebSockets aren't subject to CORS, so with no check at all, any page
// anywhere on the internet could open connections to any room id on this
// domain from every one of its visitors' browsers — a drive-by amplifier
// against MAX_ROOMS and the per-room action budget alike. Browsers always
// send an Origin header; non-browser clients (this project's own Node test
// harness, curl, a native app) typically do not, and are allowed through —
// this is a browser-drive-by guard, not an auth mechanism. Comma-separated,
// e.g. `ALLOWED_ORIGINS=https://poketft.netlify.app`; unset (dev default) is
// permissive.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  if (ALLOWED_ORIGINS.length === 0) return true
  return ALLOWED_ORIGINS.includes(origin)
}

// ─── Dispatch safety ─────────────────────────────────────────────────────────

// Every async handler invocation in this file is fired without an outer
// `await` (a WS 'message' event, an HTTP request, a timer) — so a bare
// `void somePromise()` would let any rejection become an unhandled promise
// rejection, which Node terminates the process on. This is what BL-03
// actually was: a single storage error (disk full, a permissions problem)
// on ANY one connection took down every room. Every dispatch site below
// goes through this instead — log, keep serving everyone else.
function fireAndLog(promise: Promise<unknown>, context: string): void {
  promise.catch(err => { console.error(`[nodeHost] ${context} failed:`, err) })
}

// ─── Connection wrapper ─────────────────────────────────────────────────────

// party/lobby.ts touches exactly .id, .send(), and .close() on a connection
// (confirmed by grep) — nothing from the wider WebSocket surface Party.
// Connection's real type carries. `close`'s signature still accepts the same
// (code?, reason?) pair the real type does, even though Lobby never passes
// them, so a future Lobby change that does start passing them doesn't fail
// silently at runtime.
class ConnectionImpl {
  // Flipped false right before each heartbeat ping, flipped back true only
  // if a 'pong' arrives before the NEXT ping — two full intervals with no
  // answer means the peer is presumed dead (see startHeartbeat).
  isAlive = true

  constructor(private readonly ws: WsSocket, readonly id: string) {
    ws.on('pong', () => { this.isAlive = true })
  }

  send(data: string): void {
    if (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      // This peer isn't draining what's already queued — sending more just
      // grows the same buffer further. Cut it loose (this fires 'close',
      // which frees its seat normally) instead of continuing to accumulate
      // data for a connection that may never read any of it.
      console.error(`[nodeHost] connection ${this.id} exceeded buffered-send limit; terminating`)
      this.ws.terminate()
      return
    }
    // A send after the socket is already closing/closed is silently
    // dropped by `ws` with no callback (per its own sendAfterClose
    // behavior) — that's the correct outcome (nothing useful to do with a
    // dead socket), but only an explicit callback surfaces any OTHER send
    // failure (a mid-flight write error) instead of it vanishing unlogged.
    this.ws.send(data, err => {
      if (err) console.error(`[nodeHost] send failed on connection ${this.id}:`, err)
    })
  }

  close(code?: number, reason?: string): void { this.ws.close(code, reason) }
  ping(): void { this.ws.ping() }
  terminate(): void { this.ws.terminate() }
}

interface RoomEntry {
  lobby: Lobby
  connections: Map<string, ConnectionImpl>
  storage: FileRoomStorage
  lastActivity: number
  // Serializes onConnect/onMessage/onClose for THIS room relative to each
  // other. party/seats.ts and party/lobby.ts both reason from "a PartyKit
  // room is a single-threaded Durable Object — handlers never interleave."
  // This adapter dispatches each externally-triggered handler with `void`,
  // so without this queue, e.g. four sockets closing near-simultaneously can
  // interleave their onClose() calls' awaited persist()s in call order that
  // doesn't match wall-clock order — observed as a `seat-taken` broadcast
  // arriving after a `seat-freed` for the very same seat. Chaining every
  // dispatch onto this queue restores that ordering for the events this
  // adapter controls.
  //
  // What this does NOT close: Lobby's own internal setTimeout-driven
  // onDeadline() fires directly as a private method call the moment its
  // timer elapses, entirely outside this adapter's dispatch path — there is
  // no hook here to route it through the same queue without modifying
  // party/lobby.ts, which this project deliberately keeps unmodified. In
  // practice `onDeadline`'s own synchronous prefix (before its first await)
  // still runs to completion before any other queued handler gets a turn,
  // same as every other handler here, so the realistic exposure is narrow —
  // but it is a real, documented gap, not a fully closed one.
  handlerQueue: Promise<void>
}

const rooms = new Map<string, Promise<RoomEntry>>()
let nextConnId = 0

class RoomCapacityError extends Error {}

// ─── Room context ───────────────────────────────────────────────────────────

function roomEnv(): Record<string, unknown> {
  const env: Record<string, unknown> = {}
  for (const key of ALLOWED_ROOM_ENV_KEYS) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  return env
}

function makeRoomContext(
  roomId: string,
  connections: Map<string, ConnectionImpl>,
  storage: FileRoomStorage,
): Party.Room {
  // Checked against Party.Room's real declared shape for the members this
  // object actually supplies (excluding `storage`, whose real type is
  // Cloudflare's much wider DurableObjectStorage interface — not something a
  // `satisfies` clause usefully constrains for a class that only ever
  // implements get/put/list). `broadcast`'s parameter type and the presence
  // of a `without` default both come directly from Party.Room's own
  // signature, not a narrowed guess.
  const checked = {
    id: roomId,
    env: roomEnv(),
    broadcast: (msg: string | ArrayBuffer | ArrayBufferView, without: string[] = []) => {
      if (typeof msg !== 'string') {
        // party/lobby.ts only ever calls broadcast with JSON.stringify(...)
        // — confirmed by grep. A non-string payload would mean either a
        // future Lobby change this adapter hasn't been updated for, or a
        // bug; either way, silently dropping or mis-encoding it is worse
        // than failing loudly right here.
        throw new TypeError('nodeHost broadcast: only string payloads are supported')
      }
      for (const [id, conn] of connections) if (!without.includes(id)) conn.send(msg)
    },
  } satisfies Pick<Party.Room, 'id' | 'env' | 'broadcast'>

  // getConnections/getConnection/connections are deliberately NOT part of
  // the `satisfies` check above: Party.Room's real getConnections<TState>()
  // returns Iterable<Party.Connection<TState>>, and Party.Connection extends
  // the FULL Cloudflare WebSocket interface — matching that structurally
  // would mean ConnectionImpl re-implementing addEventListener/readyState/
  // etc. it never uses. The concrete signature drift this file's review
  // actually found was in `broadcast` and `close` (on ConnectionImpl), both
  // checked above/there; these casts are a narrower, deliberate exception,
  // not an oversight — and unlike the throwing stubs below, these three are
  // trivially correct to implement for real, so there's no reason not to.
  const base = {
    ...checked,
    name: PARTY_NAME,
    getConnections: () => connections.values() as unknown as Iterable<Party.Connection>,
    getConnection: (id: string) => connections.get(id) as unknown as Party.Connection | undefined,
    connections: connections as unknown as Map<string, Party.Connection>,
  }

  // Every OTHER Party.Room member this adapter does not implement. Lobby
  // never touches any of these today — confirmed by direct read of
  // party/lobby.ts — but the whole point of hosting it unmodified is that it
  // may gain new PartyKit API usage later without anyone updating this
  // adapter in lockstep. Without these, a future `room.blockConcurrencyWhile`
  // (or similar) call would type-check fine against the `as unknown as
  // Party.Room` cast below and then silently be `undefined` at runtime,
  // failing in a confusing spot far from the actual cause. A clear throw
  // pointing back at this file is a better failure mode than that.
  //
  // These MUST be declared as getters directly on the object literal
  // returned below, not spread in from a separately-built object: object
  // spread (`{...x}`) evaluates every getter on `x` immediately to copy its
  // current value, which would make every one of these throw the moment a
  // room is created rather than only if something actually reads the
  // member — exactly the bug this comment is here to prevent someone from
  // reintroducing.
  function unimplemented(member: string): never {
    throw new Error(
      `party/nodeHost.ts's Party.Room adapter does not implement '${member}'. `
      + 'party/lobby.ts started using a PartyKit API this adapter was never updated for — '
      + 'see party/nodeHost.ts\'s makeRoomContext.',
    )
  }

  return {
    ...base,
    storage: storage as unknown as Party.Storage,
    get internalID(): string { return unimplemented('internalID') },
    get blockConcurrencyWhile(): never { return unimplemented('blockConcurrencyWhile') },
    get context(): never { return unimplemented('context') },
    get parties(): never { return unimplemented('parties') },
    get analytics(): never { return unimplemented('analytics') },
  } as unknown as Party.Room
}

async function createRoom(roomId: string, dataDir: string): Promise<RoomEntry> {
  const connections = new Map<string, ConnectionImpl>()
  const storage = new FileRoomStorage(roomId, dataDir)
  const lobby = new Lobby(makeRoomContext(roomId, connections, storage))
  await lobby.onStart()
  return { lobby, connections, storage, lastActivity: Date.now(), handlerQueue: Promise.resolve() }
}

// Memoizes the PROMISE, not the resolved value, and does so BEFORE the first
// await inside createRoom(). Two 'upgrade' events for the same new room id
// are still handled one at a time by Node's single-threaded event loop, so
// the first call's synchronous prefix (through `rooms.set`) always finishes
// before a second concurrent call's `rooms.get` can run — closing the
// original bug, where memoizing only the resolved RoomEntry left a window
// (the `await lobby.onStart()` inside room creation) during which multiple
// concurrent connects each built their own independent Lobby, each with its
// own seat table, each thinking it alone owned the room.
async function getOrCreateRoom(roomId: string, dataDir: string): Promise<RoomEntry> {
  const existing = rooms.get(roomId)
  if (existing) return existing
  if (rooms.size >= MAX_ROOMS) {
    throw new RoomCapacityError(`room capacity (${MAX_ROOMS}) reached`)
  }
  const entryPromise = createRoom(roomId, dataDir)
  rooms.set(roomId, entryPromise)
  // A room that fails to even start (e.g. a storage error on its very first
  // onStart) must not stay cached as a permanently-rejected promise — every
  // future request for that same id would otherwise fail forever with no
  // path to recovery short of a process restart.
  entryPromise.catch(() => { rooms.delete(roomId) })
  return entryPromise
}

function touch(entry: RoomEntry): void {
  entry.lastActivity = Date.now()
}

// Serializes one dispatch onto a room's handler queue (see RoomEntry's own
// comment for what this does and does not close), and — same reasoning as
// fireAndLog — never lets a rejection reach an unhandled state: it's both
// swallowed on the queue's own tail (so one failed handler can't wedge every
// later one for the same room) and reported via fireAndLog at the call site.
function enqueueHandler(entry: RoomEntry, fn: () => Promise<void>): Promise<void> {
  const next = entry.handlerQueue.then(fn)
  entry.handlerQueue = next.catch(err => {
    console.error('[nodeHost] queued handler failed:', err)
  })
  return next
}

function parseRoute(url: string): { party: string; roomId: string } | null {
  const path = url.split('?')[0] ?? url
  const match = ROOM_ROUTE.exec(path)
  return match ? { party: match[1], roomId: match[2] } : null
}

// ─── HTTP (healthcheck / onRequest) ─────────────────────────────────────────

async function handleHttp(req: IncomingMessage, res: ServerResponse, dataDir: string): Promise<void> {
  // The WebSocket path already checks this — a plain HTTP GET is a CORS
  // "simple request", so without this check here too, ANY web page could
  // silently create rooms server-side via `fetch()` (the response is
  // unreadable cross-origin, but the room still gets created), spending
  // straight into MAX_ROOMS with no browser-visible trace of who did it.
  if (!originAllowed(req)) {
    res.writeHead(403, { 'content-type': 'text/plain' })
    res.end('forbidden')
    return
  }
  // GET/HEAD only. Lobby.onRequest doesn't branch on method today, so a
  // POST/PUT/DELETE currently "succeeds" and creates a room exactly like a
  // GET would — no reason to accept that surface.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain', allow: 'GET, HEAD' })
    res.end('method not allowed')
    return
  }
  const route = parseRoute(req.url ?? '')
  if (!route || route.party !== PARTY_NAME || !SAFE_ROOM_ID.test(route.roomId)) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }

  let entry: RoomEntry
  try {
    entry = await getOrCreateRoom(route.roomId, dataDir)
  } catch (err) {
    const status = err instanceof RoomCapacityError ? 503 : 500
    res.writeHead(status, { 'content-type': 'text/plain' })
    res.end(status === 503 ? 'room capacity reached' : 'internal error')
    if (status === 500) console.error(`[nodeHost] getOrCreateRoom failed for ${route.roomId}:`, err)
    return
  }
  // Deliberately NOT touch(entry) here: this is the healthcheck/status
  // endpoint, not a sign a real player is present. Refreshing lastActivity
  // on every GET would let repeated polling (or the same cross-origin abuse
  // the check above is guarding against) keep a room alive past
  // IDLE_EVICT_MS forever with nobody actually playing.

  // onRequest's parameter is unused in lobby.ts (confirmed: `_req`) — an
  // empty object cast is sufficient, matching the actual contract.
  const response = await entry.lobby.onRequest({} as unknown as Party.Request)
  res.writeHead(response.status, { 'content-type': response.headers.get('content-type') ?? 'text/plain' })
  res.end(await response.text())
}

// ─── WebSocket upgrade ───────────────────────────────────────────────────────

function handleUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  wss: WebSocketServer,
  dataDir: string,
): void {
  // Node's HTTP server removes ITS OWN 'error' listener on this socket right
  // before emitting 'upgrade' (so the app can take over), and `ws` only
  // re-attaches one inside handleUpgrade below. Between those two points,
  // getOrCreateRoom can await real disk I/O (a brand-new room's onStart
  // reads its storage file) — if the peer resets the connection during that
  // window, an EventEmitter with zero 'error' listeners throws, which is an
  // uncaughtException that takes down every room in the process. Attaching
  // here, before any await, and removing it the moment `ws` takes ownership
  // (or the room lookup fails), closes that window.
  const onSocketError = (err: Error): void => {
    console.error('[nodeHost] upgrade socket error:', err)
    socket.destroy()
  }
  socket.on('error', onSocketError)

  if (!originAllowed(req)) {
    socket.removeListener('error', onSocketError)
    socket.destroy()
    return
  }
  const route = parseRoute(req.url ?? '')
  if (!route || route.party !== PARTY_NAME || !SAFE_ROOM_ID.test(route.roomId)) {
    socket.removeListener('error', onSocketError)
    socket.destroy()
    return
  }
  getOrCreateRoom(route.roomId, dataDir).then(entry => {
    socket.removeListener('error', onSocketError)
    wss.handleUpgrade(req, socket, head, ws => {
      const connId = `c${++nextConnId}`
      const conn = new ConnectionImpl(ws, connId)
      entry.connections.set(connId, conn)
      touch(entry)

      // Required: 'ws' emits 'error' on protocol violations (an oversized
      // frame past MAX_WS_PAYLOAD_BYTES, invalid UTF-8 in a text frame, a bad
      // RSV/opcode) — EventEmitter throws synchronously and crashes the
      // whole process if 'error' has no listener. This was BL-01: any client
      // could take down every room in the process with one malformed frame.
      // terminate() (not close()) because the connection is already in an
      // unknown protocol state; a clean close handshake isn't safe to
      // attempt.
      ws.on('error', err => {
        console.error(`[nodeHost] socket error on connection ${connId}:`, err)
        ws.terminate()
      })

      const partyConn = conn as unknown as Party.Connection

      // ctx.request.url must be an absolute URL string — onConnect reads it
      // via `new URL(ctx.request.url)` to pull the `name` query param.
      const ctx = {
        request: { url: `http://${req.headers.host}${req.url}` },
      } as unknown as Party.ConnectionContext

      fireAndLog(enqueueHandler(entry, () => entry.lobby.onConnect(partyConn, ctx)), `onConnect(${connId})`)

      ws.on('message', data => {
        touch(entry)
        fireAndLog(
          enqueueHandler(entry, () => entry.lobby.onMessage(data.toString(), partyConn)),
          `onMessage(${connId})`,
        )
      })
      ws.on('close', () => {
        entry.connections.delete(connId)
        touch(entry)
        fireAndLog(enqueueHandler(entry, () => entry.lobby.onClose(partyConn)), `onClose(${connId})`)
      })
    })
  }).catch(err => {
    socket.removeListener('error', onSocketError)
    console.error(`[nodeHost] getOrCreateRoom failed for ${route.roomId}:`, err)
    socket.destroy()
  })
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

// A peer that vanished without a clean FIN (phone loses signal, a NAT
// timeout) never fires 'close' on its own — ws has no idea anything is
// wrong, so the seat stays occupied and the room never returns to 'idle'.
// Every HEARTBEAT_INTERVAL_MS, ping every open connection across every room;
// if the PREVIOUS round's ping was never answered, terminate() it — that
// fires 'close' on the underlying socket, which runs the normal onClose()
// path (frees the seat, persists, broadcasts the update) exactly as if the
// client had disconnected cleanly.
function startHeartbeat(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    fireAndLog((async () => {
      for (const entryPromise of rooms.values()) {
        const entry = await entryPromise.catch(() => null)
        if (!entry) continue
        for (const conn of entry.connections.values()) {
          if (!conn.isAlive) {
            conn.terminate()
            continue
          }
          conn.isAlive = false
          conn.ping()
        }
      }
    })(), 'heartbeat tick')
  }, HEARTBEAT_INTERVAL_MS)
}

// ─── Idle room eviction ──────────────────────────────────────────────────────

function startEvictionSweep(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    fireAndLog((async () => {
      const now = Date.now()
      for (const [roomId, entryPromise] of rooms) {
        const entry = await entryPromise.catch(() => null)
        if (!entry) continue
        // entry.lobby.deadline !== null means a planning-phase timer is
        // still scheduled inside Lobby itself — evicting the RoomEntry here
        // would only drop OUR reference to it; Lobby's own setTimeout
        // closure keeps running regardless, keeps resolving rounds, and
        // keeps writing this room's file. A player returning to this same
        // id later would then get a SECOND Lobby + FileRoomStorage racing
        // the still-alive orphaned one over the same file. Evicting only
        // when connections are empty AND there's no live timer keeps this
        // to the case onClose already guarantees is safe: zero connections
        // really does mean nothing is running for this room anymore.
        if (entry.connections.size === 0 && entry.lobby.deadline === null
          && now - entry.lastActivity > IDLE_EVICT_MS) {
          rooms.delete(roomId)
        }
      }
    })(), 'eviction sweep')
  }, EVICTION_SWEEP_MS)
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function startServer(port: number, host: string, dataDir: string): void {
  const httpServer = createServer((req, res) => {
    fireAndLog(handleHttp(req, res, dataDir), 'handleHttp')
  })
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES })

  // Both required for the same reason as the per-connection 'error' handler
  // above: an EventEmitter with no 'error' listener throws on emit. A
  // malformed upgrade request or an EADDRINUSE/EACCES on listen() must log
  // and (for listen failures) exit non-zero so systemd's Restart=on-failure
  // can retry, rather than crash with an opaque unhandled-throw stack.
  wss.on('error', err => { console.error('[nodeHost] WebSocketServer error:', err) })
  httpServer.on('error', err => {
    console.error('[nodeHost] HTTP server error:', err)
    process.exit(1)
  })

  httpServer.on('upgrade', (req, socket, head) => { handleUpgrade(req, socket, head, wss, dataDir) })

  const heartbeat = startHeartbeat()
  const eviction = startEvictionSweep()

  httpServer.listen(port, host, () => {
    console.log(`[nodeHost] listening on http://${host}:${port} (ws at /parties/${PARTY_NAME}/<roomId>)`)
  })

  let shuttingDown = false
  const shutdown = (): void => {
    if (shuttingDown) return
    shuttingDown = true
    console.log('[nodeHost] shutting down')
    clearInterval(heartbeat)
    clearInterval(eviction)

    // Best-effort, time-bounded drain: stop accepting new work, close every
    // live connection, wait for each room's in-flight write (if any) to
    // finish, then exit. A prior version called process.exit(0) immediately
    // after initiating (not awaiting) shutdown — any persist() mid-flight
    // was simply aborted, silently losing the most recent action.
    //
    // httpServer.close()'s own callback is deliberately NOT awaited: it only
    // fires once every connection it's tracking has ended, including
    // upgraded WebSocket sockets — so with any live connection, awaiting it
    // FIRST (a prior version of this function did) made the drain below
    // unreachable and every shutdown fall through to the 5s timeout, which
    // is the exact truncation this function exists to prevent. Calling it
    // without a callback still does the one thing that actually matters
    // here — stop accepting new connections — and the process exits via the
    // race below regardless of whether that callback ever fires.
    const drainAndExit = async (): Promise<void> => {
      httpServer.close()
      const drains: Array<Promise<void>> = []
      for (const entryPromise of rooms.values()) {
        const entry = await entryPromise.catch(() => null)
        if (!entry) continue
        for (const conn of entry.connections.values()) conn.close()
        drains.push(entry.storage.drain())
      }
      await Promise.all(drains)
    }

    void Promise.race([
      drainAndExit(),
      new Promise<void>(resolve => setTimeout(resolve, 5000)),
    ]).catch(err => {
      console.error('[nodeHost] error during shutdown drain (exiting anyway):', err)
    }).finally(() => process.exit(0))
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const portFlagIndex = args.indexOf('--port')
  const port = Number((portFlagIndex !== -1 ? args[portFlagIndex + 1] : undefined) ?? process.env.PORT ?? 1999)
  const host = process.env.HOST ?? '0.0.0.0'
  const dataDir = process.env.ROOM_DATA_DIR ?? '.party-data'

  // `uncaughtException` is fatal: a synchronous throw that escaped every
  // handler means the process is in genuinely unknown state, and continuing
  // to run risks doing more damage than a clean systemd restart would.
  //
  // `unhandledRejection` is deliberately NOT fatal, unlike that. Every
  // dispatch site THIS FILE controls already routes through fireAndLog —
  // but party/lobby.ts's own planning-phase timer
  // (`setTimeout(() => void this.onDeadline(), ...)`) is fired directly by
  // Lobby itself, entirely outside this adapter's dispatch path, and this
  // project deliberately never modifies party/lobby.ts to add a `.catch`
  // there. If that one room's persist() fails (a disk error, a permissions
  // problem), its rejection surfaces here — and killing every other
  // healthy room's live game to protect against ONE room's storage failure
  // is a worse outcome than logging it and continuing. This is a narrow,
  // deliberate exception for that one known, unpatchable source; it is not
  // a general license to swallow rejections silently — anything reaching
  // here is still logged loudly.
  process.on('unhandledRejection', reason => {
    console.error('[nodeHost] unhandled rejection (continuing — see this handler\'s own comment):', reason)
  })
  process.on('uncaughtException', err => {
    console.error('[nodeHost] uncaught exception:', err)
    process.exit(1)
  })

  // Awaited, not fired-and-forgotten: a room writing its first persist() in
  // the first few milliseconds of the process's life could otherwise have
  // its own live .tmp file deleted mid-write by a sweep that hadn't
  // finished yet — an ENOENT that fails that write and silently drops the
  // action. Sweeping BEFORE the server ever starts accepting connections is
  // what makes "any .tmp file found here is necessarily orphaned" (see
  // nodeStorage.ts's own comment on this function) actually true.
  try {
    await sweepStaleTempFiles(dataDir)
  } catch (err) {
    console.error('[nodeHost] failed to sweep stale temp files (continuing anyway):', err)
  }

  startServer(port, host, dataDir)
}

void main()
