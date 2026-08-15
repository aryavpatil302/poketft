import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import type { OffsetCoord } from '../hexGrid'
import { HEX_SIZE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect, removeStatusEffect } from '../systems/statusEffect'
import {
  hexesInRange, hexId, hexDistance,
  hexToPixel, pixelToHex, isValidHex,
} from '../hexGrid'
import { findNearestEnemies } from '../systems/targeting'
import { startLeap, findNearestOpenHex } from '../systems/movement'

// ─── Phase timing (ticks) ─────────────────────────────────────────────────────
const MEGA_EVO_SHAKE_TICKS  = 36   // evo overlay shake  (normal sprite)
const MEGA_PRE_GRAB_TICKS   = 24   // post-evo mega rumble before grab
const GRAB_HOLD_TICKS       = 5    // pause on enemy hex after lunging
const FLY_OFF_TICKS         = 14   // slide both off to the right
const OFFSCREEN_WAIT        = 30   // hang off-screen before returning (~0.5 second)
const FLY_IN_TICKS          = 16   // slam back in from the right

const OFF_SCREEN_X = 1400          // pixel X past the right board edge

// ─── Ability ──────────────────────────────────────────────────────────────────

export const RayquazaAbility: AbilityHandler = {
  abilityId: 'rayquaza_dragon_ascent',
  castTimeTicks: 10,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damages = [300, 450, 9999] as const
    const hpPcts  = [0.02, 0.05, 9.99] as const
    const damage  = damages[tier - 1]
    const hpPct   = hpPcts[tier - 1]

    const isMega = unit.statusEffects.some(fx => fx.id === 'rayquaza_is_mega')

    const atkTarget  = unit.targetId ? state.units.get(unit.targetId) : undefined
    const grabTarget = (atkTarget && atkTarget.state !== 'dead' && atkTarget.team !== unit.team)
      ? atkTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!grabTarget) return

    const originHex: OffsetCoord = { ...unit.hexPos }

    if (isMega) {
      doGrab(unit, state, grabTarget.id, originHex, damage, hpPct)
    } else {
      // Phase A: 36-tick evo shake — normal sprite + overlay fades in/out
      addStatusEffect(unit, {
        id: 'rayquaza_evo_shake',
        sourceUnitId: unit.id,
        durationTicks: MEGA_EVO_SHAKE_TICKS,
        stackId: 'rayquaza_evo_shake',
        tickEffect: (u) => { u.state = 'ascended' },
        onExpire: (u, _s) => {
          const megaAtkBonus = [50, 90, 500][tier - 1]

          // Sprite NOW snaps to mega form
          addStatusEffect(u, {
            id: 'rayquaza_is_mega',
            sourceUnitId: u.id,
            durationTicks: -1,
            stackId: 'rayquaza_is_mega',
          })
          // Permanent stat bonus that persists for the rest of combat
          addStatusEffect(u, {
            id: 'rayquaza_mega_atk',
            sourceUnitId: u.id,
            durationTicks: -1,
            stackId: 'rayquaza_mega_atk',
            magnitude: megaAtkBonus,
          })
          // Phase B: 24-tick mega rumble before grab
          addStatusEffect(u, {
            id: 'rayquaza_pre_grab_rumble',
            sourceUnitId: u.id,
            durationTicks: MEGA_PRE_GRAB_TICKS,
            stackId: 'rayquaza_pre_grab_rumble',
            tickEffect: (u2) => { u2.state = 'ascended' },
            onExpire: (u2, s2) => {
              const fresh = s2.units.get(grabTarget.id)
              if (fresh && fresh.state !== 'dead') {
                doGrab(u2, s2, fresh.id, originHex, damage, hpPct)
              } else {
                const [next] = findNearestEnemies(u2, s2, 1)
                if (next) doGrab(u2, s2, next.id, originHex, damage, hpPct)
                else u2.state = 'idle'
              }
            },
          })
        },
      })
      unit.state = 'ascended'      // held frozen by tickEffect each tick
      unit.incomingDamageMult = 0  // invulnerable for the full evo sequence
    }
  },
}

// ─── Phase functions ──────────────────────────────────────────────────────────

function doGrab(
  unit: Unit,
  state: CombatState,
  grabTargetId: string,
  originHex: OffsetCoord,
  damage: number,
  hpPct: number,
): void {
  unit.incomingDamageMult = 1.0  // evo phase over, restore normal damage intake

  const grabTarget = state.units.get(grabTargetId)
  if (!grabTarget || grabTarget.state === 'dead') {
    unit.state = 'idle'
    return
  }

  // If grab target is mid-dash, cancel its leap cleanly before grabbing.
  // startLeap (non-visualOnly) frees the origin hex from hexOccupancy but doesn't
  // claim the destination until tickLeapPixel completes — so the grab target has
  // no hex claimed. Interrupting it here restores occupancy so depositBoth works.
  if (grabTarget._leap) {
    if (!grabTarget._leap.visualOnly) {
      state.hexOccupancy.set(hexId(grabTarget.hexPos), grabTarget.id)
    }
    delete grabTarget._leap
  }

  // Grabbed unit: ascended (can't act), invulnerable, marked for unitLayer motion blur
  grabTarget.state = 'ascended'
  grabTarget.incomingDamageMult = 0
  addStatusEffect(grabTarget, {
    id: 'rayquaza_grabbed',
    sourceUnitId: unit.id,
    durationTicks: -1,
    stackId: 'rayquaza_grabbed',
  })

  // Leap to where the grab target visually appears (visualPos may be mid-dash,
  // ahead of hexPos which only updates on arrival).
  const snapPx  = grabTarget.visualPos
  const snapHex = pixelToHex(snapPx.x, snapPx.y, HEX_SIZE)
  const enemyHex: OffsetCoord = isValidHex(snapHex) ? snapHex : { ...grabTarget.hexPos }

  // Visual-only leap to enemy hex (Rayquaza's logical hexPos stays put)
  startLeap(unit, enemyHex, state, 2, (u, _s) => {
    addStatusEffect(u, {
      id: 'rayquaza_grab_hold',
      sourceUnitId: u.id,
      durationTicks: GRAB_HOLD_TICKS,
      stackId: 'rayquaza_grab_hold',
      tickEffect: (u2) => { u2.state = 'ascended' },
      onExpire: (u2, s2) => doFlyOff(u2, s2, grabTargetId, originHex, damage, hpPct),
    })
  }, undefined, true /* visualOnly */)

  unit.state = 'leaping'
}

function doFlyOff(
  unit: Unit,
  _state: CombatState,
  grabTargetId: string,
  originHex: OffsetCoord,
  damage: number,
  hpPct: number,
): void {
  unit.state = 'ascended'
  unit.incomingDamageMult = 0

  addStatusEffect(unit, {
    id: 'rayquaza_flying',
    sourceUnitId: unit.id,
    durationTicks: -1,
    stackId: 'rayquaza_flying',
  })

  const startX = unit.visualPos.x
  const startY = unit.visualPos.y
  let flyTick = 0

  addStatusEffect(unit, {
    id: 'rayquaza_fly_off',
    sourceUnitId: unit.id,
    durationTicks: FLY_OFF_TICKS,
    stackId: 'rayquaza_fly_off',
    tickEffect: (u, s) => {
      flyTick++
      const t    = Math.min(flyTick / FLY_OFF_TICKS, 1)
      const ease = t * t
      u.visualPos.x = startX + (OFF_SCREEN_X - startX) * ease
      u.visualPos.y = startY

      const grabbed = s.units.get(grabTargetId)
      if (grabbed) grabbed.visualPos = { x: u.visualPos.x - 50, y: u.visualPos.y + 20 }
    },
    onExpire: (u, _s) => {
      addStatusEffect(u, {
        id: 'rayquaza_offscreen_wait',
        sourceUnitId: u.id,
        durationTicks: OFFSCREEN_WAIT,
        stackId: 'rayquaza_offscreen_wait',
        onExpire: (u2, s2) => doFlyIn(u2, s2, grabTargetId, originHex, damage, hpPct),
      })
    },
  })
}

function doFlyIn(
  unit: Unit,
  state: CombatState,
  grabTargetId: string,
  originHex: OffsetCoord,
  damage: number,
  hpPct: number,
): void {
  // Furthest living enemy from originHex = slam target
  let slamTarget: Unit | null = null
  let bestDist = -1
  for (const u of state.units.values()) {
    if (u.team === unit.team || u.state === 'dead') continue
    const d = hexDistance(originHex, u.hexPos)
    if (d > bestDist) { bestDist = d; slamTarget = u }
  }

  if (!slamTarget) {
    removeStatusEffect(unit, 'rayquaza_flying')
    unit.incomingDamageMult = 1.0
    depositBoth(unit, state, grabTargetId, originHex)
    return
  }

  const slamHex     = { ...slamTarget.hexPos } as OffsetCoord
  const slamTargetId = slamTarget.id
  const slamPx      = hexToPixel(slamHex, HEX_SIZE)

  unit.visualPos = { x: OFF_SCREEN_X, y: slamPx.y }

  let flyTick = 0
  addStatusEffect(unit, {
    id: 'rayquaza_fly_in',
    sourceUnitId: unit.id,
    durationTicks: FLY_IN_TICKS,
    stackId: 'rayquaza_fly_in',
    tickEffect: (u, s) => {
      flyTick++
      const t    = Math.min(flyTick / FLY_IN_TICKS, 1)
      const ease = 1 - (1 - t) * (1 - t)
      u.visualPos.x = OFF_SCREEN_X + (slamPx.x - OFF_SCREEN_X) * ease
      u.visualPos.y = slamPx.y - Math.sin(t * Math.PI) * 50

      const grabbed = s.units.get(grabTargetId)
      if (grabbed) grabbed.visualPos = { x: u.visualPos.x - 50, y: u.visualPos.y + 20 }
    },
    onExpire: (u, s) => doSlam(u, s, grabTargetId, slamHex, slamTargetId, damage, hpPct),
  })
}

function doSlam(
  unit: Unit,
  state: CombatState,
  grabTargetId: string,
  slamHex: OffsetCoord,
  _slamTargetId: string,
  damage: number,
  hpPct: number,
): void {
  removeStatusEffect(unit, 'rayquaza_flying')
  unit.incomingDamageMult = 1.0

  const grabbed   = state.units.get(grabTargetId)
  const grabMaxHp = grabbed?.maxHp ?? 0
  const totalDmg  = damage + Math.round(grabMaxHp * hpPct)

  // Slam VFX — explosion image centered at slam hex, fades out over ~35 ticks
  const slamPx = hexToPixel(slamHex, HEX_SIZE)
  state.events.push({ type: 'vfx', effectId: 'dragon_slam', x: slamPx.x, y: slamPx.y })

  // Restore grabbed unit's damage immunity and deal full slam damage to it first
  if (grabbed) {
    removeStatusEffect(grabbed, 'rayquaza_grabbed')
    grabbed.incomingDamageMult = 1.0
    applyDamage(unit, grabbed, {
      baseAmount: totalDmg,
      damageType: 'physical',
      canCrit: true,
      abilityId: 'rayquaza_dragon_ascent',
    }, state)
  }

  // AoE: at 3-star hits the whole board; otherwise 1-hex radius = full, 2-hex = 50%
  if (unit.tier === 3) {
    for (const victim of state.units.values()) {
      if (victim.team === unit.team || victim.state === 'dead' || victim.id === grabTargetId) continue
      applyDamage(unit, victim, {
        baseAmount: totalDmg,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'rayquaza_dragon_ascent',
      }, state)
    }
  } else {
    for (const hex of hexesInRange(slamHex, 2)) {
      const uid = state.hexOccupancy.get(hexId(hex))
      if (!uid) continue
      const victim = state.units.get(uid)
      if (!victim || victim.team === unit.team || victim.state === 'dead') continue
      const dist = hexDistance(hex, slamHex)
      const mult = dist <= 1 ? 1.0 : 0.5
      applyDamage(unit, victim, {
        baseAmount: Math.round(totalDmg * mult),
        damageType: 'physical',
        canCrit: true,
        abilityId: 'rayquaza_dragon_ascent',
      }, state)
    }
  }

  depositBoth(unit, state, grabTargetId, slamHex)
}

function depositBoth(
  unit: Unit,
  state: CombatState,
  grabTargetId: string,
  slamHex: OffsetCoord,
): void {
  const grabbed   = state.units.get(grabTargetId)
  const grabAlive = grabbed != null && grabbed.state !== 'dead'

  // Release both units' hexes FIRST so they don't block each other's BFS
  state.hexOccupancy.delete(hexId(unit.hexPos))
  if (grabbed) state.hexOccupancy.delete(hexId(grabbed.hexPos))

  // Track which destinations have already been assigned so they're never shared
  const taken = new Set<string>()

  if (grabAlive) {
    removeStatusEffect(grabbed!, 'rayquaza_grabbed')
    grabbed!.incomingDamageMult = 1.0
    const dest = findNearestOpenHex(slamHex, state, { excluded: taken })
    if (dest) {
      taken.add(hexId(dest))
      grabbed!.hexPos    = { ...dest }
      grabbed!.visualPos = hexToPixel(dest, HEX_SIZE)
      state.hexOccupancy.set(hexId(dest), grabbed!.id)
    }
    grabbed!.state = 'idle'
  }

  // Rayquaza lands adjacent to grabbed unit (so he's in attack range); falls back to slamHex
  const rayqSrc = grabAlive ? grabbed!.hexPos : slamHex
  const rayqDest = findNearestOpenHex(rayqSrc, state, { excluded: taken })
  if (rayqDest) {
    unit.hexPos    = { ...rayqDest }
    unit.visualPos = hexToPixel(rayqDest, HEX_SIZE)
    state.hexOccupancy.set(hexId(rayqDest), unit.id)
  }
  unit.state = 'idle'

  // Point Rayquaza at his grabbed target if still alive, else AI re-acquires next tick
  if (grabAlive && grabbed) {
    unit.targetId = grabbed.id
  }
}

// findNearestOpenHex now lives in systems/movement.ts — same BFS, shared with
// every other placement path. Both units' hexes are freed before it runs, and
// `excluded` keeps this deposit from assigning the same hex twice.
