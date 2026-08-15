import type { ItemModule } from '../../core/types'

// Flame Orb: the holder's attacks and spells burn the target. The burn itself is
// applied in the damage pipeline (damage.ts) off the appliesBurnOnHit flag.
export const flameOrb: ItemModule = {
  def: {
    id: 'flame_orb',
    categories: ['attack marksman'],
    name: 'Flame Orb',
    description: '+10 Attack, +10% Attack Speed. The holder\'s attacks and spells burn the target for 4 seconds — small true damage each second and 33% reduced healing.',
    statBonus: { attack: 10 },
    attackSpeedPct: 0.10,
    iconPath: '/visuals/item icons/flame_orb.webp',
  },
  passive(unit) {
    unit.appliesBurnOnHit = true
  },
}
