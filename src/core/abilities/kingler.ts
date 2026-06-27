import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { incrementSpellBuff } from '../systems/spellBuff'

export const KinglerAbility: AbilityHandler = {
  abilityId: 'kingler_crabhammer',
  castTimeTicks: 1,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const bonusDamageValues = [200, 350, 500] as const
    const bonusDamage = bonusDamageValues[tier - 1]
    // SpellBuff amplification is reserved for future implementation (currently 0%)

    unit.attackModifiers.push({
      id: `kingler_crabhammer_${unit.id}_${state.tick}`,
      remainingCharges: 1,
      bonusDamage,
      bonusDamageType: 'physical',
    })

    incrementSpellBuff(unit, state)
  },
}
