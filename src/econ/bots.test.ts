import { describe, it, expect, afterEach } from 'vitest'
import { newRun } from './runState'
import { botSeats, botPlanRound, PERSONAS, econBoardPower, personaById, resolveGenome, setGenomeOverrides } from './bots'
import { settleRound } from './income'
import { UNIT_MAP } from '../data/units'
import { boardCap } from './xp'

afterEach(() => setGenomeOverrides(null))

function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// Simulate N solo rounds for one bot: income then plan (alternating W/L)
function runSoloRounds(botIndex: number, rounds: number, seed: number, playerPower = 0) {
  const run = newRun(botSeats())
  const bot = run.players[botIndex]
  const rng = seededRng(seed)
  for (let r = 1; r <= rounds; r++) {
    run.round = r
    settleRound(bot, { won: r % 2 === 0, draw: false, survivorStars: 1, round: r })
    botPlanRound(run, bot, playerPower, rng)
  }
  return { run, bot }
}

describe('bots', () => {
  it('five personas with unique ids and lines', () => {
    expect(PERSONAS).toHaveLength(5)
    expect(new Set(PERSONAS.map(p => p.id)).size).toBe(5)
    expect(personaById('rilla')?.name).toContain('Rilla')
    expect(personaById(null)).toBeNull()
  })

  it('a bot playing 12 rounds levels up and fills its board to cap', () => {
    const { bot } = runSoloRounds(1, 12, 42)
    expect(bot.level).toBeGreaterThanOrEqual(4)
    expect(bot.board.length).toBeGreaterThanOrEqual(Math.min(boardCap(bot), 4))
    expect(bot.board.length).toBeLessThanOrEqual(boardCap(bot))
  })

  it('always fields as many units as its level allows (bodies rule)', () => {
    for (const seed of [3, 17, 51]) {
      const { bot } = runSoloRounds(2, 10, seed)
      const owned = bot.board.length + bot.bench.filter(Boolean).length
      expect(bot.board.length).toBe(Math.min(boardCap(bot), owned))
    }
  })

  it('prefers distinct species over duplicates on the board', () => {
    for (const seed of [8, 23, 77]) {
      const { bot } = runSoloRounds(4, 14, seed)
      const species = new Set(bot.board.map(u => u.definitionId))
      // At most one forced duplicate — distinct units open more trait trees
      expect(species.size).toBeGreaterThanOrEqual(bot.board.length - 1)
    }
  })

  it('boards form trait synergies (some trait has 2+ unique fielded species)', () => {
    const { bot } = runSoloRounds(1, 15, 11)
    const traitSpecies = new Map<string, Set<string>>()
    for (const u of bot.board) {
      for (const t of UNIT_MAP.get(u.definitionId)!.types) {
        if (!traitSpecies.has(t)) traitSpecies.set(t, new Set())
        traitSpecies.get(t)!.add(u.definitionId)
      }
    }
    const best = Math.max(...[...traitSpecies.values()].map(s => s.size))
    expect(best).toBeGreaterThanOrEqual(2)
  })

  it('board positions are valid player-half hexes with no overlaps', () => {
    const { bot } = runSoloRounds(2, 10, 7)
    const seen = new Set<string>()
    for (const u of bot.board) {
      expect(u.hexPos.row).toBeGreaterThanOrEqual(4)
      expect(u.hexPos.row).toBeLessThanOrEqual(7)
      expect(u.hexPos.col).toBeGreaterThanOrEqual(0)
      expect(u.hexPos.col).toBeLessThanOrEqual(6)
      const k = `${u.hexPos.col},${u.hexPos.row}`
      expect(seen.has(k)).toBe(false)
      seen.add(k)
    }
  })


  it('buying depletes the shared pool', () => {
    const { run } = runSoloRounds(1, 8, 5)
    const totalRemaining = Object.values(run.pool).reduce((a, b) => a + b, 0)
    const fresh = newRun(botSeats())
    const totalFresh = Object.values(fresh.pool).reduce((a, b) => a + b, 0)
    expect(totalRemaining).toBeLessThan(totalFresh)
  })

  it('same persona + same seed → identical board (deterministic identity)', () => {
    const a = runSoloRounds(3, 10, 99).bot
    const b = runSoloRounds(3, 10, 99).bot
    expect(a.board).toEqual(b.board)
    expect(a.level).toBe(b.level)
    expect(a.gold).toBe(b.gold)
  })

  it('governor: a far-ahead bot greeds (no rerolls), a far-behind bot pushes', () => {
    // Pin a genome so the spike threshold is known regardless of training:
    // reserve 10 × multiplier 3 → banks up to 30 gold before spiking.
    const personaId = newRun(botSeats()).players[1].personaId!
    setGenomeOverrides({ [personaId]: { ...resolveGenome(personaId), reserve: 10, spikeBankMultiplier: 3 } })

    const run = newRun(botSeats())
    const bot = run.players[1]
    bot.gold = 25          // below the 30g spike threshold → pure greed, banks
    bot.level = 2
    // Full board for its level (greed never overrides the bodies rule)
    bot.board = [
      { definitionId: 'charizard', tier: 2, hexPos: { col: 3, row: 4 } },
      { definitionId: 'rayquaza', tier: 2, hexPos: { col: 2, row: 4 } },
    ]
    const strong = econBoardPower(bot)
    const logGreed = botPlanRound(run, bot, strong * 0.5, seededRng(1))
    expect(logGreed.mode).toBe('greed')
    expect(logGreed.rolls).toBe(0)

    // Now a weak bot against a huge player power → push (rolls with no reserve)
    const bot2 = run.players[2]
    bot2.gold = 30
    bot2.board = [{ definitionId: 'tangela', tier: 1, hexPos: { col: 3, row: 4 } }]
    const logPush = botPlanRound(run, bot2, strong * 4, seededRng(2))
    expect(logPush.mode).toBe('push')
  })

  it('HP-aware rhythm: banked-past-threshold greed spikes; low HP forces desperation spending', () => {
    const personaId = newRun(botSeats()).players[1].personaId!
    setGenomeOverrides({ [personaId]: {
      ...resolveGenome(personaId),
      reserve: 10, spikeBankMultiplier: 3, hpDesperationRatio: 0.35, hpSpikeSafeRatio: 0.65,
    } })

    // Far ahead + healthy + banked past reserve×multiplier → dumps gold (spike round)
    const run = newRun(botSeats())
    const bot = run.players[1]
    bot.gold = 40          // ≥ 30g spike threshold
    bot.level = 2
    bot.board = [
      { definitionId: 'charizard', tier: 2, hexPos: { col: 3, row: 4 } },
      { definitionId: 'rayquaza', tier: 2, hexPos: { col: 2, row: 4 } },
    ]
    const strong = econBoardPower(bot)
    const logSpike = botPlanRound(run, bot, strong * 0.5, seededRng(1))
    expect(logSpike.mode).toBe('greed')
    expect(logSpike.rolls).toBeGreaterThan(0)

    // Nearly dead → reserve is ignored entirely, spends down even in greed.
    // targetLevel pinned to 2 so XP buying doesn't consume the gold first —
    // this case is about the roll reserve being zeroed.
    setGenomeOverrides({ [personaId]: {
      ...resolveGenome(personaId),
      reserve: 10, spikeBankMultiplier: 3, hpDesperationRatio: 0.35, hpSpikeSafeRatio: 0.65,
      targetLevel: 2,
    } })
    const run2 = newRun(botSeats())
    const bot2 = run2.players[1]
    bot2.gold = 25         // below spike threshold — only desperation explains rolling
    bot2.hp = 20           // 20% < 35% desperation threshold
    bot2.level = 2
    bot2.board = [
      { definitionId: 'charizard', tier: 2, hexPos: { col: 3, row: 4 } },
      { definitionId: 'rayquaza', tier: 2, hexPos: { col: 2, row: 4 } },
    ]
    const logDesp = botPlanRound(run2, bot2, econBoardPower(bot2) * 0.5, seededRng(1))
    expect(logDesp.mode).toBe('greed')
    expect(logDesp.rolls).toBeGreaterThan(0)
  })

  it('eliminated bots do nothing', () => {
    const run = newRun(botSeats())
    const bot = run.players[1]
    bot.eliminated = true
    bot.gold = 50
    const log = botPlanRound(run, bot, 10, seededRng(3))
    expect(log.bought).toHaveLength(0)
    expect(bot.gold).toBe(50)
  })

  it('bot shopping visibly drains the shared pool, with real species contention', () => {
    const run = newRun(botSeats())
    const rng = seededRng(13)
    const freshTotal = Object.values(run.pool).reduce((a, b) => a + b, 0)
    for (let r = 1; r <= 12; r++) {
      run.round = r
      for (const i of [1, 2]) {
        settleRound(run.players[i], { won: r % 2 === 0, draw: false, survivorStars: 1, round: r })
        botPlanRound(run, run.players[i], 0, rng)
      }
    }
    const total = Object.values(run.pool).reduce((a, b) => a + b, 0)
    expect(freshTotal - total).toBeGreaterThanOrEqual(10)   // two bots buying for 12 rounds
    // Star-up chasing concentrates buys: some species should be down 3+ copies
    const maxDrain = Math.max(...Object.entries(run.pool).map(([id, n]) => {
      const def = UNIT_MAP.get(id)!
      return (def.cost === 1 ? 30 : def.cost === 2 ? 25 : def.cost === 3 ? 18 : def.cost === 4 ? 10 : 9) - n
    }))
    expect(maxDrain).toBeGreaterThanOrEqual(3)
  })
})
