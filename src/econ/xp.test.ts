import { describe, it, expect } from 'vitest'
import { emptyEcon } from './runState'
import { grantXp, buyXp, xpToNext, boardCap } from './xp'
import { MAX_LEVEL, XP_BUY_COST } from './constants'

describe('xp / leveling', () => {
  it('xpToNext follows the table and is null at cap', () => {
    expect(xpToNext(1)).toBe(4)
    expect(xpToNext(5)).toBe(16)
    expect(xpToNext(9)).toBe(64)
    expect(xpToNext(MAX_LEVEL)).toBeNull()
  })

  it('grantXp levels up with overflow carrying over', () => {
    const e = emptyEcon('t', null)   // level 1
    const gained = grantXp(e, 9)     // L1→2 costs 4, L2→3 costs 4 → level 3 with 1 xp left
    expect(gained).toBe(2)
    expect(e.level).toBe(3)
    expect(e.xp).toBe(1)
  })

  it('grantXp can jump multiple levels from one large grant', () => {
    const e = emptyEcon('t', null)
    grantXp(e, 4 + 4 + 4 + 8)        // exactly to level 5
    expect(e.level).toBe(5)
    expect(e.xp).toBe(0)
  })

  it('xp is discarded at max level', () => {
    const e = emptyEcon('t', null)
    e.level = MAX_LEVEL
    grantXp(e, 50)
    expect(e.level).toBe(MAX_LEVEL)
    expect(e.xp).toBe(0)
  })

  it('buyXp charges gold and grants 4 xp', () => {
    const e = emptyEcon('t', null)
    e.gold = 10
    expect(buyXp(e)).toBe(true)      // 4 xp exactly clears L1→2 (4)
    expect(e.gold).toBe(10 - XP_BUY_COST)
    expect(e.level).toBe(2)
    expect(e.xp).toBe(0)
  })

  it('buyXp refuses without gold or at cap', () => {
    const e = emptyEcon('t', null)
    e.gold = 3
    expect(buyXp(e)).toBe(false)
    e.gold = 100
    e.level = MAX_LEVEL
    expect(buyXp(e)).toBe(false)
    expect(e.gold).toBe(100)
  })

  it('boardCap equals level', () => {
    const e = emptyEcon('t', null)
    e.level = 7
    expect(boardCap(e)).toBe(7)
  })
})
