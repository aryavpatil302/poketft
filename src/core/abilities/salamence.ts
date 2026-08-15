import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, PassiveAttackHandler } from '../types'
import { addStatusEffect } from '../systems/statusEffect'

const RAMP_PER_AUTO = [0.05, 0.07, 0.50] as const  // attack + attack speed per auto, by tier
const DR_PCT        = 0.50  // damage reduction vs everyone but the current target (read in damage.ts)

// Quick cast rumble length; unitLayer keys the shake + grow-to-120% off this.
export const SALAMENCE_RUMBLE_TICKS = 24

export const SalamenceAbility: AbilityHandler = {
  abilityId: 'salamence_outrage',
  castTimeTicks: SALAMENCE_RUMBLE_TICKS,

  onCast(unit: Unit, _state: CombatState): void {
    // Enraged for the rest of combat. This one status drives everything:
    //  - damage.ts: 50% reduced damage from every enemy but the current target
    //  - unitFactory.ts computeStats: immune to attack-lowering effects
    //  - suppressManaGain: never gains mana again, so this cast is the only one
    //  - unitLayer: permanent 20% size increase
    addStatusEffect(unit, {
      id: 'salamence_enraged',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude: DR_PCT,
      stackId: 'salamence_enraged',
      suppressManaGain: true,
    })
    unit.currentMana = 0

    // Outrage ramp: every auto grows a single stacking attack + attack-speed
    // buff that lasts until he dies — target switches do NOT reset it.
    if (!unit.passiveAttackHandlers.some(h => h.id === 'salamence_outrage_ramp')) {
      let stacks = 0

      const handler: PassiveAttackHandler = {
        id: 'salamence_outrage_ramp',
        onAttack(src: Unit): void {
          stacks++
          const ramp = RAMP_PER_AUTO[src.tier - 1]
          addStatusEffect(src, {
            id: 'atk_buff_pct',
            sourceUnitId: src.id,
            durationTicks: -1,
            magnitude: stacks * ramp,
            stackId: 'salamence_outrage_atk',
          })
          addStatusEffect(src, {
            id: 'atkSpd_buff',
            sourceUnitId: src.id,
            durationTicks: -1,
            magnitude: stacks * ramp,
            stackId: 'salamence_outrage_as',
          })
        },
      }
      unit.passiveAttackHandlers.push(handler)
    }

    // Back to attacking immediately after the rumble
    unit.attackTimer = 0
  },
}
