import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'

export const BelliboltAbility: AbilityHandler = {
  abilityId: 'bellibolt_electrophoresis',
  castTimeTicks: 25,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const dmgPerChargeValues = [15, 20, 30] as const
    const dmgPerCharge = dmgPerChargeValues[tier - 1]

    const charges = unit.attackCount
    const totalDmg = charges * dmgPerCharge

    // Collect all living enemies
    const enemies: Unit[] = []
    for (const other of state.units.values()) {
      if (other.team === unit.team || other.state === 'dead') continue
      enemies.push(other)
    }

    if (enemies.length === 0) {
      unit.attackCount = 0
      return
    }

    const dmgPerEnemy = totalDmg > 0 ? Math.round(totalDmg / enemies.length) : 0

    if (dmgPerEnemy > 0) {
      for (const enemy of enemies) {
        applyDamage(unit, enemy, {
          baseAmount: dmgPerEnemy,
          damageType: 'magic',
          canCrit: false,
          abilityId: 'bellibolt_electrophoresis',
        }, state)
      }
    }

    // Reset charge counter after discharge
    unit.attackCount = 0
  },
}
