import { describe, it, expect, afterEach } from 'vitest'
import { newRun, type BenchedUnit } from './runState'
import { botSeats, botPlanRound, PERSONAS, econBoardPower, personaById, resolveGenome, setGenomeOverrides, botCanAttemptBuy, scoreUnit, applyBenchHygiene, chooseFielded, pickRerollTarget } from './bots'
import { settleRound } from './income'
import { UNIT_MAP } from '../data/units'
import { boardCap } from './xp'
import { shinyPrice } from './constants'

// Builds a fixed-length (9-slot) bench array from a short list of units,
// padding the rest with null — mirrors the shape of a real PlayerEcon.bench.
function mkBench(units: BenchedUnit[]): (BenchedUnit | null)[] {
  const bench: (BenchedUnit | null)[] = Array(9).fill(null)
  units.forEach((u, i) => { bench[i] = u })
  return bench
}

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
      // At most two forced duplicates — distinct units open more trait trees.
      // Tolerance is 2 (not 1) because tempo-aware leveling (bots.ts's
      // near-miss catalog bump) can now jump boardCap up faster than usual in
      // a single round, briefly outpacing how many distinct fresh picks are
      // available that same round.
      expect(species.size).toBeGreaterThanOrEqual(bot.board.length - 2)
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

  describe('botCanAttemptBuy — shiny awareness', () => {
    it('refuses a shiny slot when gold clears the normal price but not shinyPrice; the same gold clears the non-shiny control', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      econ.shop = ['tangela', null, null, null, null]
      econ.shopShiny = [true, false, false, false, false]
      econ.gold = 2   // clears tangela's cost (1) but misses shinyPrice(1) = 3
      econ.bench = Array(9).fill(null)
      econ.board = []
      expect(botCanAttemptBuy(econ, 0)).toBe(false)

      econ.shopShiny = [false, false, false, false, false]   // non-shiny control, same gold
      expect(botCanAttemptBuy(econ, 0)).toBe(true)
    })

    it('refuses a shiny slot when the bench is full and 2 tier-1 copies are held (wouldCombine would be true); the same setup is allowed when not shiny', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      econ.shop = ['tangela', null, null, null, null]
      econ.shopShiny = [true, false, false, false, false]
      econ.gold = 99
      // Full bench: 2 tangela tier-1 copies (would combine on a 3rd) plus filler.
      econ.bench = [
        { definitionId: 'tangela', tier: 1 },
        { definitionId: 'tangela', tier: 1 },
        ...Array(7).fill(null).map(() => ({ definitionId: 'charizard', tier: 1 as const })),
      ]
      econ.board = []
      expect(botCanAttemptBuy(econ, 0)).toBe(false)

      econ.shopShiny = [false, false, false, false, false]   // non-shiny control, same bench/gold
      expect(botCanAttemptBuy(econ, 0)).toBe(true)
    })
  })

  describe('scoreUnit — shiny valuation', () => {
    it('ranks a shiny slot strictly above the same non-shiny unit on a fresh econ (every other arg identical)', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)
      econ.bench = Array(9).fill(null)   // empty — keeps hasEstablishedComp false, starUpMult at 1
      econ.board = []
      // Backward-compatible: shinyTrait not passed, defaults to null — confirms
      // existing call sites (and this pre-existing regression test) still work
      // unmodified after adding the 14th param.
      const normalScore = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, undefined, false, 0, false, Math.random, undefined, undefined, false)
      const shinyScore = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, undefined, false, 0, false, Math.random, undefined, undefined, true)
      expect(shinyScore).toBeGreaterThan(normalScore)
    })
  })

  describe('scoreUnit — comp-aware shiny valuation (shinyTrait)', () => {
    // tangela: cost 1, types ['jungle', 'stalwart'].  jungle thresholds are
    // [3, 5, 7] — at have=0 a shiny (counts as +2 species) reaches 2, which
    // crosses nothing, so this isolates the comp-fit bonus with no
    // breakpoint-cross noise. ribombee is a second, distinct jungle species
    // (cost 1, types ['jungle', 'promoter']) used below to seed have=1.
    it('comp-fit bonus: shinyTrait matching a priorityTraits entry scores strictly higher than shinyTrait=null (species/cost/every other arg held constant)', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)
      econ.bench = Array(9).fill(null)   // have=0 for jungle — no breakpoint cross possible
      econ.board = []
      const priorityJungle = new Map([['jungle', 1.0]])
      const withTrait = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, priorityJungle, false, 0, false, Math.random, undefined, undefined, true, 'jungle')
      const withoutTrait = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, priorityJungle, false, 0, false, Math.random, undefined, undefined, true, null)
      expect(withTrait).toBeGreaterThan(withoutTrait)
      // Isolated delta should be exactly the comp-fit bonus (priorityTraits
      // held constant across both calls, so the pre-existing generic
      // per-trait nudge fires identically in both and cancels out).
      expect(withTrait - withoutTrait).toBeCloseTo(genome.shinyPriorityFitBonus * 1.0, 5)
    })

    it('breakpoint-cross bonus: crossing a real threshold scores strictly higher than merely matching a priorityTraits entry without crossing', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)
      // Seed have=1 for jungle via a second distinct species (ribombee) so
      // buying the tangela shiny (+2 species toward jungle) reaches 3 —
      // crossing the first jungle threshold — while an ordinary buy
      // (have+1=2) would not.
      econ.bench = Array(9).fill(null)
      econ.bench[0] = { definitionId: 'ribombee', tier: 1 }
      econ.board = []
      // priorityTraits deliberately empty so the comp-fit bonus (and the
      // pre-existing generic nudge) never fires — isolates the breakpoint
      // bonus alone.
      const crossing = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, new Map(), false, 0, false, Math.random, undefined, undefined, true, 'jungle')
      const notCrossing = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, new Map(), false, 0, false, Math.random, undefined, undefined, true, null)
      expect(crossing).toBeGreaterThan(notCrossing)
      expect(crossing - notCrossing).toBeCloseTo(genome.shinyBreakpointBonus, 5)

      // And per the design intent (breakpoint-crossing is the stronger
      // signal): a real breakpoint cross outscores a fit-only match on a
      // fresh econ with no crossing available.
      econ.bench = Array(9).fill(null)   // have=0 — comp-fit only, no crossing
      const priorityJungle = new Map([['jungle', 1.0]])
      const fitOnly = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, priorityJungle, false, 0, false, Math.random, undefined, undefined, true, 'jungle')
      expect(crossing).toBeGreaterThan(fitOnly)
    })

    it('both bonuses stack additively: matching a priority trait AND crossing a breakpoint scores strictly higher than either alone', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)
      econ.bench = Array(9).fill(null)
      econ.bench[0] = { definitionId: 'ribombee', tier: 1 }   // have=1 for jungle — this buy crosses
      econ.board = []
      const priorityJungle = new Map([['jungle', 1.0]])

      const breakpointOnly = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, new Map(), false, 0, false, Math.random, undefined, undefined, true, 'jungle')
      const fitAndNudgeOnly = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, priorityJungle, false, 0, false, Math.random, undefined, undefined, true, null)
      const both = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, priorityJungle, false, 0, false, Math.random, undefined, undefined, true, 'jungle')

      // Both new if-statements fired independently (verified explicitly, per
      // the task's own emphasis): the combined score beats each single-bonus
      // variant, not just matches one of them.
      expect(both).toBeGreaterThan(breakpointOnly)
      expect(both).toBeGreaterThan(fitAndNudgeOnly)
    })
  })

  describe('applyBenchHygiene — staleCheapStar shiny exemption', () => {
    it('never sells a shiny bench slot even when every other staleCheapStar condition is met; a non-shiny stale-cheap-2★ in the same run can still be sold', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)

      // Stage >= 5, no reroll target, tier 2, cost <= 2 for both — the exact
      // staleCheapStar carve-out condition — but one is shiny.
      econ.bench = [
        { definitionId: 'tangela', tier: 2, isShiny: true, chosenTrait: 'jungle' },
        { definitionId: 'ribombee', tier: 2 },
        ...Array(7).fill(null).map(() => ({ definitionId: 'charizard', tier: 1 as const })),
      ]
      econ.board = []

      applyBenchHygiene(run, econ, persona, genome, null, 0, new Map(), false, 5, false, Math.random, undefined, undefined)

      expect(econ.bench[0]).not.toBeNull()
      expect(econ.bench[0]?.definitionId).toBe('tangela')
      expect(econ.bench[0]?.isShiny).toBe(true)
      expect(econ.bench[1]).toBeNull()   // the non-shiny stale-cheap-2★ was sellable and got sold
    })
  })

  describe('tempo-aware leveling (near-miss catalog spike)', () => {
    // "carry|latios|var|charizard" (charizard + latios, latios cost 5 → needs
    // level 9) is a real two-core catalog entry. Owning charizard already
    // (bench) puts the bot exactly one piece away from it.
    it('bumps the level target to chase a real one-piece-away spike', () => {
      const run = newRun(botSeats())
      const bot = run.players[1]
      bot.gold = 1000
      bot.bench[0] = { definitionId: 'charizard', tier: 1 }
      run.round = 1
      botPlanRound(run, bot, 0, seededRng(1))
      expect(bot.level).toBeGreaterThanOrEqual(9)
    })

    it('does not chase the level jump without the partial comp owned', () => {
      const run = newRun(botSeats())
      const bot = run.players[1]
      bot.gold = 1000
      run.round = 1
      botPlanRound(run, bot, 0, seededRng(1))
      expect(bot.level).toBeLessThan(9)
    })

    it('does not chase the level jump if no near-miss piece is left in the pool', () => {
      const run = newRun(botSeats())
      const bot = run.players[1]
      bot.gold = 1000
      bot.bench[0] = { definitionId: 'charizard', tier: 1 }
      // Charizard co-occurs with several other 4/5-costs across the catalog
      // (darmanitan, latios, typhlosion, ...), so zero the WHOLE pool rather
      // than just latios — otherwise a different near-miss path still fires.
      for (const id in run.pool) run.pool[id] = 0
      run.round = 1
      botPlanRound(run, bot, 0, seededRng(1))
      expect(bot.level).toBeLessThan(9)
    })
  })

  describe('scoreUnit — shiny direction-pivot', () => {
    // tangela: cost 1, types ['jungle', 'stalwart'], role 'tank'.
    // kingler + a_raichu: both 'beachy' — an established comp that shares
    // NOTHING with tangela's own traits (off-roster). ribombee is a second
    // jungle species, added to make tangela connect.
    const offRosterBench = () => mkBench([
      { definitionId: 'kingler', tier: 1 },
      { definitionId: 'a_raichu', tier: 1 },
    ])
    const connectingBench = () => mkBench([
      { definitionId: 'kingler', tier: 1 },
      { definitionId: 'a_raichu', tier: 1 },
      { definitionId: 'ribombee', tier: 1 },
    ])

    it('off-roster discount no longer applies to a shiny buy; a non-shiny control in the identical scenario is still discounted', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)
      const def = UNIT_MAP.get('tangela')!
      const score = (shiny: boolean) =>
        scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, undefined, false, 0, false, Math.random, undefined, undefined, shiny)

      // Delta-isolation: within one fixed econ, the general trait-synergy
      // loop, learned bonuses, and persona bias are identical between a
      // shiny and non-shiny call for the same defId (none of those blocks
      // read `shiny`) — subtracting cancels them out, leaving exactly the
      // shiny-block's own contribution (here: the star-completion term,
      // since no items/priorityTraits/shinyTrait are in play).
      econ.board = []
      econ.bench = offRosterBench()
      const offRosterDelta = score(true) - score(false)

      econ.bench = connectingBench()
      const connectingDelta = score(true) - score(false)

      // Shiny star-up contribution is now identical regardless of whether
      // the roster already connects — off-roster no longer halves it.
      expect(offRosterDelta).toBeCloseTo(connectingDelta, 5)
      const expectedShinyTerm = (genome.starCompleteBonus + def.cost * 1.6) * 1 - (shinyPrice(def.cost) - def.cost)
      expect(offRosterDelta).toBeCloseTo(expectedShinyTerm, 5)

      // Regression: the non-shiny star-up terms are STILL discounted
      // off-roster (fix #1 is scoped to the shiny branch only). Isolate the
      // pair-forming term (copies1 === 1) the same way, with vs. without an
      // existing bench copy. Adding that copy also makes the general
      // trait-synergy loop's dedup check (`owned.get(t)?.has(defId)`) start
      // skipping tangela's own traits (they're now "already owned"), which
      // otherwise-identical off-roster/connecting econs lose differently —
      // jungle+stalwart both open-tree (off-roster) vs. jungle
      // progressing+stalwart open-tree (connecting, jungle already has
      // ribombee) — so both known corrections are subtracted explicitly.
      econ.board = []
      econ.bench = offRosterBench()
      const offRosterNoPair = score(false)
      econ.bench = mkBench([{ definitionId: 'tangela', tier: 1 }, { definitionId: 'kingler', tier: 1 }, { definitionId: 'a_raichu', tier: 1 }])
      const offRosterWithPair = score(false)
      const offRosterPairDelta = offRosterWithPair - offRosterNoPair
      const offRosterDedupLoss = 2 * genome.traitOpenBonus   // jungle + stalwart both open-tree, both skipped once owned
      expect(offRosterPairDelta).toBeCloseTo((genome.starPairBonus + def.cost * 0.5) * 0.5 - offRosterDedupLoss, 5)

      econ.bench = connectingBench()
      const connectingNoPair = score(false)
      econ.bench = mkBench([{ definitionId: 'tangela', tier: 1 }, { definitionId: 'kingler', tier: 1 }, { definitionId: 'a_raichu', tier: 1 }, { definitionId: 'ribombee', tier: 1 }])
      const connectingWithPair = score(false)
      const connectingPairDelta = connectingWithPair - connectingNoPair
      const connectingDedupLoss = genome.traitProgressBonus + genome.traitOpenBonus   // jungle (already has ribombee) progresses, stalwart opens — both skipped once owned
      expect(connectingPairDelta).toBeCloseTo((genome.starPairBonus + def.cost * 0.5) * 1 - connectingDedupLoss, 5)
      // The core claim either way: off-roster still applies the 0.5
      // discount to the non-shiny pair term, unlike the shiny case above.
      expect(offRosterPairDelta).toBeLessThan(connectingPairDelta)
    })

    it('item-fit bonus: a shiny scores higher when the bot owns an item that fits its role well', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)
      econ.bench = Array(9).fill(null)
      econ.board = []

      // tangela's role is 'tank'. assault_vest (+100 HP, +35 Sp. Defense,
      // categories: ['tank']) is a strong tank fit; spell_tag (+10/+10
      // atk/special, categories: ['attack caster','special caster']) is a
      // poor fit for a tank — near-zero raw stat weight, no category match.
      econ.itemBench = []
      const noItems = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, undefined, false, 0, false, Math.random, undefined, undefined, true)

      econ.itemBench = ['spell_tag']
      const poorFit = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, undefined, false, 0, false, Math.random, undefined, undefined, true)

      econ.itemBench = ['assault_vest']
      const goodFit = scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, undefined, false, 0, false, Math.random, undefined, undefined, true)

      expect(goodFit).toBeGreaterThan(noItems)
      expect(goodFit).toBeGreaterThan(poorFit)
      // itemFitScore(assault_vest, 'tank') = hp*0.06 + spDefense + category(+25)
      //   = 100*0.06 + 35 + 25 = 66 → normalized /25 = 2.64
      expect(goodFit - noItems).toBeCloseTo(genome.shinyItemFitBonus * (66 / 25), 5)
    })

    it('no-direction bonus: a fresh econ with no established comp scores higher than the same shiny forced into an established-but-unconnected context', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(persona.id)
      const score = (shiny: boolean) =>
        scoreUnit(econ, persona, genome, 'tangela', undefined, 0, false, undefined, false, 0, false, Math.random, undefined, undefined, shiny)

      // Delta-isolation (same technique as the off-roster test above): within
      // each econ, subtracting the non-shiny score from the shiny score
      // cancels every term that doesn't depend on `shiny`, leaving exactly
      // the shiny-block's contribution. Per fix #1, the star term itself is
      // now identical (shinyStarUpMult always 1) regardless of
      // hasEstablishedComp — so the ONLY difference left between the two
      // deltas is the no-direction bonus.
      econ.board = []
      econ.bench = Array(9).fill(null)   // hasEstablishedComp === false
      const freshDelta = score(true) - score(false)

      econ.bench = offRosterBench()      // hasEstablishedComp === true, off-roster
      const establishedDelta = score(true) - score(false)

      expect(freshDelta).toBeGreaterThan(establishedDelta)
      expect(freshDelta - establishedDelta).toBeCloseTo(genome.shinyNoDirectionBonus, 5)
    })
  })

  describe('chooseFielded — shiny chosenTrait breakpoint bump', () => {
    it('fields a benched shiny over a same-power non-shiny alternative when only the shiny crosses a breakpoint', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById('kass')!   // lines share no trait with tangela/kingler below
      econ.level = 1   // boardCap === 1: a single decisive pick
      econ.board = []
      // stalwart's first threshold is 2 — at have=0, a shiny's chosenTrait
      // (+2 species via the bump) reaches it immediately; a non-shiny
      // candidate (+1) does not. Both units are tier 2 (same unitPowerScore)
      // so the only scoring difference is the breakpoint-cross bonus.
      econ.bench = mkBench([
        { definitionId: 'tangela', tier: 2, isShiny: true, chosenTrait: 'stalwart' },
        { definitionId: 'kingler', tier: 2 },
      ])
      const picked = chooseFielded(econ, persona, 0)
      expect(picked).toHaveLength(1)
      expect(picked[0].definitionId).toBe('tangela')
    })

    it('bump collapses to the pre-existing behavior for non-shiny candidates (regression)', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById('kass')!
      econ.level = 2   // boardCap === 2: an anchor pick, then one decisive pick
      econ.board = []
      // torkoal (anchor, tier 2 — picked first on raw power) establishes
      // stalwart at have=1. In the second pick, a non-shiny stalwart
      // candidate (tangela, bump=1) reaches have+1=2 — crossing the same
      // threshold — and should be preferred over a same-power rival
      // (kingler) that shares no trait at all.
      econ.bench = mkBench([
        { definitionId: 'torkoal', tier: 2 },
        { definitionId: 'tangela', tier: 1 },
        { definitionId: 'kingler', tier: 1 },
      ])
      const picked = chooseFielded(econ, persona, 0)
      expect(picked).toHaveLength(2)
      const ids = picked.map(p => p.definitionId)
      expect(ids).toContain('torkoal')
      expect(ids).toContain('tangela')
      expect(ids).not.toContain('kingler')
    })
  })

  // At most one Shiny may be FIELDED per team (see hasFieldedShiny in
  // src/econ/runState.ts). The human path enforces this in round.ts's moveUnit;
  // bots never issue moveUnit actions — botPlanRound rebuilds econ.board
  // wholesale via chooseFielded -> positionFielded — so the cap has to hold
  // inside chooseFielded itself. Owning two shinies is legal and expected
  // (rollShop's pity cadence keeps offering Chosen units while one is owned),
  // so these tests seed two and assert only one reaches the board.
  describe('chooseFielded — at most one shiny fielded', () => {
    it('picks only one of two benched shinies, filling the freed slot with a non-shiny', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById('kass')!
      econ.level = 2   // boardCap === 2
      econ.board = []
      // Both shinies are cost-5 tier-2, so on raw unitPowerScore they outbid
      // the cost-1 control by a wide margin. Unguarded, chooseFielded takes
      // both and ribombee never gets a slot.
      econ.bench = mkBench([
        { definitionId: 'charizard', tier: 2, isShiny: true, chosenTrait: 'volcanic' },
        { definitionId: 'latios', tier: 2, isShiny: true, chosenTrait: 'mystic' },
        { definitionId: 'ribombee', tier: 1 },
      ])
      const picked = chooseFielded(econ, persona, 0)
      expect(picked).toHaveLength(2)
      expect(picked.filter(p => p.isShiny)).toHaveLength(1)
      // The displaced shiny must not be silently swallowed — the open slot
      // goes to the best remaining non-shiny.
      expect(picked.map(p => p.definitionId)).toContain('ribombee')
    })

    it('enforces the cap across a board/bench mix, not just within the bench', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById('kass')!
      econ.level = 2
      // One shiny already fielded, one waiting on the bench: candidates are
      // gathered from BOTH sources (chooseFielded reads econ.board too), so a
      // bench-only guard would miss this.
      econ.board = [{
        definitionId: 'charizard', tier: 2, hexPos: { col: 3, row: 4 },
        isShiny: true, chosenTrait: 'volcanic',
      }]
      econ.bench = mkBench([
        { definitionId: 'latios', tier: 2, isShiny: true, chosenTrait: 'mystic' },
        { definitionId: 'ribombee', tier: 1 },
      ])
      const picked = chooseFielded(econ, persona, 0)
      expect(picked).toHaveLength(2)
      expect(picked.filter(p => p.isShiny)).toHaveLength(1)
    })

    it('still fields the single shiny when only one is owned (cap is one, not zero)', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById('kass')!
      econ.level = 2
      econ.board = []
      econ.bench = mkBench([
        { definitionId: 'charizard', tier: 2, isShiny: true, chosenTrait: 'volcanic' },
        { definitionId: 'ribombee', tier: 1 },
      ])
      const picked = chooseFielded(econ, persona, 0)
      expect(picked.filter(p => p.isShiny)).toHaveLength(1)
      expect(picked.map(p => p.definitionId)).toContain('charizard')
    })

    it('leaves an all-non-shiny roster completely unchanged (regression)', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      const persona = personaById('kass')!
      econ.level = 2
      econ.board = []
      econ.bench = mkBench([
        { definitionId: 'charizard', tier: 2 },
        { definitionId: 'latios', tier: 2 },
        { definitionId: 'ribombee', tier: 1 },
      ])
      const picked = chooseFielded(econ, persona, 0)
      expect(picked).toHaveLength(2)
      expect(picked.filter(p => p.isShiny)).toHaveLength(0)
      expect(picked.map(p => p.definitionId).sort()).toEqual(['charizard', 'latios'])
    })

    it('botPlanRound never writes a board holding two shinies (end-to-end)', () => {
      const run = newRun(botSeats())
      const econ = run.players[1]
      econ.gold = 0    // no shop/reroll/XP activity; the roster below is the whole story
      econ.level = 3   // boardCap === 3, room for every candidate
      econ.board = []
      econ.bench = mkBench([
        { definitionId: 'charizard', tier: 2, isShiny: true, chosenTrait: 'volcanic' },
        { definitionId: 'latios', tier: 2, isShiny: true, chosenTrait: 'mystic' },
        { definitionId: 'ribombee', tier: 1 },
      ])
      botPlanRound(run, econ, 0, seededRng(1))
      expect(econ.board.filter(u => u.isShiny)).toHaveLength(1)
      // The benched shiny is not destroyed by being held back — it stays owned.
      const shiniesOwned =
        econ.board.filter(u => u.isShiny).length +
        econ.bench.filter(b => b?.isShiny).length
      expect(shiniesOwned).toBe(2)
    })
  })

  describe('botPlanRound — displaced shiny keeps isShiny/chosenTrait', () => {
    it('a fielded shiny displaced by a stronger bench pick lands on the bench still carrying isShiny/chosenTrait; a displaced ordinary unit does not', () => {
      // Two-site closed loop (see 260911-jfu PLAN.md <planning_correction>):
      // positionFielded strips isShiny/chosenTrait on the way FROM bench ONTO
      // board (Site A), so if it's still buggy, the board entry the
      // bench-rebuild loop (Site B) copies FROM in a LATER round never had
      // the flags to begin with. Seeding the shiny directly onto econ.board
      // would only exercise Site B — this drives two real botPlanRound
      // rounds so the shiny is actually FIELDED via positionFielded first
      // (round 1), then displaced from a board entry that positionFielded
      // itself produced (round 2). A line-1363 (Site B)-only fix still
      // fails this test, exactly as the plan intends.
      const run = newRun(botSeats())
      const econ = run.players[1]

      econ.gold = 0     // shop/reroll/XP-buy all no-op; econ.level stays fixed throughout
      econ.level = 2    // boardCap(econ) === 2, fixed for both rounds below

      // Round 1: field the shiny + an ordinary control from the bench (the
      // only two candidates, so both are guaranteed to be picked for the
      // two available slots) — this is what exercises Site A.
      econ.bench = mkBench([
        { definitionId: 'tangela', tier: 2, isShiny: true, chosenTrait: 'jungle' },
        { definitionId: 'ribombee', tier: 1 },
      ])
      econ.board = []
      botPlanRound(run, econ, 0, seededRng(1))

      // Sanity: round 1 actually fielded both (only two candidates existed).
      expect(econ.board.map(u => u.definitionId).sort()).toEqual(['ribombee', 'tangela'])

      // Round 2: introduce two cost-5/tier-3 candidates that vastly outscore
      // both cheap fielded units on raw unitPowerScore, forcing BOTH off the
      // board and through the bench-rebuild loop (Site B) — which copies
      // isShiny/chosenTrait FROM the board entries positionFielded wrote in
      // round 1.
      const freeSlots = econ.bench
        .map((b, i) => (b === null ? i : -1))
        .filter(i => i !== -1)
      econ.bench[freeSlots[0]] = { definitionId: 'charizard', tier: 3 }
      econ.bench[freeSlots[1]] = { definitionId: 'latios', tier: 3 }
      botPlanRound(run, econ, 0, seededRng(2))

      // Precondition: displacement actually happened. Without this the test
      // could pass vacuously if the shiny (or control) stayed fielded.
      expect(econ.board.map(u => u.definitionId)).not.toContain('tangela')
      expect(econ.board.map(u => u.definitionId)).not.toContain('ribombee')

      const shinyOnBench = econ.bench.find(b => b?.definitionId === 'tangela')
      const controlOnBench = econ.bench.find(b => b?.definitionId === 'ribombee')

      expect(shinyOnBench).toBeDefined()
      expect(shinyOnBench?.isShiny).toBe(true)
      expect(shinyOnBench?.chosenTrait).toBe('jungle')

      expect(controlOnBench).toBeDefined()
      expect(controlOnBench?.isShiny).toBeFalsy()
      expect(controlOnBench?.chosenTrait).toBeFalsy()
    })
  })

  // Real TFT reroll boards sometimes commit to TWO carries sharing a trait
  // (e.g. digging Weavile AND Froslass, both Froststone, to individual 3★s)
  // rather than settling for either a solo 3★ or a package that only
  // pushes both to 2★. pickRerollTarget's package candidates used to only
  // ever offer the 2★ variant — see targetTier below.
  describe('pickRerollTarget — multi-carry packages', () => {
    // weavile/froslass are both cost-2 Froststone units (src/data/units.ts).
    function setup(weavilePool: number, froslassPool: number) {
      const run = newRun(botSeats())
      const econ = run.players[1]
      econ.hp = 100
      econ.level = 6
      econ.bench = mkBench([
        { definitionId: 'weavile', tier: 1 },
        { definitionId: 'weavile', tier: 1 },
        { definitionId: 'froslass', tier: 1 },
        { definitionId: 'froslass', tier: 1 },
      ])
      run.pool['weavile'] = weavilePool
      run.pool['froslass'] = froslassPool
      const persona = personaById(econ.personaId)!
      const genome = resolveGenome(econ.personaId!)
      return { run, econ, persona, genome }
    }

    it('commits to a genuine dual-3★ package when the pool can support both', () => {
      const { run, econ, persona, genome } = setup(20, 20)
      const target = pickRerollTarget(econ, run, persona, genome)
      expect(target).not.toBeNull()
      expect(target!.defIds.sort()).toEqual(['froslass', 'weavile'])
      expect(target!.targetTier).toBe(3)
    })

    it('falls back to the 2★ package when the pool cannot support both reaching 3★', () => {
      const { run, econ, persona, genome } = setup(1, 1)
      const target = pickRerollTarget(econ, run, persona, genome)
      expect(target).not.toBeNull()
      expect(target!.defIds.sort()).toEqual(['froslass', 'weavile'])
      expect(target!.targetTier).toBe(2)
    })

    it('a member already sitting at a real 3★ scores its full progress, not 50%', () => {
      // Regression for the aggregate-cap-as-denominator bug: before the fix,
      // a package member already fully at ITS OWN target tier only ever
      // contributed 50% progress (have_m / (cap*members) instead of
      // have_m / cap), undervaluing an otherwise-complete package relative
      // to an equally-complete solo target.
      const { run, econ, persona, genome } = setup(20, 20)
      // Weavile already at a real 3★ (9 copies via one 3★ board entry).
      econ.board = [{ definitionId: 'weavile', tier: 3, hexPos: { col: 0, row: 4 } }]
      econ.bench = mkBench([
        { definitionId: 'froslass', tier: 1 },
        { definitionId: 'froslass', tier: 1 },
      ])
      const target = pickRerollTarget(econ, run, persona, genome)
      expect(target).not.toBeNull()
      expect(target!.targetTier).toBe(3)
      // have = weavile's 9 (already at cap) + froslass's 2 = 11
      expect(target!.have).toBe(11)
    })
  })
})
