/**
 * CLI simulation runner.
 *
 * Usage:
 *   npx tsx src/sim/run.ts --player vikavolt:1 --enemy dummy:1,dummy:1,dummy:1 --trials 100
 *   npx tsx src/sim/run.ts --player tangela:1 --enemy dummy_melee:1 --trials 50 --verbose
 *
 * Unit format:  id:tier  (tier defaults to 1)
 * Positions are assigned automatically in a sensible default layout.
 */

import { runSimulation } from './runner'
import type { UnitSpec } from './runner'
import { TICK_RATE } from '../core/constants'

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

function getFlag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}

const playerArg  = getFlag('player')  ?? 'tangela:1'
const enemyArg   = getFlag('enemy')   ?? 'dummy:1'
const trialsArg  = getFlag('trials')  ?? '100'
const verbose    = args.includes('--verbose')
const trials     = Math.max(1, parseInt(trialsArg, 10) || 100)

// ─── Spec parsing — "id:tier,id:tier,..." → UnitSpec[] ───────────────────────

function parseSpecs(raw: string, isPlayer: boolean): UnitSpec[] {
  return raw.split(',').map((token, i) => {
    const [id, tierStr] = token.trim().split(':')
    const tier = (parseInt(tierStr ?? '1', 10) || 1) as 1 | 2 | 3
    const col = 2 + (i % 5)
    const row = isPlayer
      ? (5 + Math.floor(i / 5))
      : (2 - Math.floor(i / 5))
    return { id: id.trim(), tier, col, row }
  })
}

const playerSpecs = parseSpecs(playerArg, true)
const enemySpecs  = parseSpecs(enemyArg,  false)

// ─── Run ─────────────────────────────────────────────────────────────────────

console.log('\n─── PokéTFT Simulation Runner ───────────────────────────────')
console.log(`  Player: ${playerSpecs.map(s => `${s.id}★${s.tier}`).join(', ')}`)
console.log(`  Enemy:  ${enemySpecs.map(s =>  `${s.id}★${s.tier}`).join(', ')}`)
console.log(`  Trials: ${trials}\n`)

const report = runSimulation(playerSpecs, enemySpecs, trials)

// ─── Outcomes ────────────────────────────────────────────────────────────────

const d = report.durationDistribution
console.log('─── Outcomes ────────────────────────────────────────────────')
console.log(`  Player win rate  : ${pct(report.playerWinRate)}`)
console.log(`  Enemy win rate   : ${pct(report.enemyWinRate)}`)
console.log(`  Draw rate        : ${pct(report.drawRate)}`)
console.log(`  Avg duration     : ${secs(report.avgTicksElapsed)}`)
console.log(`  Duration spread  : min=${secs(d.min)}  p25=${secs(d.p25)}  p50=${secs(d.p50)}  p75=${secs(d.p75)}  p90=${secs(d.p90)}  max=${secs(d.max)}`)
if (report.avgFirstDeathTick > 0) {
  console.log(`  First death avg  : ${secs(report.avgFirstDeathTick)}`)
}

// ─── Per-unit stats ───────────────────────────────────────────────────────────

console.log('\n─── Damage Dealt ────────────────────────────────────────────')
printTable(
  ['Unit', 'Team', 'Total', 'Phys', 'Magic', 'True', 'Crits', 'CritRate', 'Autos'],
  [22,      5,      7,       7,      7,        6,      6,        9,          6],
  report.unitStats.map(u => [
    u.name.slice(0, 21),
    u.team === 'player' ? 'P' : 'E',
    fmt(u.avgDamageDealt),
    fmt(u.avgDamageByType.physical),
    fmt(u.avgDamageByType.magic),
    fmt(u.avgDamageByType.true),
    u.avgCrits.toFixed(1),
    pct(u.avgCritRate),
    u.avgAutoAttacks.toFixed(1),
  ]),
)

console.log('\n─── Damage Received ─────────────────────────────────────────')
printTable(
  ['Unit', 'Team', 'PostMit', 'PreMit', 'Mitigated%'],
  [22,      5,      9,         8,         11],
  report.unitStats.map(u => [
    u.name.slice(0, 21),
    u.team === 'player' ? 'P' : 'E',
    fmt(u.avgDamageTaken),
    fmt(u.avgPreMitDamage),
    pct(u.avgMitigationPct),
  ]),
)

console.log('\n─── Sustain & Abilities ─────────────────────────────────────')
printTable(
  ['Unit', 'Team', 'Healed', 'Shielded', 'Procs', 'FirstCast', 'Survived', 'HPRemain'],
  [22,      5,      8,         9,           6,       10,           9,           9],
  report.unitStats.map(u => [
    u.name.slice(0, 21),
    u.team === 'player' ? 'P' : 'E',
    fmt(u.avgHealing),
    fmt(u.avgShieldingReceived),
    u.abilityProcs.toFixed(1),
    u.avgFirstCastTick > 0 ? secs(u.avgFirstCastTick) : 'never',
    pct(u.survivalRate),
    u.survivalRate > 0 ? pct(u.avgHpRemainingPct) : '—',
  ]),
)

// ─── Damage by source (per unit) ─────────────────────────────────────────────

console.log('\n─── Damage Output by Source ─────────────────────────────────')
for (const u of report.unitStats) {
  const sources = Object.entries(u.avgDamageBySource).sort((a, b) => b[1] - a[1])
  if (sources.length === 0) continue
  const tag = u.team === 'player' ? 'P' : 'E'
  const label = `${u.name} [${tag}]`.padEnd(26)
  const parts = sources.map(([src, dmg]) => `${src}: ${Math.round(dmg)}`).join('   ')
  console.log(`  ${label}${parts}`)
}

// ─── Kill log ────────────────────────────────────────────────────────────────

if (report.killLog.length > 0) {
  console.log('\n─── Kill Log (across all trials) ────────────────────────────')
  printTable(
    ['Victim', 'Killed by', 'Ability / Source', 'Count', 'Per Trial'],
    [22,        22,           20,                  7,       10],
    report.killLog.map(k => [
      k.victimName.slice(0, 21),
      k.killerName.slice(0, 21),
      k.abilityId.slice(0, 19),
      String(k.count),
      (k.count / report.trials).toFixed(2),
    ]),
  )
}

// ─── Kill causes (per unit) ───────────────────────────────────────────────────

const killed = report.unitStats.filter(u => u.killCauses.length > 0)
if (killed.length > 0) {
  console.log('\n─── How Each Unit Was Killed ────────────────────────────────')
  for (const u of killed) {
    console.log(`  ${u.name} [${u.team === 'player' ? 'P' : 'E'}] — killed ${(1 - u.survivalRate) * 100 | 0}% of trials:`)
    for (const kc of u.killCauses) {
      const perTrial = (kc.count / report.trials).toFixed(2)
      console.log(`    ${kc.abilityId.padEnd(30)} by ${kc.killerName.padEnd(20)} ×${kc.count} (${perTrial}/trial)`)
    }
  }
}

console.log()

// ─── Verbose: one-trial re-run with logging ───────────────────────────────────

if (verbose) {
  console.log('─── Verbose: single trial event log ─────────────────────────')
  const { createCombatState, runCombat } = await import('../core/combatEngine')
  const { makeUnit } = await import('../core/unitFactory')

  const pUnits = playerSpecs.map(s => {
    const u = makeUnit(s.id, 'player', s.tier); u.hexPos = { col: s.col, row: s.row }; return u
  })
  const eUnits = enemySpecs.map(s => {
    const u = makeUnit(s.id, 'enemy', s.tier); u.hexPos = { col: s.col, row: s.row }; return u
  })
  const state = createCombatState(pUnits, eUnits)
  runCombat(state, { verbose: true })
  console.log()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number): string { return `${(n * 100).toFixed(1)}%` }
function fmt(n: number): string  { return Math.round(n).toString() }
function secs(ticks: number): string { return `${(ticks / TICK_RATE).toFixed(1)}s` }

function printTable(headers: string[], widths: number[], rows: string[][]): void {
  console.log(tableRow(headers, widths))
  console.log('─'.repeat(widths.reduce((a, b) => a + b + 2, 0)))
  for (const r of rows) console.log(tableRow(r, widths))
}

function tableRow(cells: string[], widths: number[]): string {
  return cells.map((c, i) => c.padEnd(widths[i])).join('  ')
}
