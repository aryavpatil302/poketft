import type { ItemModule } from '../../core/types'

// Charcoal: the holder's attacks and spells burn the target. The burn itself is
// applied in the damage pipeline (damage.ts) off the appliesBurnOnHit flag.
export const charcoal: ItemModule = {
  def: {
    id: 'charcoal',
    categories: ['special caster'],
    name: 'Charcoal',
    description: '+20 Special Attack. The holder\'s attacks and spells burn the target for 4 seconds — small true damage each second and 33% reduced healing.',
    statBonus: { special: 20 },
    iconPath: '/visuals/item icons/charcoal.webp',
  },
  passive(unit) {
    unit.appliesBurnOnHit = true
  },
}
