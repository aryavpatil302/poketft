import type { ItemModule } from '../../core/types'

// Razor Claw: the holder's abilities can critically strike. Honored in the crit
// branch of the damage pipeline (damage.ts) off the abilitiesCanCrit flag.
export const razorClaw: ItemModule = {
  def: {
    id: 'razor_claw',
    categories: ['attack caster'],
    name: 'Razor Claw',
    description: '+20 Attack, +25% Crit Chance. The holder\'s abilities can critically strike.',
    statBonus: { attack: 20, critChance: 0.25 },
    iconPath: '/visuals/item icons/razor_claw.webp',
  },
  passive(unit) {
    unit.abilitiesCanCrit = true
  },
}
