import type { Unit, CombatState, CombatResult, CombatEvent } from './types'
import { hexId, hexToPixel } from './hexGrid'
import { HEX_SIZE } from './constants'
import { computeStats } from './unitFactory'
import { tickStatusEffects, tickShields } from './systems/statusEffect'
import { tickManaLock, isReadyToCast } from './systems/mana'
import { tickTargeting } from './systems/targeting'
import { tickMovement, tickLeapPixel, recalculatePath, reconcileHexOccupancy, cancelInFlightMovement } from './systems/movement'
import { tickAttack, isInRange, startAttacking } from './systems/attack'
import { triggerAbility, tickAbilityCast, initAbilityPassives } from './systems/ability'
import { tickProjectiles } from './projectile'
import { tickMarks } from './systems/marks'
import { tickPersistentAoEZones } from './systems/persistentAoE'
import { initTraitEffects } from './systems/traitEffects'
import { initItemPassives } from '../data/items'

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createCombatState(
  playerUnits: Unit[],
  enemyUnits: Unit[],
  stage?: number,
): CombatState {
  const units = new Map<string, Unit>()
  const hexOccupancy = new Map<string, string>()

  for (const unit of [...playerUnits, ...enemyUnits]) {
    units.set(unit.id, unit)
    hexOccupancy.set(hexId(unit.hexPos), unit.id)
    // Sync visual position to hex position
    unit.visualPos = hexToPixel(unit.hexPos, HEX_SIZE)
  }

  const state: CombatState = {
    tick: 0,
    phase: 'combat',
    units,
    projectiles: new Map(),
    events: [],
    hexOccupancy,
    terrain: { electric: false, psychic: false, grassy: false, misty: false, sunny: false },
    tailwind: { player: false, enemy: false },
    earthquakeCounts: new Map(),
    spellBuffCounters: new Map(),
    persistentAoEZones: [],
    stage,
  }

  initAbilityPassives(state)
  initItemPassives(state)
  initTraitEffects(state)
  return state
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

// The single per-unit state machine, shared by the headless sim (runCombat) and
// the live game (main.ts tickCombat) so the two can never drift again.
export function tickUnit(unit: Unit, state: CombatState): void {
  if (unit.state === 'dead') return
  // CC hard-stop: stunned/knocked-up/ascended units do nothing at all — no move,
  // no attack, no cast. (Casting is gated here too, unlike the old live loop.)
  // Drop any in-progress attack windup so it can't resume or fire the instant CC
  // ends — CC interrupts the swing; the unit re-winds from scratch afterward.
  if (unit.state === 'stunned' || unit.state === 'knockedUp' || unit.state === 'ascended') {
    unit.isInWindup = false
    unit.attackWindupTimer = 0
    return
  }
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
    // Casting out of a slide/dash must clear the in-flight hex bookkeeping first,
    // or the reserved destination hex leaks as a permanent phantom blocker.
    if (unit.state === 'moving' || unit._leap) cancelInFlightMovement(unit, state)
    triggerAbility(unit, state)
    return
  }

  // Acquire / validate target
  tickTargeting(unit, state)

  if (!unit.targetId) return  // no enemies left

  const inRange = isInRange(unit, state)

  // "rooted" holds the unit in place; "attackSuppressed" also blocks attacking.
  // Tapu Lele's channel does both; the generic `rooted` id is a real hook too.
  // A-Raichu is rooted in place (no move, no auto) until every Surge Surfer bolt has
  // been expelled — each pending bolt is an 'a_raichu_queued_bolt' effect that clears
  // as it fires, so he unlocks the moment the last one goes out.
  const raichuFiringBolts = unit.statusEffects.some(fx => fx.id === 'a_raichu_queued_bolt')
  const rooted = raichuFiringBolts
    || unit.statusEffects.some(fx => fx.id === 'rooted' || fx.stackId === 'tapulele_channel')
  const attackSuppressed = rooted || unit.statusEffects.some(fx => fx.stackId === 'tapulele_post_channel')

  switch (unit.state) {
    case 'idle': {
      if (inRange && !attackSuppressed) {
        startAttacking(unit)
      } else if (!inRange && !rooted) {
        unit.state = 'moving'
        recalculatePath(unit, state)
      }
      break
    }

    case 'moving': {
      if (inRange || rooted) {
        // Commit/clear the in-flight slide cleanly (resets moveProgress + frees
        // the reserved destination) rather than a bare state flip, which would
        // leak the reservation and leave stale moveProgress that stacks the next slide.
        cancelInFlightMovement(unit, state)
        unit.state = 'idle'
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
      if (attackSuppressed) {
        unit.state = 'idle'
        unit.isInWindup = false
        unit.attackWindupTimer = 0
        break
      }
      tickAttack(unit, state)
      break
    }
  }
}

// One full combat tick, shared by runCombat and the live loop. Advances tick,
// clears/repopulates events, ticks every subsystem + per-unit state machine, and
// reconciles hex occupancy. Callers own the terminal win/loss (+ overtime) check.
export function advanceCombatTick(state: CombatState): void {
  state.tick++
  state.events = []

  tickStatusEffects(state.units, state)   // 1. status effects
  tickMarks(state.units, state)           // 1b. mark detonations
  tickShields(state.units)                // 2. shields
  tickPersistentAoEZones(state)           // 2b. persistent AoE zones

  for (const unit of state.units.values()) {   // 3. mana lock + per-unit step
    if (unit.state === 'dead') continue
    tickManaLock(unit)
    tickUnit(unit, state)
  }

  tickProjectiles(state)                   // 4. projectiles
  reconcileHexOccupancy(state)             // 4b. repair any occupancy overlap this tick
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
    advanceCombatTick(state)

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
