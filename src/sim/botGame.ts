// Shared headless bot-vs-bot economy game loop. One authoritative implementation
// used by BOTH the training CLI (src/econ/train.ts) and the league report CLI
// (src/sim/botLeague.ts) — both run with `realCadence: true`, the real
// creep/item-round cadence with bot item pickups, so trained genomes are
// evaluated in the same environment they're deployed into. Hooks let callers
// observe each round and swap fight resolution (for combat-timeline capture).

import { newRun } from '../econ/runState'
import type { RunState, PlayerEcon } from '../econ/runState'
import { botSeats, botPlanRound, econBoardPower } from '../econ/bots'
import { chooseBotItem, botOwnedItems } from '../econ/botItems'
import { resolveBotFight } from '../econ/botMatches'
import { settleRound } from '../econ/income'
import { returnAllToPool } from '../econ/shop'
import { isItemRound, isCreepRound } from '../econ/creeps'
import { rivalTraitContestCounts } from '../econ/compositionSignature'
import type { Rng } from '../econ/shop'

// placement[i] = 1 (best) .. 5 (worst), indexed by player slot 1-5.
export function rankBots(run: RunState): number[] {
  const idxs = [1, 2, 3, 4, 5]
  idxs.sort((a, b) => {
    const pa = run.players[a], pb = run.players[b]
    if (pa.eliminated !== pb.eliminated) return pa.eliminated ? 1 : -1
    return pb.hp - pa.hp
  })
  const placement = new Array(6).fill(0)
  idxs.forEach((idx, i) => { placement[idx] = i + 1 })
  return placement
}

export type FightResolver = (
  a: PlayerEcon,
  b: PlayerEcon,
  meta: { round: number; aIdx: number; bIdx: number },
) => { winner: 'a' | 'b' | 'draw'; survivorStars: number }

// Seeds fight outcomes off the game's own rng — this is what gives the training
// CLI common random numbers: every candidate genome's games see the same combat
// draws as its rivals, so a candidate's fitness only moves for reasons a policy
// change would actually cause.
const makeDefaultResolver = (rng: Rng): FightResolver => (a, b) => {
  const f = resolveBotFight(a, b, rng)
  return { winner: f.winner, survivorStars: f.survivorStars }
}

export interface BotGameOptions {
  rng: Rng
  maxRounds: number
  realCadence?: boolean          // true: creep/item-round cadence + item pickups; false: fight every round (training parity)
  fightResolver?: FightResolver  // override to capture per-fight combat detail
  onRoundEnd?: (round: number, run: RunState) => void
  // Training-only: enables Thompson-sampling exploration in the learned
  // composition affinity bandit (src/econ/itemAffinity.ts,
  // src/econ/compositionSignature.ts) instead of taking the posterior-mean/
  // top-scored choice. Defaults false — never set true outside
  // trainCompositionAffinities.ts. Live bots and the ES weight-tuning loop
  // (train.ts) must never randomize. Item choice doesn't use this at all —
  // see src/econ/preferredItems.ts, a hand-authored reference instead.
  explorationMode?: boolean
  // Training-only (see trainCatalogComps.ts): for a given living player slot
  // (1-5), returns the set of catalog core-unit ids to soft-bias that bot's
  // shop-buy scoring toward this game, or undefined for no bias. Never set
  // outside that script — live bots and every other training phase leave
  // every slot unbiased.
  catalogBiasFor?: (slot: number) => Set<string> | undefined
}

// Play one full 5-bot economy game and return the finished RunState.
export function simulateBotGame(opts: BotGameOptions): RunState {
  const { rng, maxRounds } = opts
  const real = opts.realCadence ?? false
  const explorationMode = opts.explorationMode ?? false
  const resolve = opts.fightResolver ?? makeDefaultResolver(rng)
  const run = newRun(botSeats())

  for (let r = 1; r <= maxRounds; r++) {
    run.round = r
    const living = [1, 2, 3, 4, 5].filter(i => !run.players[i].eliminated)
    if (living.length <= 1) break

    const itemRound  = real && isItemRound(r)
    const creepRound = real && isCreepRound(r)

    if (!itemRound && !creepRound) {
      // Combat round: shuffle-pair the living bots and fight (odd one out gets a bye).
      for (let i = living.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[living[i], living[j]] = [living[j], living[i]]
      }
      for (let i = 0; i + 1 < living.length; i += 2) {
        const aIdx = living[i], bIdx = living[i + 1]
        const a = run.players[aIdx], b = run.players[bIdx]
        // A latent ability/sim bug on some exotic board must not kill a long run —
        // count a crashed fight as a draw and keep going.
        let fight: { winner: 'a' | 'b' | 'draw'; survivorStars: number }
        try { fight = resolve(a, b, { round: r, aIdx, bIdx }) }
        catch { fight = { winner: 'draw', survivorStars: 0 } }
        settleRound(a, { won: fight.winner === 'a', draw: fight.winner === 'draw', survivorStars: fight.winner === 'b' ? fight.survivorStars : 0, round: r })
        settleRound(b, { won: fight.winner === 'b', draw: fight.winner === 'draw', survivorStars: fight.winner === 'a' ? fight.survivorStars : 0, round: r })
        if (a.eliminated) returnAllToPool(run, a)
        if (b.eliminated) returnAllToPool(run, b)
      }
      if (living.length % 2 === 1) {
        settleRound(run.players[living[living.length - 1]], { won: false, draw: true, survivorStars: 0, round: r })
      }
    } else {
      // Non-combat round (creep bye or Delibird item round): everyone takes a bye settle.
      for (const i of living) {
        settleRound(run.players[i], { won: false, draw: true, survivorStars: 0, round: r })
      }
    }

    // Plan: each living bot plans against the AVERAGE power of its still-living rivals
    // (stands in for "the human"). On item rounds it first picks a board-suited item.
    for (let i = 1; i <= 5; i++) {
      const econ = run.players[i]
      if (econ.eliminated) continue
      if (itemRound) {
        const item = chooseBotItem(econ, botOwnedItems(econ), rng)
        if (item) econ.itemBench.push(item)
      }
      const others = [1, 2, 3, 4, 5].filter(j => j !== i && !run.players[j].eliminated)
      const avgOthersPower = others.length
        ? others.reduce((s, j) => s + econBoardPower(run.players[j]), 0) / others.length
        : 0
      // Opponent trait awareness: what traits are the still-living rivals
      // already running, so this bot can discount pool-contested lines.
      const rivalTraitCounts = rivalTraitContestCounts(others.map(j => run.players[j].board))
      botPlanRound(run, econ, avgOthersPower, rng, explorationMode, rivalTraitCounts, opts.catalogBiasFor?.(i))
    }

    opts.onRoundEnd?.(r, run)
  }

  return run
}

// Deterministic LCG RNG (shared by train.ts / botLeague.ts so a --seed reproduces
// the same round pairings/economies; note the combat core still uses Math.random,
// so individual fight outcomes remain stochastic — aggregate over many games).
export function seededRng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}
