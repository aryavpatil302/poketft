import type { ItemModule } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'

// Covert Cloak: the holder is immune to crowd control. A permanent 'cc_immune'
// marker — addStatusEffect blocks every CC effect while it's present.
export const covertCloak: ItemModule = {
  def: {
    id: 'covert_cloak',
    categories: ['attack fighter', 'special fighter'],
    name: 'Covert Cloak',
    description: '+10 Adaptive Force, +20% Move Speed. The holder is immune to crowd control effects.',
    statBonus: {},
    adaptiveForce: 10,
    moveSpeedPct: 0.20,
    iconPath: '/visuals/item icons/covert_cloak.webp',
  },
  passive(unit) {
    if (unit.statusEffects.some(fx => fx.id === 'cc_immune')) return
    addStatusEffect(unit, {
      id: 'cc_immune',
      sourceUnitId: unit.id,
      durationTicks: -1,
      stackId: 'covert_cloak',
    })
  },
}
