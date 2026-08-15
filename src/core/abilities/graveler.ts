import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, Shield } from '../types'
import { addShield } from '../systems/shield'
import { computeStats } from '../unitFactory'

export const GravelerAbility: AbilityHandler = {
  abilityId: 'graveler_iron_defense',
  castTimeTicks: 0,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    // Passive — only apply once; guard against re-trigger if somehow mana fills
    if (unit.shields.some(s => s.sourceAbility === 'graveler_iron_defense')) return

    const baseValues = [200, 350, 500] as const
    const hpPcts     = [0.10, 0.20, 0.30] as const
    const defBonuses = [10,   20,   50  ] as const

    const spMult       = (unit._computedStats ?? computeStats(unit)).special / 100
    const shieldAmount = Math.round(baseValues[tier - 1] * spMult) + Math.round(unit.maxHp * hpPcts[tier - 1])
    const defBonus     = defBonuses[tier - 1]

    const shield: Shield = {
      id: `graveler_iron_defense_${unit.id}`,
      sourceAbility: 'graveler_iron_defense',
      value: shieldAmount,
      maxValue: shieldAmount,
      durationTicks: -1,  // lasts until broken by damage
      effectiveMaxHp: unit.currentHp + shieldAmount,  // extends the HP bar beyond max HP
      onExpire: (u: Unit) => {
        u.defense += defBonus
        u._computedStats = null
      },
    }

    addShield(unit, shield, state)
  },
}
