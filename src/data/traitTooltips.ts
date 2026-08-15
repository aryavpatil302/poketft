// Condensed trait descriptions for the hover tooltip.
// `summary` is the general one-paragraph description; `breakpoints` are short
// per-threshold lines, parallel to the trait's thresholds array in traits.ts.

export interface TraitTooltip {
  summary: string
  breakpoints: string[]
}
export const TRAIT_TOOLTIPS: Record<string, TraitTooltip> = {
  //shoulde be 15 for jungle, then 25 for jungle
  jungle: {
    summary: 'Allies gain heal & shield power. Jungle units gain more.',
    breakpoints: ['5% allies, 15% Jungle', '8% allies, 23% Jungle', '10% allies, 35% Jungle'],
  },
  beachy: {
    summary: 'Beachy units gain bonus HP. Every Beachy cast grants beachy vibes that power up their abilities.',
    breakpoints: ['150 HP, +1 spell buff per cast', '300 HP, +2 per cast', '450 HP, +3 per cast'],
  },
  bruiser: {
    summary: 'All allies gain 150 max HP. Bruisers gain extra max HP.',
    breakpoints: ['+25% Bruiser HP', '+40% Bruiser HP', '+60% Bruiser HP'],
  },
  roughneck: {
    summary: 'Roughnecks gain Attack and Omnivamp, and deal bonus damage to enemies below 50% HP.',
    breakpoints: [
      '+20 Atk, 10% omnivamp, 5% bonus',
      '+25 Atk, 13% omnivamp, 7% bonus',
      '+30 Atk, 16% omnivamp, 10% bonus',
      '+40 Atk, 20% omnivamp, 15% bonus',
    ],
  },
  stalwart: {
    summary: 'The first time Stalwarts fall to 60% and 30% HP, they permanently gain Defense and Sp. Defense for the rest of combat.',
    breakpoints: ['+20 Def & Sp. Def', '+40 Def & Sp. Def', '+60 Def & Sp. Def'],
  },
  promoter: {
    summary: 'At combat start, Promoters shield nearby allies. Shielded allies attack faster while a shield holds. The shield is +5% stronger on promoters',
    breakpoints: ['200 HP shield, 10% AS', '300 HP shield, 20% AS', '450 HP shield, 30% AS'],
  },
  volcanic: {
    summary: 'Volcano units gain HP and adaptive force, and summon the sun. Bonuses increase 50% under the sun.',
    breakpoints: ['350 HP, 30 AF, sun at 10s', '500 HP, 45 AF, sun at 5s', '800 HP, 75 AF, instant sun'],
  },
  sky_striker: {
    summary: 'The first Sky Striker  cast summons tailwind, which grants bonus attack speed to strikers, and partly converts to adaptive force on cast. Sky Strikers execute low-HP enemies.',
    breakpoints: ['+30% AS, execute at 10% HP', '+60% AS, execute at 15% HP, kills double tailwind'],
  },
  cave_crawler: {
    summary: 'Earthquakes rock the board every 5 seconds, damaging all enemies and periodically spawning crawlers onto your bench.',
    breakpoints: ['150 true damage (+2% per star); quakes may add a random crawler (cheaper more likely) to your bench', 'quakes may also grant 1–5 gold'],
  },
  river: {
    summary: 'The strongest River unit carries Aqua Ring, which grants durability, omnivamp, and a death explosion. The ring passes on death.',
    breakpoints: [
      '10% dura, 15% omni, 10% max-HP burst',
      '15% dura, 25% omni, 15% max-HP burst',
      'holder grows: +10% size & HP',
    ],
  },
  temporal_woods: {
    summary: 'Ability damage puts debuffing hexes on enemies for 3 seconds.',
    breakpoints: ['Charm - lower atk and spc by 33%', 'also Heal Block, reducing healing and shielding by 33%', 'also Confuse (150 dmg per auto); other effects are 50% stonger'],
  },
  ruiner: {
    summary: 'When your team loses 20% of its HP, summon a Golem that scales with Ruiner star levels.',
    breakpoints: ['Summon Golett', 'Summon Golurk', 'Summon Mega Golurk'],
  },
  ascender: {
    summary: 'Place cliffs that buff adjacent allies. Cliffs topple onto enemies when destroyed.',
    breakpoints: ['1 cliff, +20 armor/MR, 300 dmg fall', '2 cliffs, +30 armor/MR, 500 dmg fall'],
  },
  froststone: {
    summary: 'Froststone autos mark enemies for true damage. At 5 marks, the next ability consumes them for bonus damage.',
    breakpoints: ['50 per mark, 100 consume', '75 per mark, 150 consume', '100 per mark, 200 consume'],
  },
  quickclaw: {
    summary: 'Quickclaws gain attack speed per attack, up to 10 stacks.',
    breakpoints: ['4% per attack', '6% per attack', '8% per attack', '10% per attack'],
  },
  corkscrew: {
    summary: 'The first auto on a new target and after a spell cast dashes through the target, hitting twice and shredding Defense. Corkscrews move faster.',
    breakpoints: [
      '2× 60% Atk, −10% Def',
      '2× 70% Atk, −20% Def',
      '2× 80% Atk, −30% Def',
      '2× 100% Atk, −50% Def',
    ],
  },
  spellweaver: {
    summary: 'Your team gains Adaptive Force. Spellweavers gain more, plus a stack every time an ally casts.',
    breakpoints: ['+20 AF, +1 per cast', '+35 AF, +2 per cast', '+80 AF, +4 per cast'],
  },
  keen_eye: {
    summary: 'Your team regenerates Mana. Keen Eye units gain extra Mana from all sources.',
    breakpoints: ['+1 Mana/s, 25% more', '+2 Mana/s, 50% more'],
  },
  mystic: {
    summary: 'Mystic abilities steal Durability from enemies hit and grant it to your whole team.',
    breakpoints: ['3% per hit, up to 18%', '5% per hit, up to 20%'],
  },
  crashout: {
    summary: 'Your team gains Damage Amp. Crashouts gain double while team health is below 75%.',
    breakpoints: ['5% Damage Amp', '6% Damage Amp', '8% Damage Amp'],
  },
  substitutor: {
    summary: 'On death, Substitutors leave behind a Substitute dummy.',
    breakpoints: ['Low health Substitute', 'Medium health Substitute', 'High health Substitute'],
  },
  shock_spirit: {
    summary: 'If Tapu Koko is your strongest Tapu, he summons Electric Terrain: allies gain 15% Attack Speed and 15% Tenacity for the first 10 seconds.',
    breakpoints: ['Electric Terrain at combat start'],
  },
  wave_spirit: {
    summary: 'If Tapu Fini is your strongest Tapu, she summons Misty Terrain: allies are immune to crowd control for the first 10 seconds.',
    breakpoints: ['Misty Terrain at combat start'],
  },
  rogue: {
    summary: 'Rogues that start combat without any adjacent allies gain a 500 health shield.',
    breakpoints: ['500 HP shield when isolated'],
  },
  soul_bonded: {
    summary: 'Latios grants the team 10% Attack and Sp. Attack. Latias grants 10 Defense and Sp. Defense. Together, both buffs apply and each gains 1.5× Sp. Attack and Sp. Defense.',
    breakpoints: ['one bonded: their buff', 'both: both buffs + 1.5× Sp. Atk & Sp. Def'],
  },
}
