import type { ItemModule } from '../../core/types'

// Leek: the holder's abilities can critically strike. Honored in the crit branch
// of the damage pipeline (damage.ts) off the abilitiesCanCrit flag.
export const leek: ItemModule = {
  def: {
    id: 'leek',
    categories: ['special caster'],
    name: 'Leek',
    description: '+20 Special Attack, +25% Crit Chance. The holder\'s abilities can critically strike.',
    statBonus: { special: 20, critChance: 0.25 },
    iconPath: '/visuals/item icons/leek.webp',
  },
  passive(unit) {
    unit.abilitiesCanCrit = true
  },
}
