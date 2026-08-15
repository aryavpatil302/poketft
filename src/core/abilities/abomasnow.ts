import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import type { OffsetCoord } from '../hexGrid'
import { TICK_RATE, HEX_SIZE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { hexesInRange, hexId, hexToPixel } from '../hexGrid'

const ZONE_RADIUS   = 1
const ZONE_ID_PRE   = 'abomasnow_blizzard'
const TICK_INTERVAL = Math.round(TICK_RATE * 0.5)  // 30 ticks = 0.5s
const ZONE_DURATION = 4 * TICK_RATE                // 240 ticks

function bestCenter(unit: Unit, state: CombatState): OffsetCoord {
  const enemyTeam = unit.team === 'player' ? 'enemy' : 'player'
  let best = unit.hexPos
  let bestCount = 0

  for (const candidate of state.units.values()) {
    if (candidate.team !== enemyTeam || candidate.state === 'dead') continue
    let count = 0
    for (const h of hexesInRange(candidate.hexPos, ZONE_RADIUS)) {
      const uid = state.hexOccupancy.get(hexId(h))
      if (!uid) continue
      const u = state.units.get(uid)
      if (u && u.team === enemyTeam && u.state !== 'dead') count++
    }
    if (count > bestCount) { bestCount = count; best = candidate.hexPos }
  }
  return best
}

export const AbomasnowAbility: AbilityHandler = {
  abilityId: 'abomasnow_blizzard',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const castDamages = [300, 50, 1000] as const
    const tickDamages = [50, 75, 500] as const

    const castDmg   = castDamages[tier - 1]
    const tickDmg   = tickDamages[tier - 1]
    const enemyTeam = unit.team === 'player' ? 'enemy' : 'player'
    const casterId  = unit.id
    const zoneId    = `${ZONE_ID_PRE}_${casterId}`
    const center    = bestCenter(unit, state)

    // Clear any previous blizzard debuffs on recast
    for (const [, u] of state.units) {
      u.statusEffects = u.statusEffects.filter(fx =>
        !fx.stackId?.startsWith(`blizzard_chill_${zoneId}`) &&
        !fx.stackId?.startsWith(`blizzard_shred_${zoneId}`)
      )
    }

    // Collect enemies in initial burst radius
    const targets: Unit[] = []
    for (const h of hexesInRange(center, ZONE_RADIUS)) {
      const uid = state.hexOccupancy.get(hexId(h))
      if (!uid) continue
      const target = state.units.get(uid)
      if (!target || target.team !== enemyTeam || target.state === 'dead') continue
      targets.push(target)
    }

    // Instant burst damage
    for (const target of targets) {
      applyDamage(unit, target, {
        baseAmount:        castDmg,
        damageType:        'magic',
        canCrit:           false,
        abilityScalingStat: 'special',
        abilityId:         'abomasnow_blizzard',
      }, state)
    }

    // Initial big blizzard burst VFX (short-lived — just for the cast animation)
    const pos = hexToPixel(center, HEX_SIZE)
    state.events.push({ type: 'vfx', effectId: 'abomasnow_blizzard_start', x: pos.x, y: pos.y, zoneId })

    // Per-unit tick damage + MR shred + mini blizzard VFX that follows each unit
    for (const target of targets) {
      if (target.state === 'dead') continue
      const targetId = target.id
      let ticksUntilDamage = TICK_INTERVAL

      addStatusEffect(target, {
        id: 'blizzard_chill',
        sourceUnitId: casterId,
        durationTicks: ZONE_DURATION,
        stackId: `blizzard_chill_${zoneId}_${targetId}`,
        tickEffect: (tgt: Unit, st: CombatState) => {
          ticksUntilDamage--
          if (ticksUntilDamage > 0) return
          ticksUntilDamage = TICK_INTERVAL

          if (tgt.state === 'dead') return
          const src = st.units.get(casterId)
          if (!src) return
          applyDamage(src, tgt, {
            baseAmount:        tickDmg,
            damageType:        'magic',
            canCrit:           false,
            abilityScalingStat: 'special',
            abilityId:         'abomasnow_blizzard',
          }, st)
        },
      })

      // Shred MR for 3 seconds
      addStatusEffect(target, {
        id: 'shred',
        sourceUnitId: casterId,
        durationTicks: 3 * TICK_RATE,
        magnitude: 30,
        stackId: `blizzard_shred_${zoneId}_${targetId}`,
      })

      // Mini blizzard VFX that follows this unit for the blizzard duration
      state.events.push({ type: 'vfx', effectId: 'abomasnow_blizzard_unit', targetId, zoneId })
    }
  },
}
