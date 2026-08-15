import type { ItemModule } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'

// Expert Belt: increases the holder's Attack by a flat percentage. Implemented as
// a permanent 'atk_buff_pct' status (computeStats: attack += attack * mag).
export const expertBelt: ItemModule = {
  def: {
    id: 'expert_belt',
    categories: ['attack fighter', 'attack marksman'],
    name: 'Expert Belt',
    description: '+30 Attack. Increases the holder\'s Attack by an additional 5%.',
    statBonus: { attack: 30 },
    iconPath: '/visuals/item icons/expert_belt.png',
    effect: { atkPct: 0.05 },
  },
  passive(unit, _state, def) {
    addStatusEffect(unit, {
      id: 'atk_buff_pct',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude: def.effect?.atkPct ?? 0.05,
      stackId: 'expert_belt',
    })
  },
}
