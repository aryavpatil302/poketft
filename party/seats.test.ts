import { describe, it, expect } from 'vitest'
import {
  newRoomRun, newSeatTable, assignSeat, freeSeat, seatOf,
  sanitizeDisplayName, lobbyView, type SeatTable,
} from './seats'
import type { RunState } from '../src/econ/runState'
import { PLAYER_COUNT } from '../src/econ/constants'

// The invariant that keeps the room's notion of "human" and the engine's
// notion of "human" from drifting apart: a seat is occupied in the table iff
// its personaId is null in the run. Called after every mutation in every
// test below.
function expectOccupancyInvariant(run: RunState, table: SeatTable): void {
  for (let i = 0; i < run.players.length; i++) {
    expect(table.occupants[i] !== null).toBe(run.players[i].personaId === null)
  }
}

describe('newRoomRun', () => {
  it('returns 6 seats, every one bot-held, with distinct names', () => {
    const run = newRoomRun()
    expect(run.players.length).toBe(PLAYER_COUNT)
    for (const p of run.players) expect(p.personaId).not.toBeNull()
    const names = run.players.map(p => p.name)
    expect(new Set(names).size).toBe(PLAYER_COUNT)
  })
})

describe('assignSeat', () => {
  it('assigns sequential seats 0..5 then returns null on the 7th call', () => {
    const run = newRoomRun()
    const table = newSeatTable(run)
    expectOccupancyInvariant(run, table)
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const seat = assignSeat(run, table, `c${i}`, `Player${i}`)
      expect(seat).toBe(i)
      expectOccupancyInvariant(run, table)
    }
    const seventh = assignSeat(run, table, 'c6', 'Overflow')
    expect(seventh).toBeNull()
    expectOccupancyInvariant(run, table)
  })

  it('makes the seat human and applies the sanitized display name', () => {
    const run = newRoomRun()
    const table = newSeatTable(run)
    const seat = assignSeat(run, table, 'c1', 'Ash')
    expect(seat).toBe(0)
    expect(run.players[0].personaId).toBeNull()
    expect(run.players[0].name).toBe('Ash')
    expect(seatOf(table, 'c1')).toBe(0)
    expectOccupancyInvariant(run, table)
  })
})

describe('freeSeat', () => {
  it('restores personaId and name from the captured roster', () => {
    const run = newRoomRun()
    const table = newSeatTable(run)
    const originalPersona = table.roster[1].personaId
    const originalName = table.roster[1].name
    assignSeat(run, table, 'c0', 'Ash')     // takes seat 0, leaving seat 1 the lowest free
    assignSeat(run, table, 'c1', 'Misty')   // takes seat 1
    expectOccupancyInvariant(run, table)

    const freed = freeSeat(run, table, 'c1')
    expect(freed).toBe(1)
    expect(run.players[1].personaId).toBe(originalPersona)
    expect(run.players[1].name).toBe(originalName)
    expectOccupancyInvariant(run, table)
  })

  it('returns null for a connection id holding no seat', () => {
    const run = newRoomRun()
    const table = newSeatTable(run)
    expect(freeSeat(run, table, 'ghost')).toBeNull()
    expectOccupancyInvariant(run, table)
  })

  it('a freed seat is reassignable and goes to the next connection ahead of any higher free seat', () => {
    const run = newRoomRun()
    const table = newSeatTable(run)
    assignSeat(run, table, 'c0', 'A')
    assignSeat(run, table, 'c1', 'B')
    assignSeat(run, table, 'c2', 'C')
    expectOccupancyInvariant(run, table)

    freeSeat(run, table, 'c1') // frees seat 1, which is now the lowest free seat
    expectOccupancyInvariant(run, table)

    const seat = assignSeat(run, table, 'c3', 'D')
    expect(seat).toBe(1)
    expectOccupancyInvariant(run, table)
  })

  it('preserves every economy field except shopLocked, which resets to false', () => {
    const run = newRoomRun()
    const table = newSeatTable(run)

    const econ = run.players[0]
    econ.gold = 47
    econ.level = 6
    econ.xp = 13
    econ.streak = -3
    econ.hp = 62
    econ.bench[0] = { definitionId: 'bulbasaur', tier: 1 }
    econ.bench[1] = { definitionId: 'charmander', tier: 2 }
    econ.board.push(
      { definitionId: 'squirtle', tier: 1, hexPos: { col: 0, row: 4 } },
      { definitionId: 'pikachu', tier: 1, hexPos: { col: 1, row: 4 } },
      { definitionId: 'eevee', tier: 3, hexPos: { col: 2, row: 4 } },
    )
    econ.itemBench = ['bf_sword', 'needlessly_large_rock']
    econ.pendingIncome = 9
    econ.shop = ['bulbasaur', 'charmander', null, 'eevee', null]
    econ.shopLocked = true

    const before = structuredClone(econ)

    assignSeat(run, table, 'c0', 'Ash')
    expectOccupancyInvariant(run, table)
    const freed = freeSeat(run, table, 'c0')
    expect(freed).toBe(0)
    expectOccupancyInvariant(run, table)

    const after = run.players[0]
    expect(after.gold).toBe(before.gold)
    expect(after.level).toBe(before.level)
    expect(after.xp).toBe(before.xp)
    expect(after.streak).toBe(before.streak)
    expect(after.hp).toBe(before.hp)
    expect(after.pendingIncome).toBe(before.pendingIncome)
    expect(after.bench).toEqual(before.bench)
    expect(after.board).toEqual(before.board)
    expect(after.itemBench).toEqual(before.itemBench)
    expect(after.shop).toEqual(before.shop)
    expect(after.eliminated).toBe(before.eliminated)
    expect(after.cliffPositions).toEqual(before.cliffPositions)

    // The one field the contract promises to reset, not preserve.
    expect(before.shopLocked).toBe(true)
    expect(after.shopLocked).toBe(false)
  })
})

describe('sanitizeDisplayName', () => {
  it('returns the fallback for null', () => {
    expect(sanitizeDisplayName(null, 2)).toBe('Player 3')
  })

  it('collapses a whitespace-only or empty input to the fallback', () => {
    expect(sanitizeDisplayName('', 0)).toBe('Player 1')
    expect(sanitizeDisplayName('   ', 0)).toBe('Player 1')
  })

  it('strips control characters and angle brackets', () => {
    expect(sanitizeDisplayName('<script>Ash</script>', 0)).toBe('scriptAsh/script')
    expect(sanitizeDisplayName('A\x00s\x1Fh\x7F', 0)).toBe('Ash')
  })

  it('truncates to 24 characters', () => {
    const raw = 'A'.repeat(40)
    const result = sanitizeDisplayName(raw, 0)
    expect(result.length).toBe(24)
    expect(result).toBe('A'.repeat(24))
  })

  it('trims and returns a clean name unchanged (short of the cap)', () => {
    expect(sanitizeDisplayName('  Ash  ', 0)).toBe('Ash')
  })
})

describe('lobbyView', () => {
  it('reports human true exactly for occupied seats, with each seat\'s hp/name/eliminated', () => {
    const run = newRoomRun()
    const table = newSeatTable(run)
    assignSeat(run, table, 'c0', 'Ash')
    expectOccupancyInvariant(run, table)

    const view = lobbyView(run, table)
    expect(view.length).toBe(PLAYER_COUNT)
    expect(view[0]).toEqual({
      seat: 0,
      name: run.players[0].name,
      hp: run.players[0].hp,
      human: true,
      eliminated: run.players[0].eliminated,
    })
    for (let i = 1; i < PLAYER_COUNT; i++) {
      expect(view[i].human).toBe(false)
      expect(view[i].hp).toBe(run.players[i].hp)
      expect(view[i].eliminated).toBe(run.players[i].eliminated)
    }
  })
})

describe('newSeatTable resume-after-restart', () => {
  it('falls back to the persona roster when a persisted seat is mid-human', () => {
    const run = newRoomRun()
    // Simulate a persisted run that restarted while seat 2 was human-held —
    // personaId is null but there is no live connection to own it.
    run.players[2].personaId = null
    run.players[2].name = 'StaleHuman'

    const table = newSeatTable(run)
    // No occupant recorded for seat 2 (fresh table, no live connections yet).
    expect(table.occupants[2]).toBeNull()
    // Roster fallback must be a real persona, not null.
    expect(table.roster[2].personaId).not.toBeNull()
  })
})
