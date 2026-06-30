import type { UnitDefinition } from '../core/types'


// Cost-tier defaults used where PDF values weren't available.
// cost1: hp=500  atk=35  sp=90  def=20 spd=20 aspd=0.65
// cost2: hp=650  atk=45  sp=90  def=30 spd=30 aspd=0.70
// cost3: hp=850  atk=55  sp=100 def=40 spd=40 aspd=0.75
// cost4: hp=1050 atk=65  sp=100 def=50 spd=50 aspd=0.75
// cost5: hp=1300 atk=80  sp=100 def=65 spd=65 aspd=0.75
// All: critChance=0.25, critDamage=1.40



export const TANGELA: UnitDefinition = {
  id: 'tangela',
  name: 'Tangela',
  cost: 1,
  traits: ['jungle'],
  baseStats: {
    hp: 600, startMana: 65, maxMana: 110,
    attack: 40, special: 100, defense: 40, spDefense: 40,
    attackSpeed: 0.50, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'tangela_leaf_guard',
    name: 'Leaf Guard',
    description: 'Gain a 400/525/685 (special) shield for 4 seconds. If any shield remains after 4 seconds, heal for 50% of the remaining shield value.',
    scaling: { shieldAmount: [400, 525, 685], durationSeconds: [4, 4, 4] },
  },
  spritePath: '/visuals/sprites/jungle/tangela-sprite.webp',
  spriteScale: 0.7,
}

export const VIGOROTH: UnitDefinition = {
  id: 'vigoroth',
  name: 'Vigoroth',
  cost: 3,
  traits: ['jungle'],
  baseStats: {
    hp: 800, startMana: 85, maxMana: 120,
    attack: 45, special: 100, defense: 50, spDefense: 50,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'vigoroth_fury_swipes',
    name: 'Fury Swipes',
    description: 'Jump to the furthest target in a 4 hex range and gain a 75/100/150 shield. While the shield holds, Vigoroth gains 20/30/50% attack speed and auto attacks deal an extra 50/75/100 bonus attack damage.',
    scaling: { shieldAmount: [75, 100, 150], atkSpdBonus: [0.20, 0.30, 0.50], atkDmgBonus: [50, 75, 100] },
  },
  spritePath: '/visuals/sprites/jungle/vigeroth-sprite.webp',
}

export const RIBOMBEE: UnitDefinition = {
  id: 'ribombee',
  name: 'Ribombee',
  cost: 1,
  traits: ['jungle'],
  baseStats: {
    hp: 500, startMana: 30, maxMana: 60,
    attack: 25, special: 100, defense: 15, spDefense: 15,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'ribombee_pollen_puff',
    name: 'Pollen Puff',
    description: 'Launch 2 pollen puffs - one at the lowest health ally (heals for 100/175/300) and one at the nearest enemy (deals 100/175/300 special damage and reduces their attack speed by 30% for 1 second).',
    scaling: { healAmount: [100, 175, 300], damageAmount: [100, 175, 300] },
  },
  spritePath: '/visuals/sprites/jungle/ribombee-sprite.webp',
}

export const VENUSAUR: UnitDefinition = {
  id: 'venusaur',
  name: 'Venusaur',
  cost: 2,
  traits: ['jungle'],
  baseStats: {
    hp: 900, startMana: 30, maxMana: 80,
    attack: 50, special: 100, defense: 45, spDefense: 45,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'venusaur_leech_seed',
    name: 'Leech Seed',
    description: 'Launch leech seeds at 2/2/3 of the nearest targets. Leech seeds deal 80/100/120 special damage and heal Venusaur for 40/50/60 health each second. Already seeded targets take 50% less damage and heal for 50% less.',
    scaling: { targetCount: [2, 2, 3], damagePerSec: [80, 100, 120], healPerSec: [40, 50, 60] },
  },
  spritePath: '/visuals/sprites/jungle/venusaur-sprite.webp',
}

export const VIKAVOLT: UnitDefinition = {
  id: 'vikavolt',
  name: 'Vikavolt',
  cost: 3,
  traits: ['jungle'],
  baseStats: {
    hp: 700, startMana: 50, maxMana: 100,
    attack: 30, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 2,
  },
  ability: {
    id: 'vikavolt_discharge',
    name: 'Discharge',
    description: 'Deal 400/500/675 damage to all enemies in the most populated row, stunning them for 1.5/2/3 seconds. Does 33% extra damage to shields.',
    scaling: { damage: [400, 500, 675], stunSeconds: [1.5, 2.0, 3.0] },
  },
  spritePath: '/visuals/sprites/jungle/vikavolt-sprite.webp',
}

export const TOUCANNON: UnitDefinition = {
  id: 'toucannon',
  name: 'Toucannon',
  cost: 4,
  traits: ['jungle'],
  baseStats: {
    hp: 800, startMana: 20, maxMana: 65,
    attack: 30, special: 100, defense: 30, spDefense: 30,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'toucannon_beak_blast',
    name: 'Beak Blast',
    description: 'Launch a beak blast at the nearest enemy. It explodes and deals 300/475/2000 physical damage and explodes in a 1 hex radius. Allies in the explosion heal for 75/100/500, and surrounding enemies take 200/275/600 damage.',
    scaling: { mainDamage: [300, 475, 2000], allyHeal: [75, 100, 500], splashDamage: [200, 275, 600] },
  },
  spritePath: '/visuals/sprites/jungle/toucannon-sprite.webp',
}

export const TROPIUS: UnitDefinition = {
  id: 'tropius',
  name: 'Tropius',
  cost: 4,
  traits: ['jungle'],
  baseStats: {
    hp: 1200, startMana: 60, maxMana: 120,
    attack: 65, special: 100, defense: 60, spDefense: 60,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'tropius_leaf_tornado',
    name: 'Leaf Tornado',
    description: 'Fly up and launch a 3 hex wide tornado in a straight line, knocking up all enemies hit for 2/2/5 seconds and dealing 200/275/800 special damage. For each enemy hit, gain a 100/130/400 health shield.',
    scaling: { damage: [200, 275, 800], knockUpSeconds: [2, 2, 5], shieldPerHit: [100, 130, 400] },
  },
  spritePath: '/visuals/sprites/jungle/tropius-sprite.webp',
  spriteScale: 0.75,
}

export const TAPU_BULU: UnitDefinition = {
  id: 'tapu_bulu',
  name: 'Tapu Bulu',
  cost: 5,
  traits: ['jungle'],
  baseStats: {
    hp: 1500, startMana: 40, maxMana: 100,
    attack: 90, special: 100, defense: 70, spDefense: 70,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'tapubulu_natures_madness',
    name: "Nature's Madness",
    description: "Double health and gain 30/50/500 armor and magic resist for the rest of combat. In this form, attack speed is set to 0.5. Each attack does an extra 5/8/50% true damage scaling with health. Every third attack heals Tapu Bulu for 300/500/2000 health.",
    scaling: { armorMr: [30, 50, 500], trueDmgPct: [0.05, 0.08, 0.50], thirdAtkHeal: [300, 500, 2000] },
  },
  spritePath: '/visuals/sprites/jungle/tapu-bulu-sprite.png',
  spriteScale: 0.90,
}


// ─── Volcanic ────────────────────────────────────────────────────────────────
// Graveler(1), Torkoal(2), Gible(2), Typhlosion(3), Armarouge(4), A-Marowak(4), Wheezing(4), Charizard(5)

export const TYPHLOSION: UnitDefinition = {
  id: 'typhlosion',
  name: 'Typhlosion',
  cost: 3,
  traits: ['volcanic'],
  baseStats: {
    hp: 850, startMana: 30, maxMana: 50,
    attack: 55, special: 110, defense: 40, spDefense: 40,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'typhlosion_eruption',
    name: 'Eruption',
    description: 'Lob fireballs at the 1/2/3 nearest enemies, each dealing 200/350/500% attack damage.',
    scaling: { targetCount: [1, 2, 3], damage: [200, 350, 500] },
  },
  spritePath: '/visuals/sprites/volcano/typhlosion-sprite.webp',
  spriteScale: 0.8,
}

export const TORKOAL: UnitDefinition = {
  id: 'torkoal',
  name: 'Torkoal',
  cost: 2,
  traits: ['volcanic'],
  baseStats: {
    hp: 850, startMana: 40, maxMana: 100,
    attack: 40, special: 90, defense: 70, spDefense: 35,
    attackSpeed: 0.50, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'torkoal_white_smoke',
    name: 'White Smoke',
    description: "Heal for 200/300/450 HP. Launch a smoke cloud at the enemy who has dealt the most damage this combat, dealing 100/150/250 special damage and blinding them for 2/2/3 seconds (80% miss chance).",
    scaling: { healAmount: [200, 300, 450], damage: [100, 150, 250], blindDuration: [2, 2, 3] },
  },
  spritePath: '/visuals/sprites/volcano/torkoal-sprite.webp',
}

export const PALOSSAND: UnitDefinition = {
  id: 'palossand',
  name: 'Palossand',
  cost: 4,
  traits: ['beachy'],
  baseStats: {
    hp: 1050, startMana: 50, maxMana: 100,
    attack: 55, special: 110, defense: 55, spDefense: 50,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'palossand_scorching_sands',
    name: 'Scorching Sands',
    description: 'Explode sand under the 3/3/4 nearest enemies, dealing 75/150/300 magic damage and burning them for 4 seconds (burn damage scales with SpellBuff%). Increment SpellBuff.',
    scaling: { targetCount: [3, 3, 4], damage: [75, 150, 300] },
  },
  spritePath: '/visuals/sprites/beachy/palossand-sprite.webp',
}

export const TALONFLAME: UnitDefinition = {
  id: 'talonflame',
  name: 'Talonflame',
  cost: 4,
  traits: ['sky_striker'],
  baseStats: {
    hp: 900, startMana: 20, maxMana: 60,
    attack: 70, special: 100, defense: 40, spDefense: 40,
    attackSpeed: 0.90, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'talonflame_brave_bird',
    name: 'Brave Bird',
    description: 'Lunge at the current target for 200/325/500 physical damage (+60% vs targets with higher max HP). On kill, instantly recast at 75% damage.',
    scaling: { damage: [200, 325, 500] },
  },
  spritePath: '/visuals/sprites/sky_strikers/talonflame-sprite.webp',
}

export const CHARIZARD: UnitDefinition = {
  id: 'charizard',
  name: 'Charizard',
  cost: 5,
  traits: ['volcanic'],  
  baseStats: {
    hp: 1300, startMana: 50, maxMana: 80,
    attack: 80, special: 110, defense: 60, spDefense: 60,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'charizard_blast_burn',
    name: 'Blast Burn',
    description: 'First cast: Send out 3/4/10 fireballs that mark nearby enemies and deal 300/500/2000 attack damage. Second cast: Send out 1/1/10 powerful blasts that instantly kill the highest-HP marked enemies; remaining marks explode for 500/700/3000 attack damage.',
    scaling: { fireballCount: [3, 4, 10], fireballDamage: [300, 500, 2000], killCount: [1, 1, 10], detonateDamage: [500, 700, 3000] },
  },
  spritePath: '/visuals/sprites/volcano/charizard-sprite.webp',
}


export const PIDGEOTTO: UnitDefinition = {
  id: 'pidgeotto',
  name: 'Pidgeotto',
  cost: 1,
  traits: ['sky_striker'],
  baseStats: {
    hp: 500, startMana: 0, maxMana: 50,
    attack: 35, special: 90, defense: 20, spDefense: 20,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'pidgeotto_dual_wingbeat',
    name: 'Wing Slap',
    description: 'The next auto strikes twice in quick succession, each hit dealing 110/120/150% of Attack as physical damage and applying on-hit effects.',
    scaling: { damagePercent: [110, 120, 150] },
  },
  spritePath: '/visuals/sprites/sky_strikers/pidgeotto-sprite.webp',
}

export const NOIVERN: UnitDefinition = {
  id: 'noivern',
  name: 'Noivern',
  cost: 4,
  traits: ['sky_striker'],
  baseStats: {
    hp: 1000, startMana: 40, maxMana: 90,
    attack: 65, special: 105, defense: 45, spDefense: 55,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 3,
  },
  ability: {
    id: 'noivern_boomburst',
    name: 'Boomburst',
    description: 'Let out a massive screech, hitting all enemies within 3 rows for 400/650/2000 special damage.',
    scaling: { damage: [400, 650, 2000] },
  },
  spritePath: '/visuals/sprites/sky_strikers/noivern-sprite.webp',
}

export const RAYQUAZA: UnitDefinition = {
  id: 'rayquaza',
  name: 'Rayquaza',
  cost: 5,
  traits: ['sky_striker'],
  baseStats: {
    hp: 1400, startMana: 30, maxMana: 100,
    attack: 90, special: 110, defense: 60, spDefense: 60,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'rayquaza_dragon_ascent',
    name: 'Dragon Ascent',
    description: 'Mega Evolve and grab the current target, flying off-screen together. Slam down onto the furthest enemy for 300/450/9999 + 2/5/999% of the grabbed unit\'s max HP in a 1-hex radius (50% in a 2-hex radius). Both units land near the slam point. Subsequent casts skip the mega evo.',
    scaling: { damage: [300, 450, 9999], hpPercent: [2, 5, 999] },
  },
  spritePath: '/visuals/sprites/sky_strikers/rayquaza-sprite.webp',
}

export const AERODACTYL: UnitDefinition = {
  id: 'aerodactyl',
  name: 'Aerodactyl',
  cost: 5,
  traits: ['ascender'],
  baseStats: {
    hp: 1200, startMana: 0, maxMana: 80,
    attack: 90, special: 100, defense: 55, spDefense: 55,
    attackSpeed: 0.90, critChance: 0.35, critDamage: 1.50, range: 1,
  },
  ability: {
    id: 'aerodactyl_ancient_power',
    name: 'Ancient Power',
    description: 'Permanently gain 8/12/20% to all stats. Gain a passive attack handler: every auto launches a rock projectile that bounces to the furthest nearby enemy for 80/120/200 magic damage.',
    scaling: { statBonus: [0.08, 0.12, 0.20], rockDamage: [80, 120, 200] },
  },
  spritePath: '/visuals/sprites/aerodactyl.png',
}

// â"€â"€â"€ Cave Crawler â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export const GRAVELER: UnitDefinition = {
  id: 'graveler',
  name: 'Graveler',
  cost: 1,
  traits: ['volcanic'],
  baseStats: {
    hp: 700, startMana: 9999, maxMana: 9999,
    attack: 40, special: 80, defense: 35, spDefense: 20,
    attackSpeed: 0.55, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'graveler_iron_defense',
    name: 'Iron Defense',
    description: "Passive: Start combat with a 200/350/500 HP shield (+ 10/20/30% of max HP). When the shield breaks, permanently gain 10/20/50 defense.",
    scaling: { shieldBase: [200, 350, 500], hpPct: [10, 20, 30], defGain: [10, 20, 50] },
  },
  spritePath: '/visuals/sprites/volcano/graveler-sprite.webp',
}

export const EXCADRILL: UnitDefinition = {
  id: 'excadrill',
  name: 'Excadrill',
  cost: 3,
  traits: ['cave_crawler'],
  baseStats: {
    hp: 900, startMana: 50, maxMana: 100,
    attack: 65, special: 90, defense: 45, spDefense: 35,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'excadrill_drill_run',
    name: 'Drill Run',
    description: 'Tunnel to the furthest enemy within 3 hexes (invulnerable during dash), knocking them up for 0.5s and dealing 250/375/500 physical damage. The next 3 attacks also hit adjacent enemies for 110/165/300 bonus physical damage.',
    scaling: { damage: [250, 375, 500], bonusDamage: [110, 165, 300] },
  },
  spritePath: '/visuals/sprites/cave_crawlers/excadrill-sprite.webp',
}

export const STONJOURNER: UnitDefinition = {
  id: 'stonjourner',
  name: 'Stonjourner',
  cost: 2,
  traits: ['ruiner'],
  baseStats: {
    hp: 900, startMana: 30, maxMana: 80,
    attack: 55, special: 80, defense: 60, spDefense: 30,
    attackSpeed: 0.55, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'stonjourner_power_spot',
    name: 'Power Gem',
    description: 'Heal for 150/225/350 HP. Steal 10/15/25% of the nearest ally\'s armor and special defense as a flat buff for the rest of combat.',
    scaling: { healAmount: [150, 225, 350], stealPercent: [0.10, 0.15, 0.25] },
  },
  spritePath: '/visuals/sprites/ruiner/stonjourner_moving.gif',
}

export const DRUDDIGON: UnitDefinition = {
  id: 'druddigon',
  name: 'Druddigon',
  cost: 3,
  traits: ['cave_crawler'],
  baseStats: {
    hp: 1000, startMana: 50, maxMana: 100,
    attack: 65, special: 95, defense: 50, spDefense: 40,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'druddigon_dragon_tail',
    name: 'Dragon Tail',
    description: 'Strike with a powerful tail swipe, dealing 300/450/700 attack damage. If the blow kills the target, they are briefly stunned then knocked back 2 hexes and die on landing. Enemies they collide with take 30% of the strike damage.',
    scaling: { damage: [300, 450, 700] },
  },
  spritePath: '/visuals/sprites/cave_crawlers/druddigon-sprite.png',
}

export const ARMAROUGE: UnitDefinition = {
  id: 'armarouge',
  name: 'Armarouge',
  cost: 4,
  traits: ['volcanic'],
  baseStats: {
    hp: 1000, startMana: 30, maxMana: 50,
    attack: 80, special: 90, defense: 50, spDefense: 50,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'armarouge_armor_cannon',
    name: 'Armor Cannon',
    description: 'Fire a cannon blast in a line at the farthest enemy, dealing 200/300/500 physical damage to all enemies hit. Gain 7/10/15 attack per enemy hit permanently. For the next 3 seconds, gain 35/50/75% attack speed and all autos deal 15/25/33% bonus AoE damage in 1 hex.',
    scaling: { damage: [200, 300, 500], atkBonusPerHit: [7, 10, 15], atkSpdBonus: [35, 50, 75], aoePct: [15, 25, 33] },
  },
  spritePath: '/visuals/sprites/volcano/armarouge-sprite.webp',
  spriteScale: 0.90,
}

export const A_MAROWAK: UnitDefinition = {
  id: 'a_marowak',
  name: 'Alolan Marowak',
  cost: 4,
  traits: ['volcanic'],
  baseStats: {
    hp: 950, startMana: 40, maxMana: 80,
    attack: 70, special: 100, defense: 55, spDefense: 50,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'a_marowak_shadow_bone',
    name: 'Shadow Bone',
    description: 'Empower the next 3 attacks: the first two deal 300/450/700 bonus magic damage. The third spins through all enemies in a 1-hex radius, dealing 450/600/850 bonus magic damage to each and healing Alolan Marowak for 50% of total damage dealt.',
    scaling: { firstTwoDamage: [300, 450, 700], thirdDamage: [450, 600, 850] },
  },
  spritePath: '/visuals/sprites/volcano/a-marowack-sprite.webp',
}


export const SABLEYE: UnitDefinition = {
  id: 'sableye',
  name: 'Sableye',
  cost: 2,
  traits: ['cave_crawler'],
  baseStats: {
    hp: 600, startMana: 0, maxMana: 60,
    attack: 45, special: 95, defense: 30, spDefense: 30,
    attackSpeed: 0.75, critChance: 0.30, critDamage: 1.50, range: 4,
  },
  ability: {
    id: 'sableye_power_gem',
    name: 'Power Gem',
    description: 'Alternates between two gem casts. Shield cast: send 2 blue gems to the lowest % health allies, shielding each for 250/325/425. Damage cast: send 2 red gems to the 2 nearest enemies, dealing 200/300/550 special damage each.',
    scaling: { shieldAmount: [250, 325, 425], damage: [200, 300, 550] },
  },
  spritePath: '/visuals/sprites/cave_crawlers/sableye-sprite.webp',
}

export const MORGREM: UnitDefinition = {
  id: 'morgrem',
  name: 'Morgrem',
  cost: 1,
  traits: ['temporal_woods'],
  baseStats: {
    hp: 500, startMana: 20, maxMana: 70,
    attack: 35, special: 95, defense: 50, spDefense: 55,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'morgrem_spirit_break',
    name: 'Spirit Break',
    description: 'Gain a 350/430/550 shield for 3 seconds and create a 1-hex aura that drains 2/3/5 mana every 0.5s from nearby enemies. When the aura ends, strike the target for 50/100/150 + total mana drained as special damage.',
    scaling: { shield: [350, 430, 550], baseDamage: [50, 100, 150], manaDrain: [2, 3, 5] },
  },
  spritePath: '/visuals/sprites/temporal_woods/Morgrem-sprite.webp',
}

export const ABSOL: UnitDefinition = {
  id: 'absol',
  name: 'Absol',
  cost: 3,
  traits: ['ruiner'],
  baseStats: {
    hp: 850, startMana: 30, maxMana: 80,
    attack: 70, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.80, critChance: 0.35, critDamage: 1.60, range: 1,
  },
  ability: {
    id: 'absol_night_slash',
    name: 'Night Slash',
    description: 'Move 1 hex toward the largest enemy cluster and slash all enemies in a 1-hex radius for 200/300/500 physical damage. Heal Absol for 60/90/150 HP for each enemy hit.',
    scaling: { damage: [200, 300, 500], healPerHit: [60, 90, 150] },
  },
  spritePath: '/visuals/sprites/ruiner/absol_moving.gif',
}

export const GOGOAT: UnitDefinition = {
  id: 'gogoat',
  name: 'Gogoat',
  cost: 2,
  traits: ['ascender'],
  baseStats: {
    hp: 800, startMana: 40, maxMana: 90,
    attack: 55, special: 90, defense: 40, spDefense: 35,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'gogoat_grass_pelt',
    name: 'Horn Leech',
    description: 'Empower the next 3 attacks: each deals 50/75/125 bonus physical damage, heals Gogoat for 50/75/125 HP, and heals the nearest ally for 25/40/60 HP.',
    scaling: { atkBonus: [50, 75, 125], selfHeal: [50, 75, 125], allyHeal: [25, 40, 60] },
  },
  spritePath: '/visuals/sprites/gogoat.png',
}

export const ORANGURU: UnitDefinition = {
  id: 'oranguru',
  name: 'Oranguru',
  cost: 4,
  traits: ['temporal_woods'],
  baseStats: {
    hp: 1000, startMana: 60, maxMana: 110,
    attack: 50, special: 120, defense: 50, spDefense: 60,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'oranguru_stored_power',
    name: 'Stored Power',
    description: 'For the rest of combat, replace auto attacks with psychic waves dealing 80/100/120% special damage. Every 5th wave is empowered: deals 100/175/300 bonus special damage and permanently grants 1/2/5 special.',
    scaling: { specialPct: [80, 100, 120], empBonus: [100, 175, 300], spGain: [1, 2, 5] },
  },
  spritePath: '/visuals/sprites/temporal_woods/Oranguru-sprite.webp',
}


export const SNORUNT: UnitDefinition = {
  id: 'snorunt',
  name: 'Snorunt',
  cost: 1,
  traits: ['froststone'],
  baseStats: {
    hp: 450, startMana: 20, maxMana: 60,
    attack: 30, special: 85, defense: 20, spDefense: 25,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'snorunt_ice_body',
    name: 'Powder Snow',
    description: 'Gain a 120/180/280 shield. When the shield expires or breaks, release ice shards hitting all nearby enemies within 2 hexes for 80/120/200 magic damage and chilling them for 1.5 seconds.',
    scaling: { shieldAmount: [120, 180, 280], shardDamage: [80, 120, 200] },
  },
  spritePath: '/visuals/sprites/snorunt.png',
}

export const FROSLASS: UnitDefinition = {
  id: 'froslass',
  name: 'Froslass',
  cost: 3,
  traits: ['froststone'],
  baseStats: {
    hp: 750, startMana: 40, maxMana: 90,
    attack: 50, special: 110, defense: 35, spDefense: 50,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'froslass_icy_wind',
    name: 'Icy Wind',
    description: 'Fire an icy beam through a line of enemies dealing 200/300/500 magic damage to the first, with 25% falloff per subsequent enemy hit. All hit enemies are chilled (-25% attack speed) for 2 seconds.',
    scaling: { baseDamage: [200, 300, 500] },
  },
  spritePath: '/visuals/sprites/froslass.png',
}

export const XATU: UnitDefinition = {
  id: 'xatu',
  name: 'Xatu',
  cost: 3,
  traits: ['ruiner'],
  baseStats: {
    hp: 750, startMana: 50, maxMana: 100,
    attack: 45, special: 110, defense: 35, spDefense: 50,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'xatu_magic_bounce',
    name: 'Future Sight',
    description: 'Place a Future Sight mark on the nearest enemy. The mark detonates after 2 seconds, dealing 300/450/700 magic damage amplified by the incoming damage they took while marked.',
    scaling: { detonationDamage: [300, 450, 700] },
  },
  spritePath: '/visuals/sprites/ruiner/xatu_moving.gif',
}

export const CELEBI: UnitDefinition = {
  id: 'celebi',
  name: 'Celebi',
  cost: 5,
  traits: ['temporal_woods'],
  baseStats: {
    hp: 1200, startMana: 60, maxMana: 120,
    attack: 70, special: 120, defense: 60, spDefense: 70,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'celebi_future_sight',
    name: 'Future Sight',
    description: 'Mark the nearest unmarked enemy for 2 seconds — marked enemies take 10/20/30% increased damage from all sources. When the mark detonates, deal 450/600/900 special damage.',
    scaling: { damageMult: [10, 20, 30], detonationDamage: [450, 600, 900] },
  },
  spritePath: '/visuals/sprites/temporal_woods/Celebi-sprite.webp',
}

export const ABOMASNOW: UnitDefinition = {
  id: 'abomasnow',
  name: 'Abomasnow',
  cost: 4,
  traits: ['froststone'],
  baseStats: {
    hp: 1100, startMana: 40, maxMana: 90,
    attack: 65, special: 105, defense: 55, spDefense: 55,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'abomasnow_blizzard',
    name: 'Blizzard',
    description: 'Create a blizzard zone at Abomasnow\'s position for 4/5/6 seconds, dealing 60/90/150 magic damage per second to all enemies within 2 hexes. Enemies killed inside the blizzard extend its duration by 1 second. Recasting refreshes the duration.',
    scaling: { damagePerSec: [60, 90, 150], duration: [4, 5, 6] },
  },
  spritePath: '/visuals/sprites/abomasnow.png',
}


export const RUNERIGUS: UnitDefinition = {
  id: 'runerigus',
  name: 'Runerigus',
  cost: 3,
  traits: ['ruiner'],
  baseStats: {
    hp: 950, startMana: 40, maxMana: 90,
    attack: 55, special: 100, defense: 60, spDefense: 55,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'runerigus_wandering_spirit',
    name: 'Wandering Spirit',
    description: 'Place a Wandering Spirit mark on the nearest enemy. While marked, the enemy is silenced and cannot cast abilities. If they attempt to cast, deal 250/375/600 magic damage instead.',
    scaling: { silenceDamage: [250, 375, 600] },
  },
  spritePath: '/visuals/sprites/ruiner/runerigus_moving.gif',
}

export const SPIRITOMB: UnitDefinition = {
  id: 'spiritomb',
  name: 'Spiritomb',
  cost: 3,
  traits: ['ruiner'],
  baseStats: {
    hp: 900, startMana: 50, maxMana: 100,
    attack: 55, special: 105, defense: 55, spDefense: 60,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'spiritomb_destiny_bond',
    name: 'Ominous Wind',
    description: 'Create a self-centered AoE zone dealing 50/75/120 magic damage per second to adjacent enemies. Additionally, mark the most distant enemy - the mark mirrors the zone\'s damage onto them each tick.',
    scaling: { damagePerSec: [50, 75, 120] },
  },
  spritePath: '/visuals/sprites/ruiner/spiritomb_moving.gif',
}

export const WHEEZING: UnitDefinition = {
  id: 'wheezing',
  name: 'Wheezing',
  cost: 4,
  traits: ['volcanic'],
  baseStats: {
    hp: 1050, startMana: 30, maxMana: 80,
    attack: 55, special: 105, defense: 60, spDefense: 60,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'wheezing_poison_gas',
    name: 'Poison Gas',
    description: 'For the next 5 seconds, puff poison gas every 0.5 seconds in a 1-hex radius. Each puff deals 8/10/12 special damage and applies 30% Sunder and Shred to every enemy hit. Heals Wheezing for 50/75/200 HP per enemy hit per puff.',
    scaling: { damagePerPuff: [8, 10, 12], healPerHit: [50, 75, 200] },
  },
  spritePath: '/visuals/sprites/volcano/weezing-sprite.webp',
}

export const FEZANDIPITI: UnitDefinition = {
  id: 'fezandipiti',
  name: 'Fezandipiti',
  cost: 4,
  traits: ['temporal_woods'],
  baseStats: {
    hp: 1000, startMana: 50, maxMana: 100,
    attack: 60, special: 110, defense: 55, spDefense: 60,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 2,
  },
  ability: {
    id: 'fezandipiti_toxic_chain',
    name: 'Toxic Chain',
    description: 'Send toxic chains to all enemies in a 3-hex radius for 4 seconds. Chained enemies take 20/30/90 damage per second, doubled each second. Fezandipiti gains 40/50/90% defense and sp. defense and heals 370/516/1589 over the duration. All chained enemies are stunned for 1 second when the chains end.',
    scaling: { damagePerSec: [20, 30, 90], durabilityPct: [40, 50, 90], heal: [370, 516, 1589] },
  },
  spritePath: '/visuals/sprites/temporal_woods/Fezandipiti-sprite.png',
}

//Ascenders

export const CLAYDOL: UnitDefinition = {
  id: 'claydol',
  name: 'Claydol',
  cost: 4,
  traits: ['ruiner'],
  baseStats: {
    hp: 1000, startMana: 60, maxMana: 120,
    attack: 55, special: 110, defense: 55, spDefense: 65,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 3,
  },
  ability: {
    id: 'claydol_gravity',
    name: 'Cosmic Power',
    description: 'Lift the 2 nearest enemies into the ascended state for 2.5 seconds. When they land, deal 350/525/850 magic damage to all enemies in a 1-hex radius with 40% splash falloff.',
    scaling: { centerDamage: [350, 525, 850], ascentDuration: [2.5, 2.5, 2.5] },
  },
  spritePath: '/visuals/sprites/ruiner/claydol_moving.gif',
}

export const TAPU_LELE: UnitDefinition = {
  id: 'tapu_lele',
  name: 'Tapu Lele',
  cost: 5,
  traits: ['temporal_woods'],
  baseStats: {
    hp: 1200, startMana: 60, maxMana: 120,
    attack: 70, special: 130, defense: 55, spDefense: 70,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'tapulele_natures_madness',
    name: "Nature's Madness",
    description: 'Psystrike the closest 4/5/10 enemies for 500/750/5000 magic damage after a 2-second channel. If Psychic Terrain is active, ignore 30/45/100% of their magic resistance.',
    scaling: { targetCount: [4, 5, 10], damage: [500, 750, 5000], spDefPierce: [30, 45, 100] },
  },
  spritePath: '/visuals/sprites/temporal_woods/tapu-lele-sprite.webp',
}

export const TAPU_KOKO: UnitDefinition = {
  id: 'tapu_koko',
  name: 'Tapu Koko',
  cost: 5,
  traits: ['ascender'],
  baseStats: {
    hp: 1200, startMana: 0, maxMana: 80,
    attack: 85, special: 110, defense: 55, spDefense: 55,
    attackSpeed: 0.85, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'tapukoko_electric_surge',
    name: 'Electric Surge',
    description: 'Empower the next auto to chain lightning through 4/5/6 enemies for 150/225/375 magic damage each (stunned 0.5s). Passive: every 3rd auto fires chain lightning without the stun. Electric Terrain: each chain stacks +5% attack speed permanently.',
    scaling: { chainTargets: [4, 5, 6], chainDamage: [150, 225, 375] },
  },
  spritePath: '/visuals/sprites/tapuKoko.png',
}

export const TAPU_FINI: UnitDefinition = {
  id: 'tapu_fini',
  name: 'Tapu Fini',
  cost: 5,
  traits: ['beachy'],
  baseStats: {
    hp: 1300, startMana: 0, maxMana: 100,
    attack: 70, special: 120, defense: 65, spDefense: 80,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'tapufini_natures_madness',
    name: 'Whirlpool',
    description: "Create a 10-second whirlpool under Fini's attack target (or a different enemy if already whirlpooled), reducing their armor and MR by 2/3/20% + % spell buff. Deals 100/150/5000 special damage per second and heals Tapu Fini for 33/33/85% of damage dealt. Misty Terrain: double-cast.",
    scaling: { damagePerSec: [100, 150, 5000], healPct: [33, 33, 85], reductionPct: [2, 3, 20] },
  },
  spritePath: '/visuals/sprites/beachy/tapu-fini-sprite.webp',
}

// â"€â"€â"€ Froststone â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export const ZUBAT: UnitDefinition = {
  id: 'zubat',
  name: 'Zubat',
  cost: 1,
  traits: ['cave_crawler'],
  baseStats: {
    hp: 450, startMana: 0, maxMana: 30,
    attack: 30, special: 85, defense: 15, spDefense: 20,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'zubat_poison_sting',
    name: 'Poison Sting',
    description: 'Send out a poison dart, dealing 200/350/600 special damage. It poisons the target, dealing 20/50/75 special damage over the next 4 seconds. This poison effect can stack.',
    scaling: { damage: [200, 350, 600], poisonTotal: [20, 50, 75] },
  },
  spritePath: '/visuals/sprites/cave_crawlers/zubat-sprite.webp',
}

export const MORELULL: UnitDefinition = {
  id: 'morelull',
  name: 'Morelull',
  cost: 1,
  traits: ['temporal_woods'],
  baseStats: {
    hp: 500, startMana: 30, maxMana: 70,
    attack: 25, special: 95, defense: 20, spDefense: 30,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'morelull_strength_sap',
    name: 'Strength Sap',
    description: 'Launch a projectile at the target dealing 300/450/700 special damage and lowering their attack by 33% for 3 seconds. A smaller projectile then travels from the enemy to the nearest ally, healing them for 85/100/130% of the target\'s attack.',
    scaling: { damage: [300, 450, 700], healPct: [85, 100, 130] },
  },
  spritePath: '/visuals/sprites/temporal_woods/Morelull-sprite.webp',
}

export const SNEASLER: UnitDefinition = {
  id: 'sneasler',
  name: 'Sneasler',
  cost: 3,
  traits: ['ascender'],
  baseStats: {
    hp: 850, startMana: 30, maxMana: 80,
    attack: 65, special: 100, defense: 40, spDefense: 40,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'sneasler_dire_claw',
    name: 'Dire Claw',
    description: 'Deal 200/300/500 physical damage to the nearest enemy and apply stackable poison (30/45/75 magic damage per second for 3 seconds). If the target is already poisoned, this hit can critically strike.',
    scaling: { damage: [200, 300, 500], poisonPerSec: [30, 45, 75] },
  },
  spritePath: '/visuals/sprites/sneasler.png',
}

export const WEAVILE: UnitDefinition = {
  id: 'weavile',
  name: 'Weavile',
  cost: 3,
  traits: ['froststone'],
  baseStats: {
    hp: 750, startMana: 40, maxMana: 90,
    attack: 75, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.85, critChance: 0.35, critDamage: 1.60, range: 1,
  },
  ability: {
    id: 'weavile_triple_axel',
    name: 'Triple Axel',
    description: 'Empower the next 3 attacks with distinct effects: (1) 100/150/250 bonus physical damage; (2) spin AoE hitting all adjacent enemies for 80/120/200 magic damage; (3) 6/8/12% max HP bonus physical damage + knock up for 1 second.',
    scaling: { firstDmg: [100, 150, 250], spinDmg: [80, 120, 200], hpPercent: [0.06, 0.08, 0.12] },
  },
  spritePath: '/visuals/sprites/weavile.png',
}

export const H_AVALUGG: UnitDefinition = {
  id: 'h_avalugg',
  name: 'Hisuian Avalugg',
  cost: 4,
  traits: ['froststone'],
  baseStats: {
    hp: 1200, startMana: 40, maxMana: 90,
    attack: 70, special: 90, defense: 80, spDefense: 40,
    attackSpeed: 0.55, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'h_avalugg_mountain_gale',
    name: 'Icicle Crash',
    description: 'Drop icicles on the 3/4/5 nearest enemies, dealing 200/300/500 physical damage each and knocking them up for 1.5/2/3 seconds.',
    scaling: { targetCount: [3, 4, 5], damage: [200, 300, 500], knockUpSeconds: [1.5, 2, 3] },
  },
  spritePath: '/visuals/sprites/h_avalugg.png',
}

export const MAMOSWINE: UnitDefinition = {
  id: 'mamoswine',
  name: 'Mamoswine',
  cost: 4,
  traits: ['froststone'],
  baseStats: {
    hp: 1150, startMana: 40, maxMana: 90,
    attack: 75, special: 95, defense: 60, spDefense: 50,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'mamoswine_thick_fat',
    name: 'Ice Rider',
    description: 'Gain 40/60/100 armor and MR for 5 seconds. During this time, become a passive attack handler - each auto deals your defense + MR as bonus special damage.',
    scaling: { armorMr: [40, 60, 100] },
  },
  spritePath: '/visuals/sprites/mamoswine.png',
}

// â"€â"€â"€ Beachy â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export const KINGLER: UnitDefinition = {
  id: 'kingler',
  name: 'Kingler',
  cost: 1,
  traits: ['beachy'],
  baseStats: {
    hp: 550, startMana: 0, maxMana: 50,
    attack: 45, special: 80, defense: 30, spDefense: 20,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'kingler_crabhammer',
    name: 'Crabhammer',
    description: 'Kingler attacks, dealing 200/350/500 + % spell buff physical damage.',
    scaling: { damage: [200, 350, 500] },
  },
  spritePath: '/visuals/sprites/beachy/kingler-sprite.webp',
}

export const QUAGSIRE: UnitDefinition = {
  id: 'quagsire',
  name: 'Quagsire',
  cost: 4,
  traits: ['river'],
  baseStats: {
    hp: 1100, startMana: 50, maxMana: 100,
    attack: 60, special: 95, defense: 60, spDefense: 55,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'quagsire_unaware',
    name: 'Unaware',
    description: 'Gain a 100/150/400 shield per enemy within 2 hexes and taunt all enemies within 1 hex for 4 seconds. When the shield expires or breaks, deal 200/350/600 magic damage and chill (-30% attack speed) all enemies within 1 hex.',
    scaling: { shieldPerEnemy: [100, 150, 400], aoeDamage: [200, 350, 600] },
  },
  spritePath: '/visuals/sprites/river/quagsire-sprite.webp',
}

export const BARRASKEWDA: UnitDefinition = {
  id: 'barraskewda',
  name: 'Barraskewda',
  cost: 3,
  traits: ['river'],
  baseStats: {
    hp: 800, startMana: 0, maxMana: 60,
    attack: 70, special: 90, defense: 35, spDefense: 35,
    attackSpeed: 0.90, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'barraskewda_fishous_rend',
    name: 'Fishous Rend',
    description: 'Dash to the lowest-HP enemy within 2 hexes, striking for 200/320/550 physical damage (×1.5 if target is below half health). Each subsequent cast costs 10 less mana (minimum 20).',
    scaling: { damage: [200, 320, 550] },
  },
  spritePath: '/visuals/sprites/river/barraskewda-sprite.webp',
}

export const KLAWF: UnitDefinition = {
  id: 'klawf',
  name: 'Klawf',
  cost: 2,
  traits: ['ascender'],
  baseStats: {
    hp: 700, startMana: 30, maxMana: 80,
    attack: 55, special: 85, defense: 45, spDefense: 35,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'klawf_anger_shell',
    name: 'Ambush',
    description: 'Leap to the furthest enemy within 2 hexes and gain a 150/225/350 shield and +30/50/80% attack speed (decaying over 4 seconds). Also gain +20/30/50 flat attack.',
    scaling: { shieldAmount: [150, 225, 350], atkSpdBonus: [0.30, 0.50, 0.80], atkBonus: [20, 30, 50] },
  },
  spritePath: '/visuals/sprites/klawf.png',
}

export const DREDNAW: UnitDefinition = {
  id: 'drednaw',
  name: 'Drednaw',
  cost: 3,
  traits: ['river'],
  baseStats: {
    hp: 1000, startMana: 40, maxMana: 90,
    attack: 65, special: 90, defense: 65, spDefense: 50,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'drednaw_razor_shell',
    name: 'Razor Shell',
    description: 'For the next 5 seconds, gain 20/30/50 attack and Drednaw\'s attacks become sweeping slashes, dealing 110/160/235 bonus physical damage and ignoring 30% armor.',
    scaling: { atkBonus: [20, 30, 50], bonusDamage: [110, 160, 235] },
  },
  spritePath: '/visuals/sprites/river/drednaw-sprite.webp',
}


export const WAILORD: UnitDefinition = {
  id: 'wailord',
  name: 'Wailord',
  cost: 4,
  traits: ['sky_striker'],
  baseStats: {
    hp: 1400, startMana: 0, maxMana: 40,
    attack: 60, special: 100, defense: 50, spDefense: 50,
    attackSpeed: 0.55, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'wailord_bounce',
    name: 'Bounce',
    description: 'Bounce up, gaining a 75/150/300 shield, then slam down on the target, stunning them for 1/1/1.5 seconds and dealing 80/120/180 special damage.',
    scaling: { shield: [75, 150, 300], stunSeconds: [1, 1, 1.5], damage: [80, 120, 180] },
  },
  spritePath: '/visuals/sprites/sky_strikers/wailord-sprite.webp',
}

export const BLASTOISE: UnitDefinition = {
  id: 'blastoise',
  name: 'Blastoise',
  cost: 5,
  traits: ['beachy'],
  baseStats: {
    hp: 1400, startMana: 30, maxMana: 90,
    attack: 75, special: 110, defense: 70, spDefense: 70,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'blastoise_hydro_cannons',
    name: 'Hydro Cannon',
    description: 'For 5 seconds, gain 50/75/2000% attack speed. During this time, auto attacks trigger twice, each dealing 75%/100%/500% + % spell buff attack damage as magic damage.',
    scaling: { attackSpeedBonus: [50, 75, 2000], shotRatio: [75, 100, 500] },
  },
  spritePath: '/visuals/sprites/beachy/blastoise-sprite.webp',
  spriteScale: 0.80,
}


export const GIBLE: UnitDefinition = {
  id: 'gible',
  name: 'Gible',
  cost: 2,
  traits: ['volcanic'],
  baseStats: {
    hp: 650, startMana: 0, maxMana: 70,
    attack: 50, special: 90, defense: 35, spDefense: 25,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'gible_bite',
    name: 'Bite',
    description: 'Leap to a random enemy within 4 hexes, spinning rapidly through the air. On landing, deal 150/200/275 physical damage and stun for 1.5/2/2.5 seconds.',
    scaling: { damage: [150, 200, 275], stunSeconds: [1.5, 2, 2.5] },
  },
  spritePath: '/visuals/sprites/volcano/gible-sprite.webp',
  spriteScale: 0.70,
}

export const FERROTHORN: UnitDefinition = {
  id: 'ferrothorn',
  name: 'Ferrothorn',
  cost: 2,
  traits: ['cave_crawler'],
  baseStats: {
    hp: 850, startMana: 30, maxMana: 90,
    attack: 45, special: 90, defense: 65, spDefense: 50,
    attackSpeed: 0.55, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'ferrothorn_iron_barbs',
    name: 'Iron Barbs',
    description: 'Gain 25/30/40% durability for 4 seconds. Enemies who auto-attack Ferrothorn during this time take 75/150/225 special damage.',
    scaling: { durabilityPct: [25, 30, 40], retaliationDamage: [75, 150, 225] },
  },
  spritePath: '/visuals/sprites/cave_crawlers/ferrothron-sprite.webp',
}

export const BELLIBOLT: UnitDefinition = {
  id: 'bellibolt',
  name: 'Bellibolt',
  cost: 3,
  traits: ['river'],
  baseStats: {
    hp: 900, startMana: 0, maxMana: 80,
    attack: 50, special: 105, defense: 50, spDefense: 50,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'bellibolt_electrophoresis',
    name: 'Electrophoresis',
    description: 'Passive: Gain 1 charge (max 10) whenever Bellibolt is hit; each charge grants +5 Defense and +5 Sp. Def. On cast, discharge in a 1-hex radius dealing 50/90/120% of total Defense + Sp. Def as magic damage, then lose all charges.',
    scaling: { scalingPct: [50, 90, 120] },
  },
  spritePath: '/visuals/sprites/river/belliboilt-sprite.webp',
  spriteScale: 0.8,
}

export const A_RAICHU: UnitDefinition = {
  id: 'a_raichu',
  name: 'Alolan Raichu',
  cost: 3,
  traits: ['beachy'],
  baseStats: {
    hp: 750, startMana: 40, maxMana: 50,
    attack: 60, special: 110, defense: 35, spDefense: 40,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 3,
  },
  ability: {
    id: 'a_raichu_surge_surfer',
    name: 'Surge Surfer',
    description: 'Dash 2 hexes away from the nearest enemy. At the midpoint, fire (2 + SpellBuff) lightning bolts at the nearest enemies, each dealing 60/80/100 magic damage. Increment SpellBuff.',
    scaling: { projectileDamage: [60, 80, 100] },
  },
  spritePath: '/visuals/sprites/beachy/a-raichu-sprite.webp',
}

export const A_EXEGGUTOR: UnitDefinition = {
  id: 'a_exeggutor',
  name: 'Alolan Exeggutor',
  cost: 4,
  traits: ['beachy'],
  baseStats: {
    hp: 1100, startMana: 40, maxMana: 90,
    attack: 65, special: 110, defense: 55, spDefense: 60,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'a_exeggutor_egg_bomb',
    name: 'Egg Bomb',
    description: 'Lob an egg at the nearest enemy dealing 600/800/1000 magic damage + SpellBuff% bonus true damage. The egg then bounces to a random nearby enemy (within 2 hexes) dealing 50% damage.',
    scaling: { damage: [600, 800, 1000] },
  },
  spritePath: '/visuals/sprites/beachy/a-exeggutor-sprite.webp',
}

export const GOLETT: UnitDefinition = {
  id: 'golett',
  name: 'Golett',
  cost: 0,
  traits: ['ruiner'],
  baseStats: {
    hp: 600, startMana: 0, maxMana: 9999,
    attack: 50, special: 80, defense: 35, spDefense: 30,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'golett_shadow_punch',
    name: 'Shadow Punch',
    description: 'Every 4th attack fires a shadow punch dealing 80/120/200 bonus magic damage in a 1-hex AoE.',
    scaling: { bonusDamage: [80, 120, 200] },
  },
  spritePath: '/visuals/sprites/ruiner/golett_moving.gif',
}

export const GOLURK: UnitDefinition = {
  id: 'golurk',
  name: 'Golurk',
  cost: 0,
  traits: ['ruiner'],
  baseStats: {
    hp: 950, startMana: 0, maxMana: 9999,
    attack: 70, special: 90, defense: 50, spDefense: 45,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'golurk_poltergeist',
    name: 'Shadow Punch',
    description: 'Every 3rd attack fires a shadow punch dealing 120/180/300 bonus magic damage in a 1-hex AoE and grants a 200/300/500 shield.',
    scaling: { bonusDamage: [120, 180, 300], shieldAmount: [200, 300, 500] },
  },
  spritePath: '/visuals/sprites/ruiner/golurk_moving.gif',
}

// â"€â"€â"€ Testing â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export const DUMMY: UnitDefinition = {
  id: 'dummy',
  name: 'Dummy',
  cost: 0,
  traits: [],
  isDummy: true,
  baseStats: {
    hp: 1500, startMana: 0, maxMana: 9999,
    attack: 0, special: 0, defense: 30, spDefense: 30,
    attackSpeed: 0.5, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '',
}

export const DUMMY_MELEE: UnitDefinition = {
  id: 'dummy_melee',
  name: 'Attacker (Melee)',
  cost: 0,
  traits: [],
  baseStats: {
    hp: 400, startMana: 0, maxMana: 9999,
    attack: 55, special: 0, defense: 30, spDefense: 30,
    attackSpeed: 0.9, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '',
}

export const DUMMY_RANGED: UnitDefinition = {
  id: 'dummy_ranged',
  name: 'Attacker (Ranged)',
  cost: 0,
  traits: [],
  baseStats: {
    hp: 400, startMana: 0, maxMana: 9999,
    attack: 45, special: 0, defense: 30, spDefense: 30,
    attackSpeed: 0.9, critChance: 0, critDamage: 1.0, range: 4,
  },
  spritePath: '',
}

// â"€â"€â"€ Registry â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export const ALL_UNITS: UnitDefinition[] = [
  // Jungle (3/5/7): Tangela(1), Ribombee(1), Venusaur(2), Vigoroth(3), Vikavolt(3), Toucannon(4), Tropius(4), Tapu Bulu(5)
  TANGELA, RIBOMBEE,
  VENUSAUR,
  VIGOROTH, VIKAVOLT,
  TOUCANNON, TROPIUS,
  TAPU_BULU,
  // Beachy (2/4/6): Kingler(1), A-Raichu(3), Palossand(4), A-Exeggutor(4), Blastoise(5), Tapu Fini(5)
  KINGLER,
  A_RAICHU,
  PALOSSAND, A_EXEGGUTOR,
  BLASTOISE, TAPU_FINI,
  // Volcanic (3/5/7): Graveler(1), Torkoal(2), Gible(2), Typhlosion(3), A-Marowak(4), Wheezing(4), Charizard(5) + Armarouge(4 TBD)
  GRAVELER,
  TORKOAL, GIBLE,
  TYPHLOSION,
  ARMAROUGE, A_MAROWAK, WHEEZING,
  CHARIZARD,
  // Sky Striker (2/4/6): Pidgeotto(1), Wailord(4), Talonflame(4), Noivern(4), Rayquaza(5) + Charizard dual
  PIDGEOTTO,
  WAILORD, TALONFLAME, NOIVERN,
  RAYQUAZA,
  // Cave Crawler (3/5): Zubat(1), Druddigon(3), Sableye(2), Ferrothorn(2), Excadrill(3)
  ZUBAT,
  SABLEYE, FERROTHORN,
  EXCADRILL, DRUDDIGON,
  // River (2/3/4): Drednaw(3), Bellibolt(3), Quagsire(4), Barraskewda(3)
  DREDNAW, BELLIBOLT, BARRASKEWDA,
  QUAGSIRE,
  // Temporal Woods (2/4/6): Morelull(1), Morgrem(1), Oranguru(4), Celebi(5), Fezandipiti(4), Tapu Lele(5)
  MORELULL, MORGREM,
  ORANGURU, FEZANDIPITI,
  CELEBI, TAPU_LELE,
  // Ruiner (3/5/7): Stonjourner(2), Absol(3), Xatu(3), Claydol(4), Spiritomb(3), Runerigus(3) + Unown(TBD)
  STONJOURNER,
  ABSOL, XATU, SPIRITOMB, RUNERIGUS,
  CLAYDOL,
  // Ascender (2/4): Klawf(2), Gogoat(2), Sneasler(3), Aerodactyl(5)
  KLAWF, GOGOAT,
  SNEASLER,
  AERODACTYL,
  // Froststone (2/4/6): Snorunt(1), Froslass(3), Weavile(3), H-Avalugg(4), Abomasnow(4), Mamoswine(4)
  SNORUNT,
  FROSLASS, WEAVILE,
  H_AVALUGG, ABOMASNOW, MAMOSWINE,
  // Summons
  GOLETT, GOLURK,
  // Testing
  DUMMY, DUMMY_MELEE, DUMMY_RANGED,
]

export const UNIT_MAP: Map<string, UnitDefinition> = new Map(
  ALL_UNITS.map(u => [u.id, u])
)



