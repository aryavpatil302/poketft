import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { createProjectile } from '../projectile'
import { findNearestEnemies } from '../systems/targeting'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'
import { hexDistance } from '../hexGrid'
import { combatRng } from '../rng'

export const AExeggutorAbility: AbilityHandler = {
  abilityId: 'a_exeggutor_egg_bomb',
  // castTimeTicks=35: cock-back (30 ticks) then forward swing — the egg launches partway
  // into the swing (see the 'cock_toss' animation) so it releases as the arm comes through
  castTimeTicks: 35,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const damageValues = [600, 800, 1000] as const
    const baseAmount   = damageValues[tier - 1]

    const attackTarget = unit.targetId ? state.units.get(unit.targetId) : undefined
    const target = (attackTarget && attackTarget.state !== 'dead' && attackTarget.team !== unit.team)
      ? attackTarget
      : findNearestEnemies(unit, state, 1)[0]
    if (!target) return

    const spellBuff = getSpellBuff(unit, state)

    const dx = target.visualPos.x - unit.visualPos.x
    const dy = target.visualPos.y - unit.visualPos.y
    const launchDist = Math.sqrt(dx * dx + dy * dy)

    const proj = createProjectile({
      sourceId: unit.id,
      targetId: target.id,
      startPos: { ...unit.visualPos },
      speed: 6,
      arcHeight: 120,
      launchDist,
      damagePayload: { baseAmount, damageType: 'magic', canCrit: false, abilityScalingStat: 'special' },
      onHit: (source: Unit | undefined, hitTarget: Unit, st: CombatState) => {
        if (!source) return

        // Bonus true damage: always (10 + spellBuff)% of base — fires if target survived
        if (hitTarget.state !== 'dead') {
          const bonusTrueDmg = Math.round((0.10 + spellBuff * 0.01) * baseAmount)
          applyDamage(source, hitTarget, {
            baseAmount:        bonusTrueDmg,
            damageType:        'true',
            canCrit:           false,
            abilityScalingStat: 'special',
            abilityId:         'a_exeggutor_egg_bomb',
            // Beachy contributes the (spellBuff)% beyond the base 10% of this bonus.
            beachyFrac:        (spellBuff * 0.01) / (0.10 + spellBuff * 0.01),
          }, st)
        }

        // Bounce always fires, even if the first hit killed the target
        const bounceTargets = [...st.units.values()].filter(u =>
          u.team !== source.team &&
          u.state !== 'dead' &&
          u.id !== hitTarget.id &&
          hexDistance(hitTarget.hexPos, u.hexPos) <= 2
        )
        if (bounceTargets.length === 0) return
        const bounceTgt = bounceTargets[Math.floor(combatRng() * bounceTargets.length)]
        const bdx = bounceTgt.visualPos.x - hitTarget.visualPos.x
        const bdy = bounceTgt.visualPos.y - hitTarget.visualPos.y
        const bounceDist = Math.sqrt(bdx * bdx + bdy * bdy)
        const bounceProj = createProjectile({
          sourceId: source.id,
          targetId: bounceTgt.id,
          startPos: { ...hitTarget.visualPos },
          speed: 6,
          arcHeight: 80,
          launchDist: bounceDist,
          damagePayload: { baseAmount: Math.round(baseAmount * 0.5), damageType: 'magic', canCrit: false, abilityScalingStat: 'special' },
          abilityId: 'a_exeggutor_egg_bounce',
        })
        st.projectiles.set(bounceProj.id, bounceProj)
      },
      abilityId: 'a_exeggutor_egg_bomb',
    })
    state.projectiles.set(proj.id, proj)

    incrementSpellBuff(unit, state)
  },
}
