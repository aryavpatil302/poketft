import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { hexDistance } from '../hexGrid'
import { applyDamage } from '../systems/damage'
import { createProjectile } from '../projectile'

export const ToucannonAbility: AbilityHandler = {
  abilityId: 'toucannon_beak_blast',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const mainDamageValues  = [300, 475, 2000] as const
    const healValues        = [75,  100,  500] as const
    const splashDamValues   = [200, 275,  600] as const

    const mainDamage   = mainDamageValues[tier - 1]
    const healAmount   = healValues[tier - 1]
    const splashDamage = splashDamValues[tier - 1]

    // Target current auto-attack target, fall back to nearest enemy
    const target: Unit | null = (unit.targetId ? state.units.get(unit.targetId) ?? null : null)
      ?? (() => {
        let best: Unit | null = null
        let bestDist = Infinity
        for (const other of state.units.values()) {
          if (other.team === unit.team || other.state === 'dead') continue
          const d = hexDistance(unit.hexPos, other.hexPos)
          if (d < bestDist) { bestDist = d; best = other }
        }
        return best
      })()
    if (!target || target.state === 'dead') return

    // Capture values for closure
    const casterId     = unit.id
    const casterTeam   = unit.team

    const proj = createProjectile({
      sourceId: unit.id,
      targetId: target.id,
      startPos: { ...unit.visualPos },
      speed: 14,
      damagePayload: {
        baseAmount: mainDamage,
        damageType: 'physical',
        canCrit:    true,
      },
      onHit: (_source, hitTarget, hitState) => {
        const caster = hitState.units.get(casterId)

        // AoE explosion in 1 hex radius around the blast target
        for (const other of hitState.units.values()) {
          if (other.id === hitTarget.id || other.state === 'dead') continue
          if (hexDistance(hitTarget.hexPos, other.hexPos) > 1) continue

          if (other.team === casterTeam) {
            // Ally: heal
            const actualHeal = Math.min(healAmount, other.maxHp - other.currentHp)
            if (actualHeal > 0) {
              other.currentHp += actualHeal
              hitState.events.push({
                type:     'heal',
                targetId: other.id,
                amount:   actualHeal,
                sourceId: casterId,
              })
            }
          } else {
            // Enemy: splash magic damage
            applyDamage(
              caster ?? hitTarget,
              other,
              { baseAmount: splashDamage, damageType: 'magic', canCrit: false, abilityId: 'toucannon_beak_blast' },
              hitState,
            )
          }
        }
        // Visual: expanding explosion ring at impact point
        hitState.events.push({
          type: 'vfx',
          effectId: 'beak_blast_explosion',
          x: hitTarget.visualPos.x,
          y: hitTarget.visualPos.y,
        })
      },
      abilityId: 'toucannon_beak_blast',
    })
    state.projectiles.set(proj.id, proj)
  },
}
