import type { ItemModule } from '../../core/types'
import { addStatusEffect } from '../../core/systems/statusEffect'

// Rocky Helmet: enemies that auto-attack the holder take magic damage equal to
// reflectPct of the holder's Defense. A marker whose magnitude carries the ratio —
// the reflection itself lives in the damage pipeline (damage.ts).
export const rockyHelmet: ItemModule = {
  def: {
    id: 'rocky_helmet',
    categories: ['tank'],
    name: 'Rocky Helmet',
    description: '+100 HP, +35 Defense. Enemies that auto-attack the holder take magic damage equal to 33% of the holder\'s Defense.',
    statBonus: { hp: 100, defense: 35 },
    iconPath: '/visuals/item icons/rocky_helmet.avif',
    effect: { reflectPct: 0.33 },   // fraction of holder's Defense reflected as magic damage
  },
  passive(unit, _state, def) {
    if (unit.statusEffects.some(fx => fx.stackId === 'rocky_helmet')) return
    addStatusEffect(unit, {
      id: 'rocky_helmet',
      sourceUnitId: unit.id,
      durationTicks: -1,
      magnitude: def.effect?.reflectPct ?? 0.33,
      stackId: 'rocky_helmet',
    })
  },
}
