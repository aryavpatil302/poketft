import { describe, it, expect } from 'vitest'
import { emptyEcon } from './runState'
import { tryCombine, wouldCombine } from './combine'

function econWith(bench: Array<{ id: string; tier: 1|2|3 } | null>, board: Array<{ id: string; tier: 1|2|3; col: number; row: number }> = []) {
  const e = emptyEcon('t', null)
  bench.forEach((b, i) => { e.bench[i] = b ? { definitionId: b.id, tier: b.tier } : null })
  e.board = board.map(u => ({ definitionId: u.id, tier: u.tier, hexPos: { col: u.col, row: u.row } }))
  return e
}

describe('combine', () => {
  it('three bench copies merge into one 2★ on the bench', () => {
    const e = econWith([{ id: 'tangela', tier: 1 }, { id: 'tangela', tier: 1 }, { id: 'tangela', tier: 1 }])
    const res = tryCombine(e)
    expect(res?.upgrades).toEqual([{ definitionId: 'tangela', from: 1, to: 2, placedOnBoard: false }])
    const copies = e.bench.filter(b => b?.definitionId === 'tangela')
    expect(copies).toHaveLength(1)
    expect(copies[0]!.tier).toBe(2)
    expect(e.board).toHaveLength(0)
  })

  it('upgrade keeps the board position when a board copy is consumed', () => {
    const e = econWith(
      [{ id: 'zubat', tier: 1 }, { id: 'zubat', tier: 1 }],
      [{ id: 'zubat', tier: 1, col: 3, row: 5 }],
    )
    const res = tryCombine(e)
    expect(res?.upgrades[0].placedOnBoard).toBe(true)
    expect(e.board).toHaveLength(1)
    expect(e.board[0]).toEqual({ definitionId: 'zubat', tier: 2, hexPos: { col: 3, row: 5 } })
    expect(e.bench.every(b => b === null)).toBe(true)
  })

  it('nine copies chain all the way to 3★', () => {
    const e = econWith(Array(9).fill({ id: 'kingler', tier: 1 }))
    const res = tryCombine(e)
    expect(res?.upgrades.map(u => `${u.from}>${u.to}`)).toEqual(['1>2', '1>2', '1>2', '2>3'])
    const remaining = e.bench.filter(Boolean)
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toEqual({ definitionId: 'kingler', tier: 3 })
  })

  it('different tiers never merge together', () => {
    const e = econWith([{ id: 'klawf', tier: 1 }, { id: 'klawf', tier: 1 }, { id: 'klawf', tier: 2 }])
    expect(tryCombine(e)).toBeNull()
  })

  it('3★ units never combine further', () => {
    const e = econWith([{ id: 'unown', tier: 3 }, { id: 'unown', tier: 3 }, { id: 'unown', tier: 3 }])
    expect(tryCombine(e)).toBeNull()
  })

  it('multiple independent triples all resolve', () => {
    const e = econWith([
      { id: 'tangela', tier: 1 }, { id: 'tangela', tier: 1 }, { id: 'tangela', tier: 1 },
      { id: 'zubat', tier: 1 }, { id: 'zubat', tier: 1 }, { id: 'zubat', tier: 1 },
    ])
    const res = tryCombine(e)
    expect(res?.upgrades).toHaveLength(2)
    expect(e.bench.filter(Boolean)).toHaveLength(2)
  })

  it('wouldCombine detects a purchase completing a triple across bench and board', () => {
    const e = econWith(
      [{ id: 'morgrem', tier: 1 }],
      [{ id: 'morgrem', tier: 1, col: 2, row: 6 }],
    )
    expect(wouldCombine(e, 'morgrem')).toBe(true)
    expect(wouldCombine(e, 'tangela')).toBe(false)
  })

  it('an item on a consumed copy carries to the upgraded unit', () => {
    const e = emptyEcon('t', null)
    e.bench[0] = { definitionId: 'tangela', tier: 1, item: 'metronome' }
    e.bench[1] = { definitionId: 'tangela', tier: 1 }
    e.bench[2] = { definitionId: 'tangela', tier: 1 }
    tryCombine(e)
    const upgraded = e.bench.find(b => b?.definitionId === 'tangela')
    expect(upgraded!.tier).toBe(2)
    expect(upgraded!.item).toBe('metronome')
    expect(e.itemBench).toHaveLength(0)   // nothing spilled
  })

  it('the board-position copy keeps its item after a combine', () => {
    const e = emptyEcon('t', null)
    e.bench[0] = { definitionId: 'zubat', tier: 1 }
    e.bench[1] = { definitionId: 'zubat', tier: 1 }
    e.board = [{ definitionId: 'zubat', tier: 1, hexPos: { col: 3, row: 5 }, item: 'sitrus_berry' }]
    tryCombine(e)
    expect(e.board).toHaveLength(1)
    expect(e.board[0].item).toBe('sitrus_berry')
    expect(e.board[0].hexPos).toEqual({ col: 3, row: 5 })
  })

  it('extra items from multiple held copies return to the item bench', () => {
    const e = emptyEcon('t', null)
    e.bench[0] = { definitionId: 'tangela', tier: 1, item: 'metronome' }
    e.bench[1] = { definitionId: 'tangela', tier: 1, item: 'leftovers' }
    e.bench[2] = { definitionId: 'tangela', tier: 1, item: 'spell_tag' }
    tryCombine(e)
    const upgraded = e.bench.find(b => b?.definitionId === 'tangela')!
    // One item stays on the unit; the other two are preserved in the bench.
    expect(upgraded.item).toBe('metronome')
    expect(e.itemBench.sort()).toEqual(['leftovers', 'spell_tag'])
  })
})
