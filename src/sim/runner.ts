import '../core/systems/ability'   // registers all ability handlers (side-effect import)

import { makeUnit } from '../core/unitFactory'
import { createCombatState, runCombat } from '../core/combatEngine'
import type { Team } from '../core/types'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface UnitSpec {
  id:   string          // definitionId: 'vikavolt', 'tangela', 'dummy', etc.
  tier: 1 | 2 | 3
  col:  number
  row:  number
}

export interface DamageBreakdown {
  physical: number
  magic:    number
  true:     number
}

// Damage dealt broken down by source type.
// Keys: 'auto_attack', a specific abilityId, or 'unknown_ability' for untagged direct calls.
export type DamageBySource = Record<string, number>

export interface KillAttribution {
  killerName:   string     // display name of the killing unit
  killerId:     string     // definitionId of the killing unit
  abilityId:    string     // 'auto_attack', specific ability id, or 'unknown'
  count:        number     // how many times across all trials
}

export interface UnitStats {
  definitionId:        string
  name:                string
  team:                Team

  // Damage output
  avgDamageDealt:      number   // post-mitigation damage dealt to enemies
  avgDamageByType:     DamageBreakdown
  avgDamageBySource:   DamageBySource   // per auto_attack / per ability
  avgCrits:            number
  avgCritRate:         number   // crits / total damaging hits (0 – 1)
  avgAutoAttacks:      number   // from unit.attackCount in finalState

  // Damage received
  avgDamageTaken:      number   // post-mitigation
  avgPreMitDamage:     number   // pre-mitigation (from unit.damageTakenThisCombat)
  avgMitigationPct:    number   // fraction absorbed by defenses (0 – 1)

  // Sustain
  avgHealing:          number
  avgShieldingReceived:number

  // Ability
  abilityProcs:        number   // avg casts per trial
  avgFirstCastTick:    number   // avg tick of first cast (0 = never cast)

  // Survival
  survivalRate:        number
  avgHpRemainingPct:   number   // avg HP% for trials where unit survived

  // Kill attribution: how was this unit killed?
  killCauses:          KillAttribution[]   // sorted by count desc; empty if never killed
}

export interface DurationDistribution {
  min: number
  p25: number
  p50: number
  p75: number
  p90: number
  max: number
}

// Who killed whom, and with what
export interface KillEvent {
  victimDefinitionId: string
  victimName:         string
  killerDefinitionId: string
  killerName:         string
  abilityId:          string    // 'auto_attack', specific ability, or 'unknown'
  count:              number    // across all trials
}

export interface SimulationReport {
  playerWinRate:        number
  enemyWinRate:         number
  drawRate:             number
  avgTicksElapsed:      number
  durationDistribution: DurationDistribution
  avgFirstDeathTick:    number
  trials:               number
  unitStats:            UnitStats[]
  killLog:              KillEvent[]   // cross-unit kill attribution, sorted by count
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function runSimulation(
  playerSpecs: UnitSpec[],
  enemySpecs:  UnitSpec[],
  trials = 100,
): SimulationReport {
  const pAcc = playerSpecs.map(s => makeAcc(s, 'player'))
  const eAcc = enemySpecs.map(s =>  makeAcc(s, 'enemy'))

  // Cross-unit kill log: "victim:killer:abilityId" → count
  const killLogMap = new Map<string, { victim: TrialAcc; killer: TrialAcc; abilityId: string; count: number }>()

  let playerWins = 0
  let enemyWins  = 0
  let draws      = 0
  const ticksPerTrial: number[] = []
  const firstDeathTicks: number[] = []

  // Build a stable name lookup: definitionId → acc (for kill attribution)
  const allAcc = [...pAcc, ...eAcc]

  for (let t = 0; t < trials; t++) {
    const playerUnits = playerSpecs.map(s => {
      const u = makeUnit(s.id, 'player', s.tier)
      u.hexPos = { col: s.col, row: s.row }
      return u
    })
    const enemyUnits = enemySpecs.map(s => {
      const u = makeUnit(s.id, 'enemy', s.tier)
      u.hexPos = { col: s.col, row: s.row }
      return u
    })

    // id → acc for O(1) routing during this trial
    const idToAcc = new Map<string, TrialAcc>()
    playerUnits.forEach((u, i) => idToAcc.set(u.id, pAcc[i]))
    enemyUnits.forEach( (u, i) => idToAcc.set(u.id,  eAcc[i]))

    let firstDeathTick = 0

    const state  = createCombatState(playerUnits, enemyUnits)
    const result = runCombat(state, {
      onTickEnd(tick, events) {
        for (const ev of events) {
          switch (ev.type) {
            case 'damage': {
              const targetAcc = idToAcc.get(ev.targetId)
              const sourceAcc = idToAcc.get(ev.sourceId)
              if (targetAcc) targetAcc.damageTaken += ev.amount
              if (sourceAcc) {
                sourceAcc.damageDealt += ev.amount
                sourceAcc.damageByType[ev.damageType ?? 'physical'] += ev.amount
                const srcKey = ev.abilityId ?? 'unknown_ability'
                sourceAcc.damageBySource[srcKey] = (sourceAcc.damageBySource[srcKey] ?? 0) + ev.amount
                sourceAcc.totalHits++
                if (ev.isCrit) sourceAcc.crits++
              }
              break
            }
            case 'heal': {
              const acc = idToAcc.get(ev.targetId)
              if (acc) acc.healing += ev.amount
              break
            }
            case 'shield': {
              const acc = idToAcc.get(ev.unitId)
              if (acc) acc.shieldingReceived += ev.amount
              break
            }
            case 'cast': {
              const acc = idToAcc.get(ev.unitId)
              if (acc) {
                acc.procs++
                if (acc.firstCastTick === 0) acc.firstCastTick = tick
              }
              break
            }
            case 'death': {
              if (firstDeathTick === 0) firstDeathTick = tick

              // Kill attribution
              const victimAcc = idToAcc.get(ev.unitId)
              const killerAcc = ev.sourceId ? idToAcc.get(ev.sourceId) : undefined
              const causeId   = ev.abilityId ?? 'unknown'
              if (victimAcc) {
                const causeKey = `${killerAcc?.definitionId ?? 'unknown'}:${causeId}`
                const existing = victimAcc.killCauses.get(causeKey)
                if (existing) existing.count++
                else victimAcc.killCauses.set(causeKey, {
                  killerAcc: killerAcc ?? null,
                  abilityId: causeId,
                  count: 1,
                })
              }
              if (victimAcc && killerAcc) {
                const key = `${victimAcc.definitionId}:${killerAcc.definitionId}:${causeId}`
                const entry = killLogMap.get(key)
                if (entry) entry.count++
                else killLogMap.set(key, { victim: victimAcc, killer: killerAcc, abilityId: causeId, count: 1 })
              }
              break
            }
          }
        }
      },
    })

    if      (result.winner === 'player') playerWins++
    else if (result.winner === 'enemy')  enemyWins++
    else                                 draws++
    ticksPerTrial.push(result.ticksElapsed)
    if (firstDeathTick > 0) firstDeathTicks.push(firstDeathTick)

    // Post-combat unit state
    for (const unit of result.finalState.units.values()) {
      const acc = idToAcc.get(unit.id)
      if (!acc) continue
      acc.autoAttacks  += unit.attackCount ?? 0
      acc.preMitDamage += unit.damageTakenThisCombat ?? 0
      if (unit.state !== 'dead') {
        acc.survived++
        acc.hpRemainingSum += unit.currentHp / unit.maxHp
      }
      if (acc.firstCastTick > 0) {
        acc.firstCastTickSum += acc.firstCastTick
        acc.firstCastCount++
        acc.firstCastTick = 0
      }
    }
  }

  const dist = calcDistribution(ticksPerTrial)
  const avgFirstDeathTick = firstDeathTicks.length > 0
    ? r(firstDeathTicks.reduce((a, b) => a + b, 0) / firstDeathTicks.length)
    : 0

  const toStats = (acc: TrialAcc): UnitStats => {
    const postMit  = r(acc.damageTaken  / trials)
    const preMit   = r(acc.preMitDamage / trials)
    const mitigPct = preMit > 0 ? r(1 - postMit / preMit) : 0

    // Build avgDamageBySource
    const avgDamageBySource: DamageBySource = {}
    for (const [src, total] of Object.entries(acc.damageBySource)) {
      avgDamageBySource[src] = r(total / trials)
    }

    // Build killCauses sorted by count
    const killCauses: KillAttribution[] = [...acc.killCauses.values()]
      .sort((a, b) => b.count - a.count)
      .map(kc => ({
        killerName:  kc.killerAcc?.name  ?? 'unknown',
        killerId:    kc.killerAcc?.definitionId ?? 'unknown',
        abilityId:   kc.abilityId,
        count:       kc.count,
      }))

    return {
      definitionId:         acc.definitionId,
      name:                 acc.name,
      team:                 acc.team,
      avgDamageDealt:       r(acc.damageDealt / trials),
      avgDamageByType: {
        physical: r(acc.damageByType.physical / trials),
        magic:    r(acc.damageByType.magic    / trials),
        true:     r(acc.damageByType.true     / trials),
      },
      avgDamageBySource,
      avgCrits:             r(acc.crits       / trials),
      avgCritRate:          acc.totalHits > 0 ? r(acc.crits / acc.totalHits) : 0,
      avgAutoAttacks:       r(acc.autoAttacks / trials),
      avgDamageTaken:       postMit,
      avgPreMitDamage:      preMit,
      avgMitigationPct:     mitigPct,
      avgHealing:           r(acc.healing            / trials),
      avgShieldingReceived: r(acc.shieldingReceived   / trials),
      abilityProcs:         r(acc.procs              / trials),
      avgFirstCastTick:     acc.firstCastCount > 0
        ? r(acc.firstCastTickSum / acc.firstCastCount)
        : 0,
      survivalRate:         r(acc.survived / trials),
      avgHpRemainingPct:    acc.survived > 0 ? r(acc.hpRemainingSum / acc.survived) : 0,
      killCauses,
    }
  }

  const killLog: KillEvent[] = [...killLogMap.values()]
    .sort((a, b) => b.count - a.count)
    .map(e => ({
      victimDefinitionId: e.victim.definitionId,
      victimName:         e.victim.name,
      killerDefinitionId: e.killer.definitionId,
      killerName:         e.killer.name,
      abilityId:          e.abilityId,
      count:              e.count,
    }))

  return {
    playerWinRate:        r(playerWins / trials),
    enemyWinRate:         r(enemyWins  / trials),
    drawRate:             r(draws      / trials),
    avgTicksElapsed:      r(ticksPerTrial.reduce((a, b) => a + b, 0) / trials),
    durationDistribution: dist,
    avgFirstDeathTick,
    trials,
    unitStats: [...pAcc, ...eAcc].map(toStats),
    killLog,
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

interface KillCauseEntry {
  killerAcc: TrialAcc | null
  abilityId: string
  count:     number
}

interface TrialAcc {
  definitionId:      string
  name:              string
  team:              Team
  damageDealt:       number
  damageByType:      { physical: number; magic: number; true: number }
  damageBySource:    Record<string, number>
  crits:             number
  totalHits:         number
  autoAttacks:       number
  damageTaken:       number
  preMitDamage:      number
  healing:           number
  shieldingReceived: number
  procs:             number
  firstCastTick:     number
  firstCastTickSum:  number
  firstCastCount:    number
  survived:          number
  hpRemainingSum:    number
  killCauses:        Map<string, KillCauseEntry>
}

function makeAcc(spec: UnitSpec, team: Team): TrialAcc {
  let name = spec.id
  try { name = makeUnit(spec.id, team, 1).name } catch { /* unknown id */ }
  return {
    definitionId:      spec.id,
    name,
    team,
    damageDealt:       0,
    damageByType:      { physical: 0, magic: 0, true: 0 },
    damageBySource:    {},
    crits:             0,
    totalHits:         0,
    autoAttacks:       0,
    damageTaken:       0,
    preMitDamage:      0,
    healing:           0,
    shieldingReceived: 0,
    procs:             0,
    firstCastTick:     0,
    firstCastTickSum:  0,
    firstCastCount:    0,
    survived:          0,
    hpRemainingSum:    0,
    killCauses:        new Map(),
  }
}

function calcDistribution(values: number[]): DurationDistribution {
  if (values.length === 0) return { min: 0, p25: 0, p50: 0, p75: 0, p90: 0, max: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const at = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]
  return {
    min: sorted[0],
    p25: at(0.25),
    p50: at(0.50),
    p75: at(0.75),
    p90: at(0.90),
    max: sorted[sorted.length - 1],
  }
}

function r(n: number, dp = 3): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}
