import { describe, it, expect } from 'vitest'
import { newRun } from '../econ/runState'
import { botSeats } from '../econ/bots'
import { PROTOCOL_VERSION, parseServerMessage, parseClientMessage } from './protocol'
import type { ServerMessage } from './protocol'

function wellFormedWelcome(protocol: number): string {
  const run = newRun(botSeats())
  const welcome: ServerMessage = {
    t: 'welcome',
    protocol,
    seat: 0,
    snapshot: run,
    lobby: run.players.map((p, seat) => ({
      seat, name: p.name, hp: p.hp, human: seat === 0, eliminated: false,
    })),
    phase: 'lobby',
    round: run.round,
  }
  return JSON.stringify(welcome)
}

describe('parseServerMessage', () => {
  it('returns null for non-JSON input', () => {
    expect(parseServerMessage('not json')).toBeNull()
  })

  it('returns null for a JSON array', () => {
    expect(parseServerMessage('[]')).toBeNull()
  })

  it('returns null for JSON null', () => {
    expect(parseServerMessage('null')).toBeNull()
  })

  it('returns null for an unknown discriminant', () => {
    expect(parseServerMessage('{"t":"nope"}')).toBeNull()
  })

  it('returns null for a missing discriminant', () => {
    expect(parseServerMessage('{"snapshot":{}}')).toBeNull()
  })

  // A version-skewed server's payload shapes are not ours to interpret, so the
  // handshake frame is the one place the parse checks a body field.
  it('returns null for a welcome at the wrong protocol version', () => {
    expect(parseServerMessage(wellFormedWelcome(PROTOCOL_VERSION + 1))).toBeNull()
  })

  it('returns the parsed welcome at the current protocol version', () => {
    const parsed = parseServerMessage(wellFormedWelcome(PROTOCOL_VERSION))
    expect(parsed).not.toBeNull()
    expect(parsed!.t).toBe('welcome')
    expect(parsed!.t === 'welcome' && parsed!.seat).toBe(0)
  })

  it('returns the parsed snapshot frame', () => {
    const run = newRun(botSeats())
    const parsed = parseServerMessage(JSON.stringify({ t: 'snapshot', snapshot: run } satisfies ServerMessage))
    expect(parsed).not.toBeNull()
    expect(parsed!.t).toBe('snapshot')
    expect(parsed!.t === 'snapshot' && parsed!.snapshot.players.length).toBe(run.players.length)
  })

  it('accepts every discriminant the ServerMessage union carries', () => {
    for (const t of ['snapshot', 'lobby', 'rejected', 'seat-taken', 'seat-freed', 'phase', 'resolve', 'fight-chunk']) {
      expect(parseServerMessage(JSON.stringify({ t }))?.t).toBe(t)
    }
  })

  it('never throws on hostile input', () => {
    for (const raw of ['', '{', '[1,2,3]', 'undefined', '"a string"', '42', null, undefined]) {
      expect(() => parseServerMessage(raw)).not.toThrow()
    }
  })
})

describe('parseClientMessage', () => {
  it('parses the host start message', () => {
    expect(parseClientMessage('{"t":"start"}')).toEqual({ t: 'start' })
  })

  it('still parses an action message', () => {
    expect(parseClientMessage('{"t":"action","action":{"t":"reroll"}}'))
      .toEqual({ t: 'action', action: { t: 'reroll' } })
  })

  it('returns null for an unknown client discriminant', () => {
    expect(parseClientMessage('{"t":"start-please"}')).toBeNull()
  })

  // The load-bearing security property of the union: a client has no syntax to
  // name a seat, so a forged seat field is inert rather than fatal.
  it('drops a forged seat field from a start message', () => {
    expect(parseClientMessage('{"t":"start","seat":3}')).toEqual({ t: 'start' })
  })
})
