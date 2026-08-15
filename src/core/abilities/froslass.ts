import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { TICK_RATE, HEX_SIZE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { offsetToCube, cubeToOffset, isValidHex, hexId, hexToPixel, hexDistance } from '../hexGrid'
import { createProjectile } from '../projectile'

const BEAM_SPEED      = 12
const HIT_RADIUS      = 8
const HIT_THRESHOLD   = BEAM_SPEED + HIT_RADIUS + 4
const SHOT_DELAY      = 20  // ticks between each wind (~0.33s)

function cubeRound(q: number, r: number, s: number) {
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s)
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s)
  if (dq > dr && dq > ds) rq = -rr - rs
  else if (dr > ds)       rr = -rq - rs
  else                    rs = -rq - rr
  return { q: rq, r: rr, s: rs }
}

function spawnWind(
  casterId: string,
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  lineDirX: number,
  lineDirY: number,
  capturedTargets: Unit[],
  unitDists: number[],
  damages: number[],
  state: CombatState,
): void {
  const localHitSet = new Set<string>()
  const proj = createProjectile({
    sourceId: casterId,
    targetPos: endPos,
    startPos,
    speed: BEAM_SPEED,
    hitRadius: HIT_RADIUS,
    abilityId: 'froslass_icy_wind',
    onTick: (p, source, st) => {
      if (!source) return
      const travelX = p.currentPos.x - startPos.x
      const travelY = p.currentPos.y - startPos.y
      const projDist = travelX * lineDirX + travelY * lineDirY

      for (let i = 0; i < capturedTargets.length; i++) {
        const t = capturedTargets[i]
        if (localHitSet.has(t.id) || t.state === 'dead') continue
        if (projDist >= unitDists[i] - HIT_THRESHOLD) {
          localHitSet.add(t.id)
          applyDamage(source, t, {
            baseAmount:        damages[i],
            damageType:        'magic',
            canCrit:           false,
            abilityScalingStat: 'special',
            abilityId:         'froslass_icy_wind',
          }, st)
          addStatusEffect(t, {
            id: 'chill',
            sourceUnitId: casterId,
            durationTicks: 2 * TICK_RATE,
            magnitude: 0.25,
            stackId: `froslass_chill_${t.id}`,
          })
        }
      }
    },
  })
  state.projectiles.set(proj.id, proj)
}

export const FroslassAbility: AbilityHandler = {
  abilityId: 'froslass_icy_wind',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [100, 200, 400] as const
    const baseDamage   = damageValues[tier - 1]

    if (!unit.targetId) return
    const primaryTarget = state.units.get(unit.targetId)
    if (!primaryTarget) return

    const fc = offsetToCube(unit.hexPos)
    const tc = offsetToCube(primaryTarget.hexPos)
    const dq = tc.q - fc.q, dr = tc.r - fc.r, ds = tc.s - fc.s
    const N  = hexDistance(unit.hexPos, primaryTarget.hexPos)

    const seen = new Set<string>()
    const lineTargets: Unit[] = []

    const addIfEnemy = (off: { col: number; row: number }) => {
      if (!isValidHex(off)) return
      const id = state.hexOccupancy.get(hexId(off))
      if (!id || seen.has(id)) return
      const occ = state.units.get(id)
      if (occ && occ.team !== unit.team && occ.state !== 'dead') {
        seen.add(id)
        lineTargets.push(occ)
      }
    }

    for (let i = 1; i < N; i++) {
      addIfEnemy(cubeToOffset(cubeRound(
        fc.q + dq * i / N,
        fc.r + dr * i / N,
        fc.s + ds * i / N,
      )))
    }

    seen.add(primaryTarget.id)
    lineTargets.push(primaryTarget)

    let lastValidHex = primaryTarget.hexPos
    const stepQ = N > 0 ? dq / N : 0
    const stepR = N > 0 ? dr / N : 0
    const stepS = N > 0 ? ds / N : 0
    for (let step = 1; step <= 10; step++) {
      const off = cubeToOffset(cubeRound(
        tc.q + stepQ * step,
        tc.r + stepR * step,
        tc.s + stepS * step,
      ))
      if (!isValidHex(off)) break
      lastValidHex = off
      addIfEnemy(off)
    }

    lineTargets.sort((a, b) => {
      const dax = a.visualPos.x - unit.visualPos.x, day = a.visualPos.y - unit.visualPos.y
      const dbx = b.visualPos.x - unit.visualPos.x, dby = b.visualPos.y - unit.visualPos.y
      return (dax * dax + day * day) - (dbx * dbx + dby * dby)
    })

    let dmg: number = baseDamage
    const damages: number[] = []
    for (let i = 0; i < lineTargets.length; i++) {
      damages.push(dmg)
      dmg = Math.round(dmg * 0.75)
    }

    const capturedTargets = [...lineTargets]
    const casterId        = unit.id

    // Fixed geometry for all 3 shots (direction locked at cast time)
    const startPos  = { ...unit.visualPos }
    const endPos    = hexToPixel(lastValidHex, HEX_SIZE)
    const lineDX    = endPos.x - startPos.x
    const lineDY    = endPos.y - startPos.y
    const lineLen   = Math.sqrt(lineDX * lineDX + lineDY * lineDY) || 1
    const lineDirX  = lineDX / lineLen
    const lineDirY  = lineDY / lineLen
    const unitDists = capturedTargets.map(t =>
      (t.visualPos.x - startPos.x) * lineDirX +
      (t.visualPos.y - startPos.y) * lineDirY
    )

    // Shot 1 — fires immediately
    spawnWind(casterId, startPos, endPos, lineDirX, lineDirY, capturedTargets, unitDists, damages, state)

    // Shots 2 and 3 — staggered via status effect, each repeating the dart animation
    let shotsLeft = 2
    let countdown = SHOT_DELAY

    addStatusEffect(unit, {
      id: 'froslass_volley',
      sourceUnitId: casterId,
      durationTicks: SHOT_DELAY * 2 + 5,
      stackId: 'froslass_volley',
      tickEffect: (_u, st) => {
        countdown--
        if (countdown > 0 || shotsLeft <= 0) return
        countdown = SHOT_DELAY
        shotsLeft--
        spawnWind(casterId, startPos, endPos, lineDirX, lineDirY, capturedTargets, unitDists, damages, st)
        // Replay the dart cast animation for each follow-up shot
        st.events.push({ type: 'cast', unitId: casterId, abilityId: 'froslass_icy_wind' })
      },
    })
  },
}
