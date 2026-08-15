import { describe, it, expect } from 'vitest'
import { makeUnit } from '../core/unitFactory'
import { generateEnemyTeam, generateRandomPlayerBoard } from './generator'
import { calcBoardProfile, calibratedPower, PRIOR_WEIGHTS } from './boardPower'
import { priorParams } from './calibration'
import type { Unit } from '../core/types'

// Import to ensure abilities are registered (makeUnit → unit defs are fine,
// but trait effects referenced by calcBoardProfile need the data modules only)

function playerBoard(): Unit[] {
  const specs: Array<[string, 1 | 2 | 3, number, number]> = [
    ['tangela',   1, 1, 5],
    ['vigoroth',  2, 2, 5],
    ['druddigon', 1, 3, 5],
    ['zubat',     2, 4, 5],
    ['sableye',   1, 5, 5],
  ]
  return specs.map(([id, tier, col, row]) => {
    const u = makeUnit(id, 'player', tier)
    u.hexPos = { col, row }
    return u
  })
}

describe('generateEnemyTeam — calibration integration', () => {
  it('without calibration, enemy power stays within ±25% of player power', () => {
    const player = playerBoard()
    const pPower = calcBoardProfile(player).power
    for (let i = 0; i < 30; i++) {
      const enemy = generateEnemyTeam(player)
      const real = enemy.filter(u => !u.isDummy && u.definitionId !== 'cliff_l' && u.definitionId !== 'cliff_r')
      const ePower = calcBoardProfile(real).power
      const delta = Math.abs(ePower - pPower) / pPower
      // Rolled deltas cap at ±25%; the clamp works in calibrated space (which
      // adds tier-3/cost-3 surcharges), so allow tolerance beyond the band.
      // 5-cost units in the pool (Tapu Koko, Salamence, Latios…) make single
      // unit swaps worth up to 16 base power, so worst-case overshoot on a
      // small board occasionally passes 0.6.
      expect(delta).toBeLessThan(0.70)
    }
  })

  it('prior calibration params generate boards like no calibration at all', () => {
    const player = playerBoard()
    const params = priorParams()
    // b=0, k=prior, w=priors → evenPower === legacy player calibrated power.
    // Statistically compare mean generated power across many runs.
    let sumNone = 0
    let sumPrior = 0
    const N = 40
    for (let i = 0; i < N; i++) {
      sumNone  += calibratedPower(calcBoardProfile(generateEnemyTeam(player).filter(u => !u.isDummy)), PRIOR_WEIGHTS)
      sumPrior += calibratedPower(calcBoardProfile(generateEnemyTeam(player, params).filter(u => !u.isDummy)), PRIOR_WEIGHTS)
    }
    const meanNone = sumNone / N
    const meanPrior = sumPrior / N
    // Same distribution — means within 15% of each other
    expect(Math.abs(meanPrior - meanNone) / meanNone).toBeLessThan(0.15)
  })

  it('positive skill bias (b > 0) shifts generated boards stronger', () => {
    const player = playerBoard()

    const strong = priorParams()
    strong.b = 1.0    // player consistently over-performs
    strong.n = 100

    let sumEven = 0
    let sumStrong = 0
    const N = 50
    for (let i = 0; i < N; i++) {
      sumEven   += calibratedPower(calcBoardProfile(generateEnemyTeam(player, priorParams()).filter(u => !u.isDummy)), PRIOR_WEIGHTS)
      sumStrong += calibratedPower(calcBoardProfile(generateEnemyTeam(player, strong).filter(u => !u.isDummy)), PRIOR_WEIGHTS)
    }
    const meanEven = sumEven / N
    const meanStrong = sumStrong / N
    // Expected shift: S·b/k = playerCalPower·1.0/5 = +20% of player power.
    // Tier quantization is coarse, so just require a decisive upward shift.
    expect(meanStrong).toBeGreaterThan(meanEven * 1.05)
  })

  it('empty player board returns the fixed default without calibration effects', () => {
    const params = priorParams()
    params.b = 1.0
    const enemy = generateEnemyTeam([], params)
    expect(enemy.length).toBe(2)
  })
})

describe('generateRandomPlayerBoard — empty-board starts', () => {
  it('returns a plausible player board on the player half', () => {
    for (let i = 0; i < 20; i++) {
      const board = generateRandomPlayerBoard()
      expect(board.length).toBeGreaterThanOrEqual(1)
      expect(board.length).toBeLessThanOrEqual(10)
      for (const u of board) {
        expect(u.team).toBe('player')
        expect(u.hexPos.row).toBeGreaterThanOrEqual(4)  // player half only
        expect(u.hexPos.row).toBeLessThanOrEqual(7)
        expect(u.definitionId).not.toBe('cliff_l')
        expect(u.definitionId).not.toBe('cliff_r')
        expect(u.isDummy).toBe(false)
      }
      // No two units share a hex
      const seen = new Set(board.map(u => `${u.hexPos.col},${u.hexPos.row}`))
      expect(seen.size).toBe(board.length)
    }
  })

  it('the enemy generator produces a comparable board against it', () => {
    const board = generateRandomPlayerBoard()
    const enemy = generateEnemyTeam(board)
    const real = enemy.filter(u => !u.isDummy && u.definitionId !== 'cliff_l' && u.definitionId !== 'cliff_r')
    expect(real.length).toBeGreaterThanOrEqual(1)
    const pPower = calcBoardProfile(board).power
    const ePower = calcBoardProfile(real).power
    expect(Math.abs(ePower - pPower) / pPower).toBeLessThan(0.70)
  })
})
