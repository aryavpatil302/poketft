import type { ItemModule } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'

// Twisted Spoon: increases the holder's Special Attack by a flat percentage.
// Implemented as a permanent 'sp_buff_pct' status (computeStats: special += special * mag).
export const twistedSpoon: ItemModule = {
  def: {
    id: 'twisted_spoon',
    categories: ['special caster', 'special marksman'],
    name: 'Twisted Spoon',
    description: '+30 Special Attack. Increases the holder\'s Special Attack by an additional 5%.',
    statBonus: { special: 30 },
    iconPath: '/visuals/item icons/twisted_spoon.png',
    effect: { spPct: 0.05 },
  },
  passive(unit, _state, def) {
    addStatusEffect(unit, {
      id: 'sp_buff_pct',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude: def.effect?.spPct ?? 0.05,
      stackId: 'twisted_spoon',
    })
  },
}
