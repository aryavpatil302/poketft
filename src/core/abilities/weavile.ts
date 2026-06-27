import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'

export const WeavileAbility: AbilityHandler = {
  abilityId: 'weavile_triple_axel',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const mod1Damages        = [100, 150, 250] as const
    const mod2AoeDamages     = [80,  120, 200] as const
    const mod3MaxHpPercents  = [0.06, 0.08, 0.12] as const

    const mod1Damage       = mod1Damages[tier - 1]
    const mod2AoeDamage    = mod2AoeDamages[tier - 1]
    const mod3MaxHpPercent = mod3MaxHpPercents[tier - 1]

    const sourceRef = unit

    // Modifier 1: physical bonus damage hit
    unit.attackModifiers.push({
      id: 'weavile_1',
      remainingCharges: 1,
      bonusDamage: mod1Damage,
      bonusDamageType: 'physical',
    })

    // Modifier 2: AoE magic spin — bonusDamage=0 to skip direct bonus; onHit handles the magic burst
    const aoeAmount = mod2AoeDamage
    unit.attackModifiers.push({
      id: 'weavile_2',
      remainingCharges: 1,
      bonusDamage: 0,
      bonusDamageType: 'magic',
      aoeRadius: 1,
      onHit: (src: Unit, tgt: Unit, st: CombatState) => {
        applyDamage(src, tgt, {
          baseAmount: aoeAmount,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'weavile_triple_axel',
        }, st)
      },
    })

    // Modifier 3: max health percent damage + knockUp
    unit.attackModifiers.push({
      id: 'weavile_3',
      remainingCharges: 1,
      maxHealthPercent: mod3MaxHpPercent,
      knockUp: true,
    })
  },
}
