import { describe, it, expect } from 'vitest'
import { emptyEcon } from './runState'
import { settleRound } from './income'

function freshEcon(gold = 0, streak = 0) {
  const e = emptyEcon('t', null)
  e.gold = gold
  e.streak = streak
  return e
}

describe('income / settleRound', () => {
  it('early rounds ramp base income 2/3/4 then cap at 5', () => {
    expect(settleRound(freshEcon(), { won: true, draw: false, survivorStars: 0, round: 1 }).base).toBe(2)
    expect(settleRound(freshEcon(), { won: true, draw: false, survivorStars: 0, round: 2 }).base).toBe(3)
    expect(settleRound(freshEcon(), { won: true, draw: false, survivorStars: 0, round: 3 }).base).toBe(4)
    expect(settleRound(freshEcon(), { won: true, draw: false, survivorStars: 0, round: 4 }).base).toBe(5)
    expect(settleRound(freshEcon(), { won: true, draw: false, survivorStars: 0, round: 30 }).base).toBe(5)
  })

  it('interest is computed on gold held BEFORE payout, capped at 5', () => {
    const e = freshEcon(37)
    const s = settleRound(e, { won: false, draw: false, survivorStars: 1, round: 10 })
    expect(s.interest).toBe(3)
    const rich = freshEcon(80)
    expect(settleRound(rich, { won: false, draw: false, survivorStars: 1, round: 10 }).interest).toBe(5)
  })

  it('win pays +1 and extends win streaks; streak gold on the new streak', () => {
    const e = freshEcon(0, 2)   // two straight wins already
    const s = settleRound(e, { won: true, draw: false, survivorStars: 0, round: 10 })
    expect(s.winGold).toBe(1)
    expect(s.newStreak).toBe(3)
    expect(s.streakGold).toBe(1)   // 3-streak pays
  })

  it('loss flips a win streak to -1 and loss streaks also pay', () => {
    const e = freshEcon(0, 4)
    const s1 = settleRound(e, { won: false, draw: false, survivorStars: 2, round: 10 })
    expect(s1.newStreak).toBe(-1)
    expect(s1.streakGold).toBe(0)
    e.streak = -4
    const s2 = settleRound(e, { won: false, draw: false, survivorStars: 2, round: 10 })
    expect(s2.newStreak).toBe(-5)
    expect(s2.streakGold).toBe(2)
  })

  it('draw resets streak, no win gold, no hp loss', () => {
    const e = freshEcon(0, 5)
    e.hp = 50
    const s = settleRound(e, { won: false, draw: true, survivorStars: 3, round: 10 })
    expect(s.newStreak).toBe(0)
    expect(s.winGold).toBe(0)
    expect(s.hpLost).toBe(0)
    expect(e.hp).toBe(50)
  })

  it('loss costs hp by stage base + survivor stars and can eliminate', () => {
    const e = freshEcon()
    e.hp = 5
    const s = settleRound(e, { won: false, draw: false, survivorStars: 4, round: 12 })  // stage 3: base 1 + 4 stars
    expect(s.hpLost).toBe(5)
    expect(e.hp).toBe(0)
    expect(s.eliminated).toBe(true)
    expect(e.eliminated).toBe(true)
  })

  it('grants 2 passive xp and reports level-ups', () => {
    const e = freshEcon()          // level 1; L1→2 costs 4, so one round of passive xp isn't enough yet
    const s = settleRound(e, { won: true, draw: false, survivorStars: 0, round: 1 })
    expect(s.xpGained).toBe(2)
    expect(s.levelsGained).toBe(0)
    expect(e.level).toBe(1)
    expect(e.xp).toBe(2)

    const s2 = settleRound(e, { won: true, draw: false, survivorStars: 0, round: 2 })   // second round's 2 xp clears it
    expect(s2.levelsGained).toBe(1)
    expect(e.level).toBe(2)
  })

  it('total = base + interest + streak + win and is added to gold', () => {
    const e = freshEcon(23, 2)     // interest 2; win → streak 3 pays 1; base r10 = 5; win +1
    const s = settleRound(e, { won: true, draw: false, survivorStars: 0, round: 10 })
    expect(s.total).toBe(5 + 2 + 1 + 1)
    expect(e.gold).toBe(23 + s.total)
  })
})
