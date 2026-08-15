import type { ItemModule, Unit } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'

// Metronome: every auto-attack grants +asPerAuto attack speed for the rest of
// combat, stacking infinitely (one status whose magnitude grows each swing).
export const metronome: ItemModule = {
  def: {
    id: 'metronome',
    categories: ['attack marksman', 'special marksman'],
    name: 'Metronome',
    description: '+30% Attack Speed, +10% Adaptive Force. Each auto-attack grants +3% Attack Speed for the rest of combat (stacks infinitely).',
    statBonus: {},
    attackSpeedPct: 0.30,
    adaptiveForcePct: 0.10,
    iconPath: '/visuals/item icons/metronome.webp',
    effect: { asPerAuto: 0.03 },   // attack speed gained per auto-attack
  },
  passive(unit, _state, def) {
    if (unit.passiveAttackHandlers.some(h => h.id === 'metronome_passive')) return
    const asPerAuto = def.effect?.asPerAuto ?? 0.03
    let stacks = 0
    unit.passiveAttackHandlers.push({
      id: 'metronome_passive',
      onAttack(src: Unit): void {
        stacks++
        addStatusEffect(src, {
          id: 'atkSpd_buff',
          sourceUnitId: src.id,
          durationTicks: -1,
          magnitude: stacks * asPerAuto,
          stackId: 'metronome_as',
        })
      },
    })
  },
}
