import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { computeStats } from '../../core/unitFactory'
import { applyDamage } from '../systems/damage'
import { MANA_PER_AUTO_HIT } from '../constants'

function onHitBonus(mult: number) {
  return (src: Unit, tgt: Unit, st: CombatState) => {
    if (tgt.state === 'dead') return
    const stats = src._computedStats ?? computeStats(src)

    // Base auto already dealt 100% — add the remainder to reach mult × attack
    const bonus = Math.round(stats.attack * (mult - 1.0))
    if (bonus > 0) {
      applyDamage(src, tgt, {
        baseAmount: bonus,
        damageType: 'physical',
        canCrit: true,
        abilityId: 'pidgeotto_dual_wingbeat',
      }, st)
    }

    // Grant mana as a normal auto would — bypass manaLockTimer since these ARE autos
    src.currentMana = Math.min(src.maxMana, src.currentMana + MANA_PER_AUTO_HIT)
  }
}

export const PidgeottoAbility: AbilityHandler = {
  abilityId: 'pidgeotto_dual_wingbeat',
  castTimeTicks: 15,

  onCast(unit: Unit, _state: CombatState, tier: number): void {
    const mult = ([1.10, 1.20, 1.50] as const)[tier - 1]

    // First wing slap: right wing (CW cock → CCW strike)
    unit.attackModifiers.push({
      id: 'pidgeotto_wing_slap',
      remainingCharges: 1,
      swingDir: 1,
      onHit: onHitBonus(mult),
    })

    // Second wing slap: left wing (CCW cock → CW strike), fires immediately after first windup ends
    unit.attackModifiers.push({
      id: 'pidgeotto_wing_slap',
      remainingCharges: 1,
      swingDir: -1,
      instantFollowUp: true,
      onHit: onHitBonus(mult),
    })
  },
}
