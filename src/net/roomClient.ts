// The browser's transport wrapper around one PartyKit room connection.
//
// MUST STAY DOM-FREE. No document, no window, no browser local-storage
// access, and no import that reaches any of them. That constraint is what
// lets scripts/netClient.ts drive this exact module from Node against a real
// `partykit dev` room — this repo has no browser automation, so that script
// is the only automated coverage the browser networking path has. Rendering
// and persistence belong to the caller (src/main.ts).

import PartySocket from 'partysocket'
import { parseServerMessage, type ServerMessage, type RejectReason } from './protocol'
import type { GameAction } from '../game/round'

export type RoomClientStatus = 'connecting' | 'open' | 'closed' | 'rejected'

export interface RoomClientOptions {
  host: string
  room: string
  name: string
}

type MessageHandler = (message: ServerMessage) => void
type StatusHandler = (status: RoomClientStatus, reason?: RejectReason) => void

export class RoomClient {
  private socket: PartySocket | null = null
  // Starts 'connecting' rather than an 'idle' state the union does not carry:
  // a client that has been constructed but not connected sends nothing (every
  // send is gated on 'open'), so the two are behaviourally identical.
  private currentStatus: RoomClientStatus = 'connecting'
  private currentSeat: number | null = null
  private dropped = 0
  private messageHandlers: MessageHandler[] = []
  private statusHandlers: StatusHandler[] = []

  // Deliberately does NOT connect — the caller registers its handlers first,
  // then calls connect(), so no frame can arrive before anyone is listening.
  constructor(private readonly options: RoomClientOptions) {}

  connect(): void {
    if (this.socket !== null) return
    this.setStatus('connecting')
    const socket = new PartySocket({
      host: this.options.host,
      room: this.options.room,
      party: 'main',
      query: { name: this.options.name },
    })
    this.socket = socket

    socket.addEventListener('open', () => {
      // A reconnect that lands after a rejection must not resurrect the
      // session — 'rejected' is terminal for this client.
      if (this.currentStatus === 'rejected') return
      this.setStatus('open')
    })
    socket.addEventListener('message', event => {
      this.receiveRaw((event as MessageEvent).data)
    })
    socket.addEventListener('close', () => {
      // 'rejected' is the more specific reason for the same observable fact
      // (the socket is gone) and must not be flattened into 'closed'.
      if (this.currentStatus === 'rejected') return
      this.setStatus('closed')
    })
    socket.addEventListener('error', () => {
      // Deliberately does not change status: partysocket reconnects
      // internally, and an error without a close is transient. Registered
      // anyway so the event is consumed rather than surfacing as an
      // unhandled error out of the socket.
    })
  }

  // The single inbound path. The socket's 'message' listener is the only
  // production caller; it is public so scripts/netClient.ts can feed
  // hand-built raw frames through the exact code a real frame takes, rather
  // than through a reimplementation that could drift from it.
  receiveRaw(raw: unknown): void {
    const message = parseServerMessage(raw)
    if (message === null) {
      // Unrecognised frame (T-04-01): counted and dropped. No handler runs,
      // nothing throws, and no render state is touched.
      this.dropped++
      return
    }

    if (message.t === 'welcome') {
      this.currentSeat = message.seat
    } else if (message.t === 'rejected' && message.reason === 'not-seated') {
      // The room-is-full case: party/seats.ts's assignSeat returned null and
      // party/lobby.ts closed the connection right after sending this.
      this.currentStatus = 'rejected'
      // Stop partysocket's own reconnect loop — a rejected client retrying
      // forever is a self-inflicted flood against a room that already said no.
      this.socket?.close()
      this.emitStatus('rejected', message.reason)
    }

    for (const handler of this.messageHandlers) handler(message)
  }

  onMessage(cb: MessageHandler): void {
    this.messageHandlers.push(cb)
  }

  onStatus(cb: StatusHandler): void {
    this.statusHandlers.push(cb)
  }

  // Both senders no-op outside 'open'. A click made during a drop is dropped
  // VISIBLY (the caller's banner says the connection is gone) rather than
  // buffered into a socket that may reopen minutes later and replay a stale
  // intent against a round that has long since settled — see T-04-05.
  sendAction(action: GameAction): void {
    if (this.currentStatus !== 'open' || this.socket === null) return
    this.socket.send(JSON.stringify({ t: 'action', action }))
  }

  sendStart(): void {
    if (this.currentStatus !== 'open' || this.socket === null) return
    this.socket.send(JSON.stringify({ t: 'start' }))
  }

  get seat(): number | null { return this.currentSeat }
  get status(): RoomClientStatus { return this.currentStatus }
  get droppedFrames(): number { return this.dropped }

  close(): void {
    this.socket?.close()
    if (this.currentStatus !== 'rejected') this.setStatus('closed')
  }

  private setStatus(status: RoomClientStatus): void {
    if (this.currentStatus === status) return
    this.currentStatus = status
    this.emitStatus(status)
  }

  private emitStatus(status: RoomClientStatus, reason?: RejectReason): void {
    for (const handler of this.statusHandlers) handler(status, reason)
  }
}
