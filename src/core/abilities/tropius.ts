import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import {
  hexDistance,
  offsetToCube,
  cubeToOffset,
  isValidHex,
  BOARD_ROWS,
  BOARD_COLS,
  type OffsetCoord,
} from '../hexGrid'
import { addStatusEffect } from '../systems/statusEffect'
import { applyDamage } from '../systems/damage'
import { createProjectile } from '../projectile'

export const TropiusAbility: AbilityHandler = {
  abilityId: 'tropius_leaf_tornado',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues   = [200, 275,  800] as const
    const knockUpSecs    = [2,   2,    5  ] as const
    const shieldPerHit   = [100, 130,  400] as const
    const shieldDurSecs  = [3,   4,    10 ] as const

    const damage        = damageValues[tier - 1]
    const knockupTicks  = knockUpSecs[tier - 1] * 60
    const shieldDurTicks = shieldDurSecs[tier - 1] * 60
    const shieldPer    = shieldPerHit[tier - 1]

    // Use current target (or nearest enemy) as direction reference
    let refTarget: Unit | null = null
    if (unit.targetId) {
      const t = state.units.get(unit.targetId)
      if (t && t.state !== 'dead') refTarget = t
    }
    if (!refTarget) {
      let bestDist = Infinity
      for (const other of state.units.values()) {
        if (other.team === unit.team || other.state === 'dead') continue
        const d = hexDistance(unit.hexPos, other.hexPos)
        if (d < bestDist) { bestDist = d; refTarget = other }
      }
    }
    if (!refTarget) return

    // Build a line from Tropius outward in the direction of the target
    const fromCube = offsetToCube(unit.hexPos)
    const toCube   = offsetToCube(refTarget.hexPos)
    const dq = toCube.q - fromCube.q
    const dr = toCube.r - fromCube.r
    const ds = toCube.s - fromCube.s
    const maxDelta = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds))

    if (maxDelta === 0) return

    const stepQ = dq / maxDelta
    const stepR = dr / maxDelta
    const stepS = ds / maxDelta

    const linePath: OffsetCoord[] = []
    for (let i = 1; i <= BOARD_ROWS + BOARD_COLS; i++) {
      const hex = cubeToOffset({
        q: Math.round(fromCube.q + stepQ * i),
        r: Math.round(fromCube.r + stepR * i),
        s: Math.round(fromCube.s + stepS * i),
      })
      if (!isValidHex(hex)) break
      linePath.push(hex)
    }

    // Collect enemies within 1 hex of the tornado path (3-hex wide corridor)
    const hitIds = new Set<string>()
    for (const lineHex of linePath) {
      for (const other of state.units.values()) {
        if (other.team === unit.team || other.state === 'dead' || hitIds.has(other.id)) continue
        if (hexDistance(lineHex, other.hexPos) <= 1) hitIds.add(other.id)
      }
    }

    // Emit tornado VFX travelling from Tropius toward target
    const vfxDx = refTarget.visualPos.x - unit.visualPos.x
    const vfxDy = refTarget.visualPos.y - unit.visualPos.y
    const vfxDist = Math.sqrt(vfxDx * vfxDx + vfxDy * vfxDy)
    if (vfxDist > 0) {
      state.events.push({
        type: 'vfx', effectId: 'tornado',
        x: unit.visualPos.x, y: unit.visualPos.y,
        dirX: vfxDx / vfxDist, dirY: vfxDy / vfxDist,
      })
    }

    // Spawn a per-enemy invisible projectile travelling at tornado speed.
    // Damage and knockup fire when the projectile arrives — naturally staggered by distance.
    const casterId = unit.id
    for (const enemyId of hitIds) {
      const other = state.units.get(enemyId)
      if (!other || other.state === 'dead') continue
      const proj = createProjectile({
        sourceId:  casterId,
        targetId:  other.id,
        startPos:  { ...unit.visualPos },
        speed:     7,   // matches tornado visual speed
        abilityId: 'tropius_leaf_tornado',
        onHit: (_src, tgt, hitState) => {
          const caster = hitState.units.get(casterId)
          applyDamage(caster ?? tgt, tgt, {
            baseAmount: damage,
            damageType: 'magic',
            canCrit:    false,
            abilityId:  'tropius_leaf_tornado',
          }, hitState)
          if (tgt.currentHp > 0) {
            addStatusEffect(tgt, {
              id:            'knockUp',
              sourceUnitId:  casterId,
              durationTicks: knockupTicks,
              stackId:       `tropius_knockup_${tgt.id}`,
            })
          }
        },
      })
      state.projectiles.set(proj.id, proj)
    }

    // Gain a shield for each enemy that will be hit (count known at cast time)
    const enemiesHit = hitIds.size
    if (enemiesHit > 0) {
      const totalShield = enemiesHit * shieldPer
      const shieldId    = `tropius_tornado_${unit.id}_${state.tick}`
      unit.shields.push({
        id:           shieldId,
        sourceAbility: 'tropius_leaf_tornado',
        value:        totalShield,
        maxValue:     totalShield,
        durationTicks: shieldDurTicks,
      })
      state.events.push({ type: 'shield', unitId: unit.id, amount: totalShield })
    }
  },
}
