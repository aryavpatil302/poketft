import { describe, it, expect } from 'vitest'
import {
  SHOP_ODDS, POOL_COPIES, XP_TO_NEXT, MAX_LEVEL,
  streakBonus, sellValue, copiesHeld, hpLoss, stageLabel,
} from './constants'

describe('econ constants', () => {
  it('every shop odds row sums to 100', () => {
    for (const [level, row] of Object.entries(SHOP_ODDS)) {
      const sum = row.reduce((a, b) => a + b, 0)
      expect(sum, `level ${level}`).toBe(100)
    }
  })

  it('shop odds exist for every reachable level', () => {
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      expect(SHOP_ODDS[lvl]).toBeDefined()
    }
  })

  it('4-costs unlock at level 5, 5-costs at level 7 (TFT gating)', () => {
    expect(SHOP_ODDS[4][3]).toBe(0)
    expect(SHOP_ODDS[5][3]).toBeGreaterThan(0)
    expect(SHOP_ODDS[6][4]).toBe(0)
    expect(SHOP_ODDS[7][4]).toBeGreaterThan(0)
  })

  it('XP table covers L1→2 through L9→10', () => {
    expect(XP_TO_NEXT).toHaveLength(MAX_LEVEL - 1)
    expect(XP_TO_NEXT[0]).toBe(4)
    expect(XP_TO_NEXT[XP_TO_NEXT.length - 1]).toBe(64)
  })

  it('pool copies per cost', () => {
    expect(POOL_COPIES).toEqual({ 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 })
  })

  it('streak bonuses (win or loss)', () => {
    expect(streakBonus(0)).toBe(0)
    expect(streakBonus(2)).toBe(0)
    expect(streakBonus(3)).toBe(1)
    expect(streakBonus(4)).toBe(1)
    expect(streakBonus(5)).toBe(2)
    expect(streakBonus(6)).toBe(3)
    expect(streakBonus(9)).toBe(3)
    expect(streakBonus(-4)).toBe(1)   // loss streaks pay too
    expect(streakBonus(-6)).toBe(3)
  })

  it('sell values: 1★ full cost, upgrades carry the 1g penalty', () => {
    expect(sellValue(1, 1)).toBe(1)
    expect(sellValue(1, 2)).toBe(2)
    expect(sellValue(1, 3)).toBe(8)
    expect(sellValue(3, 2)).toBe(8)
    expect(sellValue(4, 2)).toBe(11)
    expect(sellValue(5, 1)).toBe(5)
    expect(sellValue(2, 3)).toBe(17)
  })

  it('copiesHeld: 1/3/9 by star', () => {
    expect(copiesHeld(1)).toBe(1)
    expect(copiesHeld(2)).toBe(3)
    expect(copiesHeld(3)).toBe(9)
  })

  it('hpLoss = stage base + survivor star levels (TFT formula)', () => {
    // Stage 1 = rounds 1-3, then 6 rounds per stage (2 = 4-9, 3 = 10-15, …)
    expect(hpLoss(1, 3)).toBe(3)      // stage 1: base 0 + 3 stars
    expect(hpLoss(4, 3)).toBe(3)      // stage 2: base 0
    expect(hpLoss(10, 3)).toBe(4)     // stage 3: base 1
    expect(hpLoss(16, 3)).toBe(5)     // stage 4: base 2
    expect(hpLoss(22, 3)).toBe(11)    // stage 5: base 8
    expect(hpLoss(28, 3)).toBe(18)    // stage 6: base 15
    expect(hpLoss(34, 3)).toBe(33)    // stage 7: base 30
    expect(hpLoss(99, 3)).toBe(33)    // base caps at the last stage entry
    expect(hpLoss(1, 0)).toBe(0)
    // A surviving 3★ hurts 3× a surviving 1★
    expect(hpLoss(10, 9) - hpLoss(10, 3)).toBe(6)
  })

  it('stage labels', () => {
    expect(stageLabel(1)).toBe('1-1')
    expect(stageLabel(3)).toBe('1-3')   // Delibird opener
    expect(stageLabel(4)).toBe('2-1')
    expect(stageLabel(9)).toBe('2-6')   // Delibird
    expect(stageLabel(10)).toBe('3-1')
    expect(stageLabel(15)).toBe('3-6')  // Delibird
  })
})
