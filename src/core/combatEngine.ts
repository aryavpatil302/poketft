import type { Unit, CombatState, CombatResult, CombatEvent } from './types'
import { hexId, hexToPixel } from './hexGrid'
import { HEX_SIZE } from './constants'
import { computeStats } from './unitFactory'
import { tickStatusEffects, tickShields } from './systems/statusEffect'
import { tickManaLock, isReadyToCast } from './systems/mana'
import { tickTargeting } from './systems/targeting'
import { tickMovement, tickLeapPixel, recalculatePath } from './systems/movement'
import { tickAttack, isInRange, startAttacking } from './systems/attack'
import { triggerAbility, tickAbilityCast } from './systems/ability'
import { tickProjectiles } from './projectile'
import { tickMarks } from './systems/marks'
import { tickPersistentAoEZones } from './systems/persistentAoE'

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCombatState(
  playerUnits: Unit[],
  enemyUnits: Unit[],
): CombatState {
  const units = new Map<string, Unit>()
  const hexOccupancy = new Map<string, string>()

  for (const unit of [...playerUnits, ...enemyUnits]) {
    units.set(unit.id, unit)
    hexOccupancy.set(hexId(unit.hexPos), unit.id)
    // Sync visual position to hex position
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
  }

  return {
    tick: 0,
    phase: 'combat',
    units,
    projectiles: new Map(),
    events: [],
    hexOccupancy,
    terrain: { electric: false, psychic: false, grassy: false, misty: false },
    spellBuffCounters: new Map(),
    persistentAoEZones: [],
  }
}

// ─── Win / loss check ─────────────────────────────────────────────────────────

function checkWinLoss(state: CombatState): boolean {
  let playerAlive = false
  let enemyAlive  = false

  for (const unit of state.units.values()) {
    if (unit.state !== 'dead') {
      if (unit.team === 'player') playerAlive = true
      else                        enemyAlive  = true
    }
  }

  if (!playerAlive && !enemyAlive) { state.phase = 'playerWin'; return true }
  if (!enemyAlive) { state.phase = 'playerWin'; return true }
  if (!playerAlive) { state.phase = 'enemyWin'; return true }
  return false
}

// ─── Leap movement (non-interruptible fast path to destination) ───────────────

function tickLeapMovement(unit: Unit, state: CombatState): void {
  const arrived = tickLeapPixel(unit, state)
  // Don't reset to idle if onLand started a new leap or if onLand killed the unit
  if (arrived && !(unit as any)._leap && unit.state !== 'dead') unit.state = 'idle'
}

// ─── Per-unit state machine ───────────────────────────────────────────────────

function tickUnit(unit: Unit, state: CombatState): void {
  if (unit.state === 'dead' || unit.state === 'stunned' || unit.state === 'knockedUp' || unit.state === 'ascended') return
  if (unit.isDummy) return   // target dummies: just stand and absorb damage

  // Rebuild computed stats for this tick
  computeStats(unit)

  // Leaping: fixed fast path, no targeting or ability interrupts
  if (unit.state === 'leaping') {
    tickLeapMovement(unit, state)
    return
  }

  // Check if ability is ready
  if (unit.state === 'casting') {
    tickAbilityCast(unit, state)
    return
  }

  if (isReadyToCast(unit)) {
    triggerAbility(unit, state)
    return
  }

  // Acquire / validate target
  tickTargeting(unit, state)

  if (!unit.targetId) return  // no enemies left

  const inRange = isInRange(unit, state)

  switch (unit.state) {
    case 'idle': {
      if (inRange) {
        startAttacking(unit)
      } else {
        unit.state = 'moving'
        recalculatePath(unit, state)
      }
      break
    }

    case 'moving': {
      if (inRange) {
        unit.state = 'idle'  // will transition to attacking next tick
        unit.path = []
        break
      }

      // Recalculate path if we don't have one
      if (unit.path.length === 0) {
        recalculatePath(unit, state)
      }

      if (unit.path.length === 0) {
        // Completely surrounded — just stand and wait
        break
      }

      const steppedOntoNewHex = tickMovement(unit, state)
      if (steppedOntoNewHex) {
        // Recalculate path every hex step — ensures we always track moving targets
        recalculatePath(unit, state)
        if (unit.path.length === 0) {
          unit.state = 'idle'
        }
      }
      break
    }

    case 'attacking': {
      tickAttack(unit, state)
      break
    }
  }
}

// ─── Main runCombat loop ──────────────────────────────────────────────────────

export interface RunCombatOptions {
  maxTicks?: number
  verbose?: boolean
  // Called at the end of every tick with the tick number and that tick's events.
  // More flexible than a flat accumulator: caller can tag events with tick, track first-cast, etc.
  onTickEnd?: (tick: number, events: CombatEvent[]) => void
}

export function runCombat(state: CombatState, opts: RunCombatOptions = {}): CombatResult {
  const maxTicks = opts.maxTicks ?? 1800  // 30 seconds default
  const verbose = opts.verbose ?? false

  while (state.tick < maxTicks) {
    state.tick++
    state.events = []

    // 1. Status effect tick
    tickStatusEffects(state.units, state)

    // 1b. Mark detonation tick
    tickMarks(state.units, state)

    // 2. Shield tick
    tickShields(state.units)

    // 2b. Persistent AoE zones
    tickPersistentAoEZones(state)

    // 3. Mana lock tick + per-unit processing
    for (const unit of state.units.values()) {
      if (unit.state === 'dead') continue
      tickManaLock(unit)
      tickUnit(unit, state)
    }

    // 4. Projectile tick
    tickProjectiles(state)

    // 5. Per-tick callback — must run BEFORE win check so the killing-blow death event
    //    is not skipped when combat ends on the same tick.
    if (opts.onTickEnd && state.events.length > 0) {
      opts.onTickEnd(state.tick, state.events)
    }

    // 6. Win/loss check
    if (checkWinLoss(state)) break

    // 7. Verbose logging
    if (verbose && state.events.length > 0) {
      for (const ev of state.events) {
        const tickStr = `[t=${state.tick}]`
        switch (ev.type) {
          case 'damage': {
            const unit = state.units.get(ev.targetId)
            console.log(`${tickStr} DAMAGE ${ev.amount} ${ev.damageType}${ev.isCrit ? ' CRIT' : ''} → ${unit?.name ?? ev.targetId} (HP: ${unit?.currentHp ?? '?'})`)
            break
          }
          case 'cast': {
            const unit = state.units.get(ev.unitId)
            console.log(`${tickStr} CAST ${ev.abilityId} by ${unit?.name ?? ev.unitId}`)
            break
          }
          case 'shield': {
            const unit = state.units.get(ev.unitId)
            console.log(`${tickStr} SHIELD ${ev.amount} on ${unit?.name ?? ev.unitId}`)
            break
          }
          case 'death': {
            const unit = state.units.get(ev.unitId)
            console.log(`${tickStr} DEATH ${unit?.name ?? ev.unitId}`)
            break
          }
          case 'heal': {
            const unit = state.units.get(ev.targetId)
            console.log(`${tickStr} HEAL ${ev.amount} → ${unit?.name ?? ev.targetId}`)
            break
          }
        }
      }
    }
  }

  // Determine winner
  let winner: 'player' | 'enemy' | 'draw'
  if (state.phase === 'playerWin')  winner = 'player'
  else if (state.phase === 'enemyWin') winner = 'enemy'
  else winner = 'draw'  // hit maxTicks

  return {
    winner,
    ticksElapsed: state.tick,
    finalState: state,
  }
}
