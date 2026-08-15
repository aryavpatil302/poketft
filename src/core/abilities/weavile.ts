import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { addStatusEffect, removeStatusEffectByStack } from '../systems/statusEffect'
import { hexesInRange, hexId } from '../hexGrid'
import { computeStats } from '../unitFactory'

const MANA_LOCK_STACK = 'triple_axel_mana_lock'

export const WeavileAbility: AbilityHandler = {
  abilityId: 'weavile_triple_axel',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const mod1Pcts           = [135, 200, 335] as const
    const mod2SpinDamages    = [150, 200, 275] as const
    const mod3MaxHpPercents  = [0.10, 0.10, 0.15] as const

    const stats        = computeStats(unit)
    const mod1Damage   = Math.round(stats.attack * (mod1Pcts[tier - 1] / 100))
    const mod2SpinDamage  = mod2SpinDamages[tier - 1]
    const mod3MaxHpPct    = mod3MaxHpPercents[tier - 1]

    // Block mana gain until the 3rd empowered attack connects.
    // Uses a status effect (not manaLockTimer) because applyManaLock() is called
    // after onCast and would overwrite any manaLockTimer set here.
    addStatusEffect(unit, {
      id: 'triple_axel_mana_lock',
      sourceUnitId: unit.id,
      durationTicks: -1,
      suppressManaGain: true,
      stackId: MANA_LOCK_STACK,
    })

    // Start first empowered attack immediately — no delay after cast
    unit.attackTimer = 0

    // Modifier 1: fast 70px lunge + bonus physical damage
    unit.attackModifiers.push({
      id: 'weavile_1',
      remainingCharges: 1,
      ignoreBlind: true,
      bonusDamage: mod1Damage,
      bonusDamageType: 'physical',
    })

    // Modifier 2: spin AoE — hits all enemies within 1 hex of Weavile (not just the primary target)
    const spinDmg = mod2SpinDamage
    unit.attackModifiers.push({
      id: 'weavile_2',
      remainingCharges: 1,
      ignoreBlind: true,
      extendedWindupTicks: 34,
      followUpDelayTicks: 15,
      onHit: (src: Unit, _tgt: Unit, st: CombatState) => {
        for (const hex of hexesInRange(src.hexPos, 1)) {
          const id = st.hexOccupancy.get(hexId(hex))
          if (!id) continue
          const enemy = st.units.get(id)
          if (!enemy || enemy.team === src.team || enemy.state === 'dead') continue
          applyDamage(src, enemy, {
            baseAmount:        spinDmg,
            damageType:        'magic',
            canCrit:           false,
            abilityScalingStat: 'special',
            abilityId:         'weavile_triple_axel',
          }, st)
        }
      },
    })

    // Modifier 3: max HP% true damage + knock up + clear the mana lock
    const hpPct = mod3MaxHpPct
    unit.attackModifiers.push({
      id: 'weavile_3',
      remainingCharges: 1,
      ignoreBlind: true,
      followUpDelayTicks: 15,
      maxHealthPercent: hpPct,
      knockUp: true,
      onHit: (src: Unit, _tgt: Unit, st: CombatState) => {
        removeStatusEffectByStack(src, MANA_LOCK_STACK)
      },
    })
  },
}
