import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { getSpellBuff, incrementSpellBuff } from '../systems/spellBuff'

export const KinglerAbility: AbilityHandler = {
  abilityId: 'kingler_crabhammer',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const baseDamageValues = [200, 350, 500] as const
    const spellBuff = getSpellBuff(unit, state)
    // Each spell buff stack amplifies the bonus damage by 1%
    const bonusDamage = Math.round(baseDamageValues[tier - 1] * (1 + spellBuff * 0.01))

    unit.attackModifiers.push({
      id: `kingler_crabhammer_${unit.id}_${state.tick}`,
      remainingCharges: 1,
      bonusDamage,
      bonusDamageType: 'physical',
      // Beachy's share of the bonus: the (spellBuff)% amplification above the base.
      bonusBeachyFrac: (spellBuff * 0.01) / (1 + spellBuff * 0.01),
      suppressBaseAttack: true,
    })

    // Snap the post-cast wait to 10% so the empowered cockback follows almost instantly
    unit.attackTimer = Math.round(unit.attackTimer * 0.1)

    incrementSpellBuff(unit, state)
  },
}
