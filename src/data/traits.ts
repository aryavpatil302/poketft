import type { TraitDefinition } from '../core/types'

export const JUNGLE: TraitDefinition = {
  id: 'jungle',
  name: 'Jungle',
  thresholds: [
    {
      count: 2,
      description: '(2) Team gains 5% heal & shield power. Jungle units gain 10% heal & shield power.',
      teamBonus: {},
      specialEffect: 'jungle_healshield_2',
    },
    {
      count: 4,
      description: '(4) Team gains 8% heal & shield power. Jungle units gain 15% heal & shield power.',
      teamBonus: {},
      specialEffect: 'jungle_healshield_4',
    },
    {
      count: 6,
      description: '(6) Team gains 8% heal & shield power. Jungle units gain 25% heal & shield power.',
      teamBonus: {},
      specialEffect: 'jungle_healshield_6',
    },
  ],
}

export const BEACHY: TraitDefinition = {
  id: 'beachy',
  name: 'Beachy',
  thresholds: [
    {
      count: 2,
      description: '(2) Beachy units gain 3 mana per second and 5% spell damage bonus per cast (max 3 stacks).',
      specialEffect: 'beachy_2',
    },
    {
      count: 4,
      description: '(4) Beachy units gain 5 mana per second and 8% spell damage bonus per cast (max 5 stacks).',
      specialEffect: 'beachy_4',
    },
    {
      count: 6,
      description: '(6) Beachy units gain 8 mana per second and 12% spell damage bonus per cast (max 7 stacks).',
      specialEffect: 'beachy_6',
    },
  ],
}

export const BRUISER: TraitDefinition = {
  id: 'bruiser',
  name: 'Bruiser',
  thresholds: [
    {
      count: 2,
      description: '(2) All allies gain 150 bonus HP. Bruisers gain 300 bonus HP.',
      teamBonus: { hp: 150 },
      statBonus: { hp: 150 },  // extra 150 for bruisers (total 300)
    },
    {
      count: 4,
      description: '(4) All allies gain 250 bonus HP. Bruisers gain 550 bonus HP.',
      teamBonus: { hp: 250 },
      statBonus: { hp: 300 },
    },
    {
      count: 6,
      description: '(6) All allies gain 400 bonus HP. Bruisers gain 900 bonus HP.',
      teamBonus: { hp: 400 },
      statBonus: { hp: 500 },
    },
  ],
}

export const ROUGHNECK: TraitDefinition = {
  id: 'roughneck',
  name: 'Roughneck',
  thresholds: [
    {
      count: 2,
      description: '(2) Roughneck units gain 15 AD and 8% lifesteal.',
      statBonus: { attack: 15 },
      specialEffect: 'roughneck_lifesteal_2',
    },
    {
      count: 3,
      description: '(3) Roughneck units gain 25 AD and 12% lifesteal.',
      statBonus: { attack: 25 },
      specialEffect: 'roughneck_lifesteal_3',
    },
    {
      count: 4,
      description: '(4) Roughneck units gain 40 AD and 18% lifesteal.',
      statBonus: { attack: 40 },
      specialEffect: 'roughneck_lifesteal_4',
    },
  ],
}

export const SPEED_STRIKER: TraitDefinition = {
  id: 'speed_striker',
  name: 'Speed Striker',
  thresholds: [
    {
      count: 2,
      description: '(2) Speed Strikers gain 8% attack speed on each auto (max 4 stacks).',
      specialEffect: 'speed_striker_2',
    },
    {
      count: 4,
      description: '(4) Speed Strikers gain 12% attack speed on each auto (max 6 stacks).',
      specialEffect: 'speed_striker_4',
    },
  ],
}

export const STALWART: TraitDefinition = {
  id: 'stalwart',
  name: 'Stalwart',
  thresholds: [
    {
      count: 1,
      description: '(1) Stalwart units gain 20 armor and MR when dropping below 75%/50%/25% HP (once per breakpoint).',
      specialEffect: 'stalwart_breakpoints',
    },
  ],
}

export const PROMOTER: TraitDefinition = {
  id: 'promoter',
  name: 'Promoter',
  thresholds: [
    {
      count: 1,
      description: '(1) At combat start, shield the Promoter and adjacent allies for 200 HP and grant 20% attack speed for 5 seconds.',
      specialEffect: 'promoter_combat_start',
    },
  ],
}

export const ALL_TRAITS: TraitDefinition[] = [
  JUNGLE, BEACHY, BRUISER, ROUGHNECK, SPEED_STRIKER, STALWART, PROMOTER,
]

export const TRAIT_MAP: Map<string, TraitDefinition> = new Map(
  ALL_TRAITS.map(t => [t.id, t])
)
