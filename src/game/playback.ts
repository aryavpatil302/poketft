// Playback: the consumer side of a recorded FightLog. Turns a FightLog back
// into a CombatState-shaped object the existing canvas render layers already
// know how to draw — headlessly, with no browser globals and no re-simulation.
// This is the exact code Phase 4 reuses when a log arrives over a socket
// instead of from a local recordFight call (see src/game/round.ts).

import type { CombatState, Projectile } from '../core/types'
import { makeUnit } from '../core/unitFactory'
import { hexId } from '../core/hexGrid'
import type { FightFrame, FightLog } from './round'

// ─── State construction ─────────────────────────────────────────────────────

// Builds the same literal createCombatState builds, but with no units and no
// registered behaviour. Deliberately does NOT call createCombatState: that
// function runs initAbilityPassives / initItemPassives / initTraitEffects,
// which register live combat behaviour (ability triggers, item procs, trait
// thresholds) onto units — behaviour a replay must never run, because every
// value playback shows is already recorded in the log, not derived live.
export function createPlaybackState(log: FightLog): CombatState {
  return {
    tick: 0,
    phase: 'combat',
    units: new Map(),
    projectiles: new Map(),
    events: [],
    hexOccupancy: new Map(),
    terrain: { electric: false, psychic: false, grassy: false, misty: false, sunny: false },
    tailwind: { player: false, enemy: false },
    earthquakeCounts: new Map(),
    spellBuffCounters: new Map(),
    persistentAoEZones: [],
    stage: log.stage,
  }
}

// ─── Frame application ──────────────────────────────────────────────────────

// Reconciles `state` to look exactly like `frame`. Reconcile, don't rebuild:
// the unit set is derived fresh from the frame every call (summons and
// spawned crawlers enter and leave mid-fight, so nothing about the unit set
// can be assumed fixed across frames). Calls no function from
// src/core/systems/ and never calls advanceCombatTick — playback re-derives
// nothing, it only replays what recordFight already captured.
export function applyFrame(state: CombatState, frame: FightFrame): void {
  state.tick = frame.tick

  // Drop units the frame no longer names (expired summons, dead-and-removed
  // units, etc.) from both the unit map and hex occupancy.
  const frameIds = new Set(frame.units.map(uf => uf.id))
  for (const id of state.units.keys()) {
    if (!frameIds.has(id)) {
      const existing = state.units.get(id)
      if (existing) state.hexOccupancy.delete(hexId(existing.hexPos))
      state.units.delete(id)
    }
  }

  // Create-on-first-sight, then overwrite every recorded field. Every other
  // field stays whatever makeUnit initialised — playback never reads them for
  // correctness, and the renderer only reads what is being set here.
  for (const uf of frame.units) {
    let unit = state.units.get(uf.id)
    if (!unit) {
      unit = makeUnit(uf.definitionId, uf.team, uf.tier)
      unit.id = uf.id   // force the id so later frames and every event's
      // sourceId/targetId resolve back to this same object.
      state.units.set(uf.id, unit)
    }
    unit.currentHp = uf.currentHp
    unit.maxHp = uf.maxHp
    unit.currentMana = uf.currentMana
    unit.maxMana = uf.maxMana
    unit.hexPos = { col: uf.hexPos.col, row: uf.hexPos.row }     // fresh object —
    unit.visualPos = { x: uf.visualPos.x, y: uf.visualPos.y }    // the frame must stay replayable.
    unit.state = uf.state as typeof unit.state
    unit.items = [...uf.items]
    // Animation-driving fields — without these the renderer's windup/lunge/
    // squash-stretch math sees makeUnit's frozen zero/false/empty defaults
    // every frame, so nothing animates even though position and HP are
    // correct. Restoring them is the whole fix: playback replaces exactly
    // what a live tick would have left on the unit at this instant.
    unit.targetId = uf.targetId
    unit.attackTimer = uf.attackTimer
    unit.attackWindupTimer = uf.attackWindupTimer
    unit.isInWindup = uf.isInWindup
    unit.pendingCrit = uf.pendingCrit
    unit.abilityCastTimer = uf.abilityCastTimer
    unit.attackCount = uf.attackCount
    unit.attackModifiers = uf.attackModifiers.map(m => ({ ...m }))
    unit.shields = uf.shields.map(s => ({ ...s }))
    unit.statusEffects = uf.statusEffects.map(fx => ({ ...fx }))
    unit.marks = uf.marks.map(m => ({ ...m }))
    unit.dmgDealt = { ...uf.dmgDealt }
    unit.dmgTaken = { ...uf.dmgTaken }
    unit._leap = uf.leap
      ? { ...uf.leap, destHex: unit.hexPos, midpointFired: true }
      : undefined
  }

  // Occupancy is derived state with no history — rebuilding from the frame's
  // units is cheaper and less error-prone than diffing against the old map.
  state.hexOccupancy.clear()
  for (const uf of frame.units) {
    state.hexOccupancy.set(hexId(uf.hexPos), uf.id)
  }

  // Projectiles are fully replaced every frame. speed: 0 is deliberate: a
  // replayed projectile is positioned, never moved — and onHit/onTick/
  // damagePayload/healPayload are left undefined because a recorded
  // projectile has no behaviour left to run and the effect layer never reads
  // them (see round.ts's ProjectileFrame comment for the same reasoning).
  const projectiles = new Map<string, Projectile>()
  for (const pf of frame.projectiles) {
    const projectile: Projectile = {
      id: pf.id,
      sourceId: pf.sourceId,
      startPos: { x: pf.startPos.x, y: pf.startPos.y },
      currentPos: { x: pf.currentPos.x, y: pf.currentPos.y },
      speed: 0,
      hitRadius: pf.hitRadius,
      ...(pf.targetId !== undefined ? { targetId: pf.targetId } : {}),
      ...(pf.targetPos !== undefined ? { targetPos: { x: pf.targetPos.x, y: pf.targetPos.y } } : {}),
      ...(pf.arcHeight !== undefined ? { arcHeight: pf.arcHeight } : {}),
      ...(pf.launchDist !== undefined ? { launchDist: pf.launchDist } : {}),
      ...(pf.abilityId !== undefined ? { abilityId: pf.abilityId } : {}),
      ...(pf.damagePayload !== undefined ? { damagePayload: { ...pf.damagePayload } } : {}),
      ...(pf.healPayload !== undefined ? { healPayload: { ...pf.healPayload } } : {}),
    }
    projectiles.set(pf.id, projectile)
  }
  state.projectiles = projectiles

  // The frame's array by reference is fine — nothing here (or in the render
  // layers) mutates it.
  state.events = frame.events
  state.terrain = { ...frame.terrain }
  state.tailwind = { ...frame.tailwind }
}

// ─── Log-level helpers ──────────────────────────────────────────────────────

export function playbackLength(log: FightLog): number {
  return log.frames.length
}

// Returns the recorded outcome verbatim — never re-derived from reconstructed
// unit state. Re-deriving the winner during playback would reintroduce the
// client-side re-simulation this project explicitly cut (REQUIREMENTS.md
// COMBAT-02), and would let two clients disagree about a fight they were both
// handed the same log for.
export function playbackWinner(log: FightLog): 'player' | 'enemy' | 'draw' {
  return log.winner
}
