import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { createProjectile } from '../projectile'
import { findNearestEnemies } from '../systems/targeting'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'
import { hexDistance } from '../hexGrid'
import { combatRng } from '../rng'

// Picks a random living enemy of `source` within 2 hexes of `fromUnit`,
// excluding `fromUnit` itself — the bounce-target-selection step shared by
// every bounce (primary → bounce 1, and bounce 1 → bounce 2 for shiny).
function selectBounceTarget(source: Unit, fromUnit: Unit, state: CombatState): Unit | undefined {
  const candidates = [...state.units.values()].filter(u =>
    u.team !== source.team &&
    u.state !== 'dead' &&
    u.id !== fromUnit.id &&
    hexDistance(fromUnit.hexPos, u.hexPos) <= 2
  )
  if (candidates.length === 0) return undefined
  return candidates[Math.floor(combatRng() * candidates.length)]
}

// Launches one egg-bounce projectile from `fromUnit`'s position toward
// `toTarget`, dealing `baseAmount * damageMult` magic damage. `onHit` lets a
// bounce chain into a further bounce (shiny's second bounce only).
function launchEggBounce(
  source: Unit,
  fromUnit: Unit,
  toTarget: Unit,
  baseAmount: number,
  damageMult: number,
  state: CombatState,
  onHit?: (source: Unit | undefined, target: Unit, state: CombatState) => void,
): void {
  const bdx = toTarget.visualPos.x - fromUnit.visualPos.x
  const bdy = toTarget.visualPos.y - fromUnit.visualPos.y
  const bounceDist = Math.sqrt(bdx * bdx + bdy * bdy)
  const bounceProj = createProjectile({
    sourceId: source.id,
    targetId: toTarget.id,
    startPos: { ...fromUnit.visualPos },
    speed: 6,
    arcHeight: 80,
    launchDist: bounceDist,
    damagePayload: { baseAmount: Math.round(baseAmount * damageMult), damageType: 'magic', canCrit: false, abilityScalingStat: 'special' },
    abilityId: 'a_exeggutor_egg_bounce',
    onHit,
  })
  state.projectiles.set(bounceProj.id, bounceProj)
}

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
        const bounceTgt = selectBounceTarget(source, hitTarget, st)
        if (!bounceTgt) return

        // Shiny: the egg bounces one EXTRA time (at 25% damage) after this
        // bounce lands, chained off ITS landing target — a non-shiny caster
        // gets exactly this one unconditional bounce, unchanged.
        const chainSecondBounce = source.isShiny
          ? (src2: Unit | undefined, tgt2: Unit, st2: CombatState) => {
              if (!src2) return
              const secondBounceTgt = selectBounceTarget(src2, tgt2, st2)
              if (!secondBounceTgt) return
              launchEggBounce(src2, tgt2, secondBounceTgt, baseAmount, 0.25, st2)
            }
          : undefined

        launchEggBounce(source, hitTarget, bounceTgt, baseAmount, 0.5, st, chainSecondBounce)
      },
      abilityId: 'a_exeggutor_egg_bomb',
    })
    state.projectiles.set(proj.id, proj)

    incrementSpellBuff(unit, state)
  },
}
