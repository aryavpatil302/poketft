import type { Projectile, DamagePayload, HealPayload, CombatState, Unit } from './types'
import { applyDamage } from './systems/damage'
import { gainManaOnDamageTaken } from './systems/mana'

export function createProjectile(opts: {
  sourceId: string
  targetId: string
  startPos: { x: number; y: number }
  speed: number
  damagePayload?: DamagePayload
  healPayload?: HealPayload
  onHit?: (source: Unit | undefined, target: Unit, state: CombatState) => void
  onTick?: (proj: import('./types').Projectile, source: Unit | undefined, state: CombatState) => void
  abilityId?: string
  hitRadius?: number
  arcHeight?: number
  launchDist?: number
}): Projectile {
  return {
    id: `proj_${Math.random().toString(36).slice(2, 9)}`,
    sourceId: opts.sourceId,
    targetId: opts.targetId,
    startPos: { ...opts.startPos },
    currentPos: { ...opts.startPos },
    speed: opts.speed,
    damagePayload: opts.damagePayload,
    healPayload: opts.healPayload,
    onHit: opts.onHit,
    onTick: opts.onTick,
    abilityId: opts.abilityId,
    hitRadius: opts.hitRadius ?? 8,
    arcHeight: opts.arcHeight,
    launchDist: opts.launchDist,
  }
}

// Advance all projectiles one tick — move toward target, apply effect on hit
export function tickProjectiles(state: CombatState): void {
  const toRemove: string[] = []

  for (const [projId, proj] of state.projectiles) {
    const target = state.units.get(proj.targetId)
    if (!target || target.state === 'dead') {
      toRemove.push(projId)
      continue
    }

    const source = state.units.get(proj.sourceId)

    // Per-tick callback (e.g. line-damage as projectile passes through units)
    if (proj.onTick) proj.onTick(proj, source, state)

    // Move toward target's current visual position
    const dx = target.visualPos.x - proj.currentPos.x
    const dy = target.visualPos.y - proj.currentPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist <= proj.speed + proj.hitRadius) {
      // Hit — apply damage or heal
      if (proj.damagePayload && source) {
        const payload = proj.abilityId
          ? { ...proj.damagePayload, abilityId: proj.abilityId }
          : proj.damagePayload
        const result = applyDamage(source, target, payload, state)
        gainManaOnDamageTaken(target, result.preMitigDamage)
      }

      if (proj.healPayload) {
        const healAmount = Math.round(proj.healPayload.amount)
        target.currentHp = Math.min(target.maxHp, target.currentHp + healAmount)
        state.events.push({
          type: 'heal',
          targetId: target.id,
          amount: healAmount,
          sourceId: proj.sourceId,
        })
      }

      // Fire on-hit callback (used for status effects, etc.)
      if (proj.onHit) {
        proj.onHit(source, target, state)
      }

      toRemove.push(projId)
    } else {
      // Advance
      const nx = proj.currentPos.x + (dx / dist) * proj.speed
      const ny = proj.currentPos.y + (dy / dist) * proj.speed
      proj.currentPos = { x: nx, y: ny }
    }
  }

  for (const id of toRemove) state.projectiles.delete(id)
}
