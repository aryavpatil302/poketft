import type { TraitDefinition } from '../core/types'

export const JUNGLE: TraitDefinition = {
  id: 'jungle',
  name: 'Jungle',
  thresholds: [
    {
      count: 3,
      description: '(3) All allies gain 5% heal & shield power. Jungle units gain an extra 10% (15% total).',
      specialEffect: 'jungle_healshield_3',
    },
    {
      count: 5,
      description: '(5) All allies gain 8% heal & shield power. Jungle units gain an extra 15% (23% total).',
      specialEffect: 'jungle_healshield_5',
    },
    {
      count: 7,
      description: '(7) All allies gain 10% heal & shield power. Jungle units gain an extra 25% (35% total).',
      specialEffect: 'jungle_healshield_7',
    },
  ],
}

export const BEACHY: TraitDefinition = {
  id: 'beachy',
  name: 'Beachy',
  thresholds: [
    {
      count: 2,
      description: '(2) Beachy units gain 150 bonus HP. Each Beachy cast grants +1 spell buff to all Beachy allies, powering up their abilities.',
      specialEffect: 'beachy_2',
    },
    {
      count: 4,
      description: '(4) Beachy units gain 300 bonus HP. Each Beachy cast grants +2 spell buff to all Beachy allies.',
      specialEffect: 'beachy_4',
    },
    {
      count: 6,
      description: '(6) Beachy units gain 450 bonus HP. Each Beachy cast grants +3 spell buff to all Beachy allies.',
      specialEffect: 'beachy_6',
    },
  ],
}

export const BRUISER: TraitDefinition = {
  id: 'bruiser',
  name: 'Bruiser',
  thresholds: [
    { count: 2, description: '(2) All allies gain 150 max HP. Bruisers gain an additional 25% max HP.', specialEffect: 'bruiser_bonus' },
    { count: 4, description: '(4) All allies gain 150 max HP. Bruisers gain an additional 40% max HP.', specialEffect: 'bruiser_bonus' },
    { count: 6, description: '(6) All allies gain 150 max HP. Bruisers gain an additional 60% max HP.', specialEffect: 'bruiser_bonus' },
  ],
}

export const ROUGHNECK: TraitDefinition = {
  id: 'roughneck',
  name: 'Roughneck',
  thresholds: [
    { count: 2, description: '(2) Roughneck units gain +20 Attack and 10% Omnivamp. Deal 5% bonus damage to enemies below 50% HP.', specialEffect: 'roughneck_2' },
    { count: 3, description: '(3) Roughneck units gain +25 Attack and 13% Omnivamp. Deal 7% bonus damage to enemies below 50% HP.', specialEffect: 'roughneck_3' },
    { count: 4, description: '(4) Roughneck units gain +30 Attack and 16% Omnivamp. Deal 10% bonus damage to enemies below 50% HP.', specialEffect: 'roughneck_4' },
    { count: 5, description: '(5) Roughneck units gain +40 Attack and 20% Omnivamp. Deal 15% bonus damage to enemies below 50% HP.', specialEffect: 'roughneck_5' },
  ],
}

export const STALWART: TraitDefinition = {
  id: 'stalwart',
  name: 'Stalwart',
  thresholds: [
    { count: 2, description: '(2) At 60% and 30% HP, Stalwart units permanently gain +20 Defense and Sp. Def.', specialEffect: 'stalwart_breakpoints' },
    { count: 4, description: '(4) At 60% and 30% HP, Stalwart units permanently gain +40 Defense and Sp. Def.', specialEffect: 'stalwart_breakpoints' },
    { count: 6, description: '(6) At 60% and 30% HP, Stalwart units permanently gain +60 Defense and Sp. Def.', specialEffect: 'stalwart_breakpoints' },
  ],
}

export const PROMOTER: TraitDefinition = {
  id: 'promoter',
  name: 'Promoter',
  thresholds: [
    { count: 2, description: '(2) Each Promoter pulses a 1-hex aura at combat start. Allies in range gain a 200 HP shield for 10s, stacking per Promoter. Shielded units gain 10% Attack Speed while any Promoter shield is active.', specialEffect: 'promoter_aura' },
    { count: 4, description: '(4) 300 HP shield, 20% Attack Speed.', specialEffect: 'promoter_aura' },
    { count: 6, description: '(6) 450 HP shield, 30% Attack Speed.', specialEffect: 'promoter_aura' },
  ],
}

export const VOLCANO: TraitDefinition = {
  id: 'volcanic',
  name: 'Volcano',
  thresholds: [
    {
      count: 3,
      description: '(3) Volcano units gain 350 HP and 30 adaptive force. Summon the sun after 10 seconds. Bonuses increase 50% under the sun.',
      specialEffect: 'volcano_3',
    },
    {
      count: 5,
      description: '(5) Volcano units gain 500 HP and 45 adaptive force. Summon the sun after 5 seconds. Bonuses increase 50% under the sun.',
      specialEffect: 'volcano_5',
    },
    {
      count: 7,
      description: '(7) Volcano units gain 800 HP and 75 adaptive force. Instantly summon the sun. Bonuses increase 50% under the sun.',
      specialEffect: 'volcano_7',
    },
  ],
}

export const SKYSTRIKER: TraitDefinition = {
  id: 'sky_striker',
  name: 'Sky Striker',
  thresholds: [
    {
      count: 2,
      description: '(2) First cast summons tailwind, granting +30% atkspd and converting 20% of atkspd to adaptive force. Sky Strikers execute units at ≤10% HP.',
      specialEffect: 'sky_striker_2',
    },
    {
      count: 4,
      description: '(4) First cast summons tailwind, granting +60% atkspd and converting 20% of atkspd to adaptive force. Sky Strikers execute units at ≤15% HP. Kills double tailwind atkspd for 3s.',
      specialEffect: 'sky_striker_4',
    },
  ],
}

export const CAVE_CRAWLER: TraitDefinition = {
  id: 'cave_crawler',
  name: 'Cave Crawler',
  thresholds: [
    {
      count: 3,
      description: '(3) Earthquakes rock the board every 5 seconds, dealing 300 true damage (+10% per star level) to all enemies. Each earthquake has a chance to add a random Cave Crawler (cheaper ones more often) to your bench.',
      specialEffect: 'cave_crawler_3',
    },
    {
      count: 5,
      description: '(5) Earthquakes also have a chance to grant you 1–5 gold.',
      specialEffect: 'cave_crawler_5',
    },
  ],
}

export const RIVER: TraitDefinition = {
  id: 'river',
  name: 'River',
  thresholds: [
    {
      count: 2,
      description: '(2) The strongest river Pokémon carries Aqua Ring: 10% durability, 15% omnivamp, explode on death dealing 10% max HP to enemies within 1 hex. Ring passes to the next strongest on death.',
      specialEffect: 'river_2',
    },
    {
      count: 3,
      description: '(3) Aqua Ring grants 15% durability and 25% omnivamp. Explosion deals 15% max HP.',
      specialEffect: 'river_3',
    },
    {
      count: 4,
      description: '(4) The ring holder grows 10% larger with 10% more HP.',
      specialEffect: 'river_4',
    },
  ],
}

export const TEMPORAL_WOODS: TraitDefinition = {
  id: 'temporal_woods',
  name: 'Temporal Woods',
  thresholds: [
    {
      count: 2,
      description: '(2) Ability damage Charms enemies, reducing their Attack and Special by 33% for 3 seconds.',
      specialEffect: 'temporal_woods_2',
    },
    {
      count: 4,
      description: '(4) Also applies Heal Block, reducing healing and shielding received by 33% for 3 seconds.',
      specialEffect: 'temporal_woods_4',
    },
    {
      count: 6,
      description: '(6) Also Confuses enemies, dealing 150 magic damage each time they auto-attack for 3 seconds. Charm and Heal Block strength increase to 50%.',
      specialEffect: 'temporal_woods_6',
    },
  ],
}

export const RUINER: TraitDefinition = {
  id: 'ruiner',
  name: 'Ruiner',
  thresholds: [
    {
      count: 3,
      description: '(3) When your team loses 20% of their combined HP, summon Golett. The Golem gains +25% HP and +10% Special for each accumulated Ruiner star level.',
      specialEffect: 'ruiner_3',
    },
    {
      count: 5,
      description: '(5) Summons Golurk instead.',
      specialEffect: 'ruiner_5',
    },
    {
      count: 7,
      description: '(7) Summons Mega Golurk instead.',
      specialEffect: 'ruiner_7',
    },
  ],
}

export const ASCENDER: TraitDefinition = {
  id: 'ascender',
  name: 'Ascender',
  thresholds: [
    {
      count: 2,
      description: '(2) Place 1 cliff. Adjacent allies gain 20 armor and MR. When it dies, it falls forward dealing 300 true damage and stunning enemies for 2s.',
      specialEffect: 'ascender_2',
    },
    {
      count: 4,
      description: '(4) Place 2 cliffs. Adjacent allies gain 30 armor and MR. Falls for 500 true damage.',
      specialEffect: 'ascender_4',
    },
  ],
}

export const FROSTSTONE: TraitDefinition = {
  id: 'froststone',
  name: 'Froststone',
  thresholds: [
    {
      count: 2,
      description: '(2) Froststone auto attacks mark enemies (up to 5 stacks), dealing 50 + 50 per existing mark as true damage. At 5 stacks, the next hit consumes the marks for 100 bonus special damage.',
      specialEffect: 'froststone_2',
    },
    {
      count: 4,
      description: '(4) Mark initial damage increases to 75 + 75 per mark. Consume bonus increases to 150 special damage.',
      specialEffect: 'froststone_4',
    },
    {
      count: 6,
      description: '(6) Mark initial damage increases to 100 + 100 per mark. Consume bonus increases to 200 special damage.',
      specialEffect: 'froststone_6',
    },
  ],
}

export const QUICKCLAW: TraitDefinition = {
  id: 'quickclaw',
  name: 'Quickclaw',
  thresholds: [
    { count: 2, description: '(2) Quickclaw units gain 4% Attack Speed per attack, stacking up to 10 times.', specialEffect: 'quickclaw_2' },
    { count: 3, description: '(3) Quickclaw units gain 6% Attack Speed per attack, stacking up to 10 times.', specialEffect: 'quickclaw_3' },
    { count: 4, description: '(4) Quickclaw units gain 8% Attack Speed per attack, stacking up to 10 times.', specialEffect: 'quickclaw_4' },
    { count: 5, description: '(5) Quickclaw units gain 10% Attack Speed per attack, stacking up to 10 times.', specialEffect: 'quickclaw_5' },
  ],
}

export const CORKSCREW: TraitDefinition = {
  id: 'corkscrew',
  name: 'Corkscrew',
  thresholds: [
    { count: 2, description: '(2) First auto on a new target dashes through and back, dealing 2× 60% Attack. Removes 10% of target\'s Defense permanently. Gain +0.2 Move Speed.', specialEffect: 'corkscrew_2' },
    { count: 3, description: '(3) 2× 70% Attack. Removes 20% Defense. +0.25 Move Speed.', specialEffect: 'corkscrew_3' },
    { count: 4, description: '(4) 2× 80% Attack. Removes 30% Defense. +0.3 Move Speed.', specialEffect: 'corkscrew_4' },
    { count: 5, description: '(5) 2× 100% Attack. Removes 50% Defense. +0.35 Move Speed.', specialEffect: 'corkscrew_5' },
  ],
}

export const SPELLWEAVER: TraitDefinition = {
  id: 'spellweaver',
  name: 'Spellweaver',
  thresholds: [
    { count: 2, description: '(2) Your team gains +15 Adaptive Force. Spellweavers gain +20 Adaptive Force, plus +1 per ally Ability cast.', specialEffect: 'spellweaver_2' },
    { count: 4, description: '(4) Your team gains +15 Adaptive Force. Spellweavers gain +35 Adaptive Force, plus +2 per ally Ability cast.', specialEffect: 'spellweaver_4' },
    { count: 6, description: '(6) Your team gains +15 Adaptive Force. Spellweavers gain +80 Adaptive Force, plus +4 per ally Ability cast.', specialEffect: 'spellweaver_6' },
  ],
}

export const KEEN_EYE: TraitDefinition = {
  id: 'keen_eye',
  name: 'Keen Eye',
  thresholds: [
    { count: 2, description: '(2) Your team gains +1 Mana per second. Keen Eye units gain 25% more Mana from all sources.', specialEffect: 'keen_eye_2' },
    { count: 4, description: '(4) Your team gains +2 Mana per second. Keen Eye units gain 50% more Mana from all sources.', specialEffect: 'keen_eye_4' },
    { count: 6, description: '(6) Your team gains +3 Mana per second. Keen Eye units gain 75% more Mana from all sources.', specialEffect: 'keen_eye_6' },
  ],
}

export const MYSTIC: TraitDefinition = {
  id: 'mystic',
  name: 'Mystic',
  thresholds: [
    { count: 2, description: '(2) Mystic Abilities steal 3% Durability from enemies hit, granting it team-wide. Up to 18% stolen per enemy and max 18% Durability for the team.', specialEffect: 'mystic_2' },
    { count: 4, description: '(4) Mystic Abilities steal 5% Durability from enemies hit, granting it team-wide. Up to 20% stolen per enemy and max 20% Durability for the team.', specialEffect: 'mystic_4' },
  ],
}

export const CRASHOUT: TraitDefinition = {
  id: 'crashout',
  name: 'Crashout',
  thresholds: [
    { count: 2, description: '(2) Your team gains 5% Damage Amp. Crash Outs gain double when team health is below 75%.', specialEffect: 'crashout_2' },
    { count: 3, description: '(3) Your team gains 6% Damage Amp. Crash Outs gain double when team health is below 75%.', specialEffect: 'crashout_3' },
    { count: 4, description: '(4) Your team gains 8% Damage Amp. Crash Outs gain double when team health is below 75%.', specialEffect: 'crashout_4' },
  ],
}

export const SUBSTITUTOR: TraitDefinition = {
  id: 'substitutor',
  name: 'Substitutor',
  thresholds: [
    { count: 1, description: '(1) On death, leave behind a low-health Substitute that enemies must defeat.', specialEffect: 'substitutor_sub' },
    { count: 3, description: '(3) Substitute has medium health.', specialEffect: 'substitutor_sub' },
    { count: 5, description: '(5) Substitute has high health.', specialEffect: 'substitutor_sub' },
  ],
}

export const SHOCK_SPIRIT: TraitDefinition = {
  id: 'shock_spirit',
  name: 'Shock Spirit',
  thresholds: [
    { count: 1, description: '(1) If Tapu Koko is your strongest Tapu, he summons Electric Terrain at combat start: allies gain 15% Attack Speed and 15% Tenacity (crowd control is 15% less effective) for the first 10 seconds of combat.' },
  ],
}

export const ROGUE: TraitDefinition = {
  id: 'rogue',
  name: 'Rogue',
  thresholds: [
    { count: 1, description: '(1) If this unit starts combat without any adjacent allies, it gains a 500 health shield.' },
  ],
}

export const SOUL_BONDED: TraitDefinition = {
  id: 'soul_bonded',
  name: 'Soul Bonded',
  thresholds: [
    { count: 1, description: '(1) Latios: your team gains 10% Attack and Sp. Attack. Latias: your team gains 10 Defense and Sp. Defense.' },
    { count: 2, description: '(2) Both bonded: your team gains both buffs, and Latios and Latias each gain 1.5× Sp. Attack and Sp. Defense.' },
  ],
}

export const WAVE_SPIRIT: TraitDefinition = {
  id: 'wave_spirit',
  name: 'Wave Spirit',
  thresholds: [
    { count: 1, description: '(1) If Tapu Fini is your strongest Tapu, she summons Misty Terrain at combat start: allies are immune to crowd control for the first 10 seconds of combat.' },
  ],
}

export const EARTH_SPIRIT: TraitDefinition = {
  id: 'earth_spirit',
  name: 'Earth Spirit',
  thresholds: [
    { count: 1, description: '(1) If Tapu Bulu is your strongest Tapu, he summons Grassy Terrain at combat start: allies heal 10% of their max health every 2 seconds for the first 10 seconds of combat.' },
  ],
}

export const MIND_SPIRIT: TraitDefinition = {
  id: 'mind_spirit',
  name: 'Mind Spirit',
  thresholds: [
    { count: 1, description: '(1) If Tapu Lele is your strongest Tapu, she summons Psychic Terrain at combat start: enemies have 25% reduced Attack Speed for the first 10 seconds of combat.' },
  ],
}

export const ZEN: TraitDefinition = {
  id: 'zen',
  name: 'Zen',
  thresholds: [
    { count: 1, description: '(1) Once per combat, the first time you drop to 50% health, enter Zen: gain a 1200 health shield, +10% durability, and heal 200 health per second. While in Zen you cannot move, attack, cast, or gain mana — only heal. When the shield breaks or you return to full health, revert to your angry form; your max mana is then reduced to 60 for the rest of combat. Your first cast after entering Zen deals 50% more damage.' },
  ],
}

export const ALL_TRAITS: TraitDefinition[] = [
  JUNGLE, BEACHY, BRUISER, ROUGHNECK, STALWART, PROMOTER, VOLCANO, SKYSTRIKER, CAVE_CRAWLER, RIVER, TEMPORAL_WOODS, RUINER, ASCENDER, FROSTSTONE,
  QUICKCLAW, CORKSCREW, SPELLWEAVER, KEEN_EYE, MYSTIC, CRASHOUT, SUBSTITUTOR, SHOCK_SPIRIT, WAVE_SPIRIT, EARTH_SPIRIT, MIND_SPIRIT, ROGUE, SOUL_BONDED, ZEN,
]

export const TRAIT_MAP: Map<string, TraitDefinition> = new Map(
  ALL_TRAITS.map(t => [t.id, t])
)
