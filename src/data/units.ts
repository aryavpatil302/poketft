import type { UnitDefinition } from '../core/types'




// ─── Jungle ────────────────────────────────────────────────────────────────
// Tangela(1), Ribombee(1), Venusaur(2), Vigoroth(3), Vikavolt(3), Toucannon(4), Tropius(4), Tapu Bulu(5)

export const TANGELA: UnitDefinition = {
  id: 'tangela',
  name: 'Tangela',
  cost: 1,
  types: ['jungle', 'stalwart'],
  role: 'tank',
  baseStats: {
    hp: 600, startMana: 65, maxMana: 110,
    attack: 40, special: 100, defense: 50, spDefense: 50,
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

export const RIBOMBEE: UnitDefinition = {
  id: 'ribombee',
  name: 'Ribombee',
  cost: 1,
  types: ['jungle', 'promoter'],
  role: 'special caster',
  baseStats: {
    hp: 500, startMana: 30, maxMana: 60,
    attack: 25, special: 100, defense: 15, spDefense: 15,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'ribombee_pollen_puff',
    name: 'Pollen Puff',
    description: 'Launch 2 pollen puffs - one at the lowest health ally (heals for 100/175/300) and one at the nearest enemy (deals 200/275/400% special damage and reduces their attack speed by 30% for 1 second).',
    scaling: { healAmount: [100, 175, 300], damageAmount: [200, 275, 400] },
  },
  spritePath: '/visuals/sprites/jungle/ribombee-sprite.webp',
}

export const VENUSAUR: UnitDefinition = {
  id: 'venusaur',
  name: 'Venusaur',
  cost: 2,
  types: ['jungle','bruiser'],
  role: 'tank',
  baseStats: {
    hp: 800, startMana: 30, maxMana: 80,
    attack: 50, special: 100, defense: 65, spDefense: 65,
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

export const VIGOROTH: UnitDefinition = {
  id: 'vigoroth',
  name: 'Vigoroth',
  cost: 3,
  types: ['jungle','quickclaw', 'crashout'],
  role: 'attack fighter',
  baseStats: {
    hp: 750, startMana: 85, maxMana: 120,
    attack: 45, special: 100, defense: 50, spDefense: 50,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'vigoroth_fury_swipes',
    name: 'Fury Swipes',
    description: 'Jump to the furthest target in a 4 hex range and gain a 75/100/150 shield. While the shield holds, Vigoroth gains 20/30/50% attack speed and auto attacks deal an extra 50/75/100 bonus attack damage.',
    scaling: { shieldAmount: [200, 350, 500], atkSpdBonus: [0.20, 0.30, 0.50], atkDmgBonus: [50, 75, 100] },
  },
  spritePath: '/visuals/sprites/jungle/vigeroth-sprite.webp',
}

export const VIKAVOLT: UnitDefinition = {
  id: 'vikavolt',
  name: 'Vikavolt',
  cost: 3,
  types: ['jungle', 'promoter'],
  role: 'special caster',
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
  types: ['jungle','spellweaver'],
  role: 'attack caster',
  baseStats: {
    hp: 800, startMana: 20, maxMana: 65,
    attack: 75, special: 100, defense: 30, spDefense: 30,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'toucannon_beak_blast',
    name: 'Beak Blast',
    description: 'Launch a beak blast at the nearest enemy. It explodes and deals 700/1500/3000% physical damage and explodes in a 1 hex radius. Allies in the explosion heal for 100/200/500, and surrounding enemies take 300/400/600 damage.',
    scaling: { mainDamage: [700, 1500, 3000], allyHeal: [100, 200, 500], splashDamage: [300, 400, 600] },
  },
  spritePath: '/visuals/sprites/jungle/toucannon-sprite.webp',
}

export const TROPIUS: UnitDefinition = {
  id: 'tropius',
  name: 'Tropius',
  cost: 4,
  types: ['jungle','bruiser', 'substitutor'],
  role: 'tank',
  baseStats: {
    hp: 1200, startMana: 60, maxMana: 120,
    attack: 65, special: 100, defense: 70, spDefense: 70,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'tropius_leaf_tornado',
    name: 'Leaf Tornado',
    description: 'Fly up and launch a 3 hex wide tornado in a straight line, knocking up all enemies hit for 2/2/5 seconds and dealing 200/275/800 special damage. For each enemy hit, gain a 200/350/1000 health shield.',
    scaling: { damage: [200, 275, 800], knockUpSeconds: [2, 2, 5], shieldPerHit: [200, 350, 1000] },
  },
  spritePath: '/visuals/sprites/jungle/tropius-sprite.webp',
  spriteScale: 0.75,
}

export const TAPU_BULU: UnitDefinition = {
  id: 'tapu_bulu',
  name: 'Tapu Bulu',
  cost: 5,
  types: ['earth_spirit','jungle','roughneck'],
  role: 'attack fighter',
  baseStats: {
    hp: 1500, startMana: 40, maxMana: 100,
    attack: 90, special: 100, defense: 70, spDefense: 70,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'tapubulu_natures_madness',
    name: "Nature's Madness",
    description: "Double health and gain 30/50/500 armor and magic resist for the rest of combat. In this form, attack speed is set to 0.5. Each attack does an extra 5/8/50% true damage scaling with health. Every third attack heals Tapu Bulu for 300/500/2000 health and does half the enemies current health, executing below 5% . Grassy Terrain: gain an extra 30 armor/MR on transform; every third attack also heals all allies for 5% of their max HP.",
    scaling: { armorMr: [30, 50, 500], trueDmgPct: [0.05, 0.08, 0.50], thirdAtkHeal: [300, 500, 2000] },
  },
  spritePath: '/visuals/sprites/jungle/tapu-bulu-sprite.png',
  spriteScale: 0.90,
}


// ─── Beachy ────────────────────────────────────────────────────────────────
// Kingler(1), A-Raichu(2), Palossand(3), A-Exeggutor(3), Blastoise(4), Tapu Fini(5)

export const KINGLER: UnitDefinition = {
  id: 'kingler',
  name: 'Kingler',
  cost: 1,
  types: ['beachy','corkscrew'],
  role: 'attack fighter',
  baseStats: {
    hp: 650, startMana: 0, maxMana: 50,
    attack: 45, special: 100, defense: 50, spDefense: 20,
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

export const A_RAICHU: UnitDefinition = {
  id: 'a_raichu',
  name: 'Alolan Raichu',
  cost: 2,
  types: ['beachy','spellweaver'],
  role: 'special caster',
  baseStats: {
    hp: 650, startMana: 40, maxMana: 50,
    attack: 60, special: 100, defense: 35, spDefense: 40,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 3,
  },
  ability: {
    id: 'a_raichu_surge_surfer',
    name: 'Surge Surfer',
    description: 'Dash to safety and fire bolts at the 2 nearest enemies, each dealing 60/80/100% special magic damage, +1% special per Beachy SpellBuff stack. Gain +2 bolts per target on every dash (1, then 3, then 5...). Increment SpellBuff.',
    scaling: { projectileDamage: [60, 80, 100] },
  },
  spritePath: '/visuals/sprites/beachy/a-raichu-sprite.webp',
}

export const PALOSSAND: UnitDefinition = {
  id: 'palossand',
  name: 'Palossand',
  cost: 3,
  types: ['beachy','bruiser'],
  role: 'tank',
  baseStats: {
    hp: 800, startMana: 50, maxMana: 100,
    attack: 55, special: 100, defense: 55, spDefense: 65,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'palossand_scorching_sands',
    name: 'Scorching Sands',
    description: 'Explode sand under the 3/3/4 nearest enemies, dealing 75/150/300 magic damage and burning them for 4 seconds. Regenerate SpellBuff% of max HP over the burn duration (max 50%). Increment SpellBuff.',
    scaling: { targetCount: [3, 3, 4], damage: [75, 150, 300] },
  },
  spritePath: '/visuals/sprites/beachy/palossand-sprite.webp',
}

export const A_EXEGGUTOR: UnitDefinition = {
  id: 'a_exeggutor',
  name: 'Alolan Exeggutor',
  cost: 3,
  types: ['beachy','spellweaver'],
  role: 'special caster',
  baseStats: {
    hp: 700, startMana: 40, maxMana: 90,
    attack: 65, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'a_exeggutor_egg_bomb',
    name: 'Egg Bomb',
    description: 'Lob an egg at the nearest enemy dealing 600/800/1000 magic damage plus (10 + SpellBuff)% bonus true damage. The egg then bounces to a random nearby enemy (within 2 hexes) dealing 50% damage. Increment SpellBuff.',
    scaling: { damage: [600, 800, 1000] },
  },
  spritePath: '/visuals/sprites/beachy/a-exeggutor-sprite.webp',
}

export const BLASTOISE: UnitDefinition = {
  id: 'blastoise',
  name: 'Blastoise',
  cost: 4,
  types: ['beachy','quickclaw'],
  role: 'special marksman',
  baseStats: {
    hp: 800, startMana: 30, maxMana: 90,
    attack: 75, special: 100, defense: 40, spDefense: 40,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'blastoise_hydro_cannons',
    name: 'Hydro Cannon',
    description: 'For 5 seconds, gain 50/75/2000% attack speed. During this time, auto attacks trigger twice, each dealing 75%/150%/500% + % spell buff attack damage as magic damage.',
    scaling: { attackSpeedBonus: [50, 75, 2000], shotRatio: [75, 150, 500] },
  },
  spritePath: '/visuals/sprites/beachy/blastoise-sprite.webp',
  spriteScale: 0.80,
}

export const TAPU_FINI: UnitDefinition = {
  id: 'tapu_fini',
  name: 'Tapu Fini',
  cost: 5,
  types: ['wave_spirit','beachy','mystic'],
  role: 'tank',
  baseStats: {
    hp: 1300, startMana: 50, maxMana: 100,
    attack: 70, special: 100, defense: 75, spDefense: 80,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 2,
  },
  ability: {
    id: 'tapufini_natures_madness',
    name: 'Whirlpool',
    description: "Create a 10-second whirlpool under Fini's attack target first (then non-whirlpooled enemies), reducing armor and MR by 2/3/20% + SpellBuff% per second. Deals 100/150/5000 special damage per second and heals Tapu Fini for 75/75/200% of damage dealt. If the target reaches 0 armor AND 0 MR, spell damage increases by 33%. Misty Terrain: double-cast. Increment SpellBuff.",
    scaling: { damagePerSec: [100, 150, 5000], healPct: [75, 75, 200], reductionPct: [2, 3, 20] },
  },
  spritePath: '/visuals/sprites/beachy/tapu-fini-sprite.webp',
}


// ─── Volcanic ────────────────────────────────────────────────────────────────
// Graveler(1), Typhlosion(1), Torkoal(2), Gible(2), Armarouge(3), A-Marowak(4), Wheezing(4), Charizard(5)

export const GRAVELER: UnitDefinition = {
  id: 'graveler',
  name: 'Graveler',
  cost: 1,
  types: ['volcanic','bruiser'],
  role: 'tank',
  baseStats: {
    hp: 700, startMana: 9999, maxMana: 9999,
    attack: 40, special: 100, defense: 65, spDefense: 35,
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

export const TYPHLOSION: UnitDefinition = {
  id: 'typhlosion',
  name: 'Typhlosion',
  cost: 1,
  types: ['volcanic','spellweaver'],
  role: 'attack caster',
  baseStats: {
    hp: 450, startMana: 30, maxMana: 50,
    attack: 55, special: 100, defense: 30, spDefense: 30,
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
  types: ['volcanic', 'stalwart'],
  role: 'tank',
  baseStats: {
    hp: 850, startMana: 40, maxMana: 100,
    attack: 40, special: 100, defense: 70, spDefense: 55,
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

export const GIBLE: UnitDefinition = {
  id: 'gible',
  name: 'Gible',
  cost: 2,
  types: ['volcanic','cave_crawler', 'promoter'],
  role: 'attack caster',
  baseStats: {
    hp: 650, startMana: 0, maxMana: 70,
    attack: 50, special: 100, defense: 35, spDefense: 25,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'gible_bite',
    name: 'Bite',
    description: 'Leap to a random enemy within 4 hexes, spinning rapidly through the air. On landing, deal 300/400/550% attack damage and stun for 1.5/2/2.5 seconds.',
    scaling: { damage: [300, 400, 550], stunSeconds: [1.5, 2, 2.5] },
  },
  spritePath: '/visuals/sprites/volcano/gible-sprite.webp',
  spriteScale: 0.70,
}

export const ARMAROUGE: UnitDefinition = {
  id: 'armarouge',
  name: 'Armarouge',
  cost: 3,
  types: ['volcanic','quickclaw'],
  role: 'attack marksman',
  baseStats: {
    hp: 700, startMana: 30, maxMana: 80,
    attack: 50, special: 100, defense: 30, spDefense: 30,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'armarouge_armor_cannon',
    name: 'Armor Cannon',
    description: 'Fire a cannon blast in a line at the farthest enemy, dealing 250/300/350% attack damage to all enemies hit. Gain 7/10/15 attack per enemy hit permanently. For the next 3 seconds, gain 35/50/75% attack speed and all autos deal 15/25/33% bonus AoE damage in 1 hex.',
    scaling: { damage: [250, 300, 350], atkBonusPerHit: [7, 10, 15], atkSpdBonus: [35, 50, 75], aoePct: [15, 25, 33] },
  },
  spritePath: '/visuals/sprites/volcano/armarouge-sprite.webp',
  spriteScale: 0.90,
}

export const A_MAROWAK: UnitDefinition = {
  id: 'a_marowak',
  name: 'Alolan Marowak',
  cost: 4,
  types: ['volcanic','roughneck'],
  role: 'attack fighter',
  baseStats: {
    hp: 950, startMana: 40, maxMana: 80,
    attack: 70, special: 100, defense: 55, spDefense: 50,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'a_marowak_shadow_bone',
    name: 'Shadow Bone',
    description: 'Empower the next 3 attacks: the first two deal 300/450/700 bonus magic damage. The third chains through all touching enemies, dealing 450/600/850 bonus magic damage to each and healing Alolan Marowak for 50% of total damage dealt.',
    scaling: { firstTwoDamage: [300, 450, 700], thirdDamage: [450, 600, 850] },
  },
  spritePath: '/visuals/sprites/volcano/a-marowack-sprite.webp',
}

export const WHEEZING: UnitDefinition = {
  id: 'wheezing',
  name: 'Wheezing',
  cost: 4,
  types: ['volcanic', 'stalwart'],
  role: 'tank',
  baseStats: {
    hp: 1050, startMana: 30, maxMana: 80,
    attack: 55, special: 100, defense: 60, spDefense: 60,
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

export const CHARIZARD: UnitDefinition = {
  id: 'charizard',
  name: 'Charizard',
  cost: 5,
  types: ['volcanic','spellweaver'],
  role: 'special caster',
  baseStats: {
    hp: 1100, startMana: 50, maxMana: 80,
    attack: 80, special: 100, defense: 45, spDefense: 45,
    attackSpeed: 0.85, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'charizard_blast_burn',
    name: 'Blast Burn',
    description: 'First cast: Send out 3/4/10 fireballs that mark nearby enemies and deal 375/625/2500% attack damage. Second cast: Send out 1/1/10 powerful blasts that instantly kill the highest-HP marked enemies; remaining marks explode for 625/875/3750% attack damage.',
    scaling: { fireballCount: [3, 4, 10], fireballDamage: [375, 625, 2500], killCount: [1, 1, 10], detonateDamage: [625, 875, 3750] },
  },
  spritePath: '/visuals/sprites/volcano/charizard-sprite.webp',
}


// ─── Sky Striker ──────────────────────────────────────────────────────────────
// Pidgeotto(1), Wailord(2), Talonflame(3), Noivern(4), Rayquaza(5)

export const PIDGEOTTO: UnitDefinition = {
  id: 'pidgeotto',
  name: 'Pidgeotto',
  cost: 1,
  types: ['sky_striker','quickclaw'],
  role: 'attack marksman',
  baseStats: {
    hp: 650, startMana: 0, maxMana: 50,
    attack: 65, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'pidgeotto_dual_wingbeat',
    name: 'Wing Slap',
    description: 'The next auto strikes twice in quick succession, each hit dealing 120/150/250% of Attack as physical damage and applying on-hit effects.',
    scaling: { damagePercent: [120, 150, 250] },
  },
  spritePath: '/visuals/sprites/sky_strikers/pidgeotto-sprite.webp',
}

export const WAILORD: UnitDefinition = {
  id: 'wailord',
  name: 'Wailord',
  cost: 2,
  types: ['sky_striker', 'promoter'],
  role: 'tank',
  baseStats: {
    hp: 800, startMana: 0, maxMana: 40,
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

export const TALONFLAME: UnitDefinition = {
  id: 'talonflame',
  name: 'Talonflame',
  cost: 3,
  types: ['sky_striker','crashout'],
  role: 'attack caster',
  baseStats: {
    hp: 900, startMana: 20, maxMana: 60,
    attack: 70, special: 100, defense: 40, spDefense: 40,
    attackSpeed: 0.90, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'talonflame_brave_bird',
    name: 'Brave Bird',
    description: 'Lunge at the current target for 285/465/715% attack damage (+60% vs targets with higher max HP). On kill, instantly recast at 75% damage.',
    scaling: { damage: [350, 565, 715] },
  },
  spritePath: '/visuals/sprites/sky_strikers/talonflame-sprite.webp',
}

export const NOIVERN: UnitDefinition = {
  id: 'noivern',
  name: 'Noivern',
  cost: 4,
  types: ['sky_striker','keen_eye'],
  role: 'special caster',
  baseStats: {
    hp: 900, startMana: 40, maxMana: 90,
    attack: 65, special: 100, defense: 45, spDefense: 55,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 2,
  },
  ability: {
    id: 'noivern_boomburst',
    name: 'Boomburst',
    description: 'Let out a massive screech, hitting all enemies within 3 rows for 500/700/2000 special damage.',
    scaling: { damage: [500, 700, 2000] },
  },
  spritePath: '/visuals/sprites/sky_strikers/noivern-sprite.webp',
}

export const RAYQUAZA: UnitDefinition = {
  id: 'rayquaza',
  name: 'Rayquaza',
  cost: 5,
  types: ['sky_striker','corkscrew'],
  role: 'attack fighter',
  baseStats: {
    hp: 1400, startMana: 70, maxMana: 100,
    attack: 110, special: 100, defense: 70, spDefense: 70,
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


// ─── Cave Crawler ────────────────────────────────────────────────────────────
// Zubat(1), Druddigon(1), Sableye(2), Ferrothorn(2), Excadrill(3)

export const ZUBAT: UnitDefinition = {
  id: 'zubat',
  name: 'Zubat',
  cost: 1,
  types: ['cave_crawler','spellweaver'],
  role: 'special caster',
  baseStats: {
    hp: 450, startMana: 0, maxMana: 30,
    attack: 30, special: 100, defense: 15, spDefense: 20,
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

export const DRUDDIGON: UnitDefinition = {
  id: 'druddigon',
  name: 'Druddigon',
  cost: 1,
  types: ['cave_crawler','roughneck'],
  role: 'attack caster',
  baseStats: {
    hp: 550, startMana: 50, maxMana: 100,
    attack: 55, special: 100, defense: 30, spDefense: 40,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'druddigon_dragon_tail',
    name: 'Dragon Tail',
    description: 'Strike with a powerful tail swipe, dealing 450/550/650% attack damage. If the blow kills the target, they are briefly stunned then knocked back 2 hexes and die on landing. Enemies they collide with take 30% of the strike damage.',
    scaling: { damage: [450, 550, 650] },
  },
  spritePath: '/visuals/sprites/cave_crawlers/druddigon-sprite.png',
}

export const SABLEYE: UnitDefinition = {
  id: 'sableye',
  name: 'Sableye',
  cost: 2,
  types: ['cave_crawler','keen_eye'],
  role: 'special caster',
  baseStats: {
    hp: 600, startMana: 0, maxMana: 60,
    attack: 45, special: 100, defense: 30, spDefense: 30,
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

export const FERROTHORN: UnitDefinition = {
  id: 'ferrothorn',
  name: 'Ferrothorn',
  cost: 2,
  types: ['cave_crawler','substitutor'],
  role: 'tank',
  baseStats: {
    hp: 850, startMana: 30, maxMana: 90,
    attack: 45, special: 100, defense: 65, spDefense: 50,
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

export const EXCADRILL: UnitDefinition = {
  id: 'excadrill',
  name: 'Excadrill',
  cost: 3,
  types: ['cave_crawler','corkscrew'],
  role: 'attack fighter',
  baseStats: {
    hp: 900, startMana: 50, maxMana: 100,
    attack: 65, special: 100, defense: 45, spDefense: 35,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'excadrill_drill_run',
    name: 'Drill Run',
    description: 'Tunnel to the furthest enemy within 3 hexes (invulnerable during dash), knocking them up for 0.5s and dealing 385/575/770% attack damage. The next 3 attacks also hit adjacent enemies for 170/250/460% attack as bonus damage.',
    scaling: { damage: [385, 575, 770], bonusDamage: [170, 250, 460] },
  },
  spritePath: '/visuals/sprites/cave_crawlers/excadrill-sprite.webp',
}


// ─── River ────────────────────────────────────────────────────────────────────
// Drednaw(2), Bellibolt(3), Quagsire(4), Barraskewda(4)

export const DREDNAW: UnitDefinition = {
  id: 'drednaw',
  name: 'Drednaw',
  cost: 2,
  types: ['river','crashout'],
  role: 'attack fighter',
  baseStats: {
    hp: 600, startMana: 40, maxMana: 90,
    attack: 50, special: 100, defense: 65, spDefense: 50,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'drednaw_razor_shell',
    name: 'Razor Shell',
    description: 'For the next 5 seconds, gain 20/30/50 attack and Drednaw\'s attacks become sweeping slashes, dealing 170/245/360% attack as bonus damage and ignoring 30% armor.',
    scaling: { atkBonus: [20, 30, 50], bonusDamagePct: [170, 245, 360] },
  },
  spritePath: '/visuals/sprites/river/drednaw-sprite.webp',
}

export const BELLIBOLT: UnitDefinition = {
  id: 'bellibolt',
  name: 'Bellibolt',
  cost: 3,
  types: ['river', 'stalwart'],
  role: 'tank',
  baseStats: {
    hp: 900, startMana: 0, maxMana: 80,
    attack: 50, special: 100, defense: 50, spDefense: 50,
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

export const QUAGSIRE: UnitDefinition = {
  id: 'quagsire',
  name: 'Quagsire',
  cost: 4,
  types: ['river', 'promoter'],
  role: 'tank',
  baseStats: {
    hp: 1100, startMana: 50, maxMana: 100,
    attack: 60, special: 100, defense: 60, spDefense: 55,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'quagsire_unaware',
    name: 'Unaware',
    description: 'Gain a 150/200/400 shield per enemy within 2 hexes and taunt all enemies within 1 hex for 4 seconds. When the shield expires or breaks, deal 200/350/600 magic damage and chill (-30% attack speed) all enemies within 1 hex.',
    scaling: { shieldPerEnemy: [150, 200, 400], aoeDamage: [200, 350, 600] },
  },
  spritePath: '/visuals/sprites/river/quagsire-sprite.webp',
}

export const BARRASKEWDA: UnitDefinition = {
  id: 'barraskewda',
  name: 'Barraskewda',
  cost: 4,
  types: ['river','corkscrew'],
  role: 'attack caster',
  baseStats: {
    hp: 1000, startMana: 20, maxMana: 50,
    attack: 70, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.90, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'barraskewda_fishous_rend',
    name: 'Fishous Rend',
    description: 'Dash to the lowest-HP enemy within 2 hexes, striking for 570/860/1285% attack damage (×1.5 if target is below half health). Each subsequent cast costs 10 less mana (minimum 20).',
    scaling: { damage: [570, 860, 1285] },
  },
  spritePath: '/visuals/sprites/river/barraskewda-sprite.webp',
}


// ─── Temporal Woods ───────────────────────────────────────────────────────────
// Morgrem(1), Morelull(1), Oranguru(2), Celebi(3), Fezandipiti(4), Tapu Lele(5)

export const MORGREM: UnitDefinition = {
  id: 'morgrem',
  name: 'Morgrem',
  cost: 1,
  types: ['temporal_woods','substitutor'],
  role: 'tank',
  baseStats: {
    hp: 500, startMana: 20, maxMana: 70,
    attack: 35, special: 100, defense: 30, spDefense: 30,
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

export const MORELULL: UnitDefinition = {
  id: 'morelull',
  name: 'Morelull',
  cost: 1,
  types: ['temporal_woods','promoter'],
  role: 'special caster',
  baseStats: {
    hp: 500, startMana: 30, maxMana: 70,
    attack: 25, special: 100, defense: 20, spDefense: 30,
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

export const ORANGURU: UnitDefinition = {
  id: 'oranguru',
  name: 'Oranguru',
  cost: 2,
  types: ['temporal_woods','mystic'],
  role: 'special marksman',
  baseStats: {
    hp: 750, startMana: 60, maxMana: 110,
    attack: 50, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'oranguru_stored_power',
    name: 'Stored Power',
    description: 'For the rest of combat, replace auto attacks with psychic waves dealing 80/100/120% special damage. Every 3rd wave is empowered: deals 100/175/300 bonus special damage, permanently grants 1/2/5 special, and grants 20/25/30% attack speed for 2 seconds (scales with special).',
    scaling: { specialPct: [80, 100, 120], empBonus: [100, 175, 300], spGain: [1, 2, 5], atkSpdPct: [20, 25, 30] },
  },
  spritePath: '/visuals/sprites/temporal_woods/Oranguru-sprite.webp',
}

export const CELEBI: UnitDefinition = {
  id: 'celebi',
  name: 'Celebi',
  cost: 3,
  types: ['temporal_woods','mystic'],
  role: 'special caster',
  baseStats: {
    hp: 750, startMana: 40, maxMana: 60,
    attack: 70, special: 100, defense: 40, spDefense: 40,
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

export const FEZANDIPITI: UnitDefinition = {
  id: 'fezandipiti',
  name: 'Fezandipiti',
  cost: 4,
  types: ['temporal_woods','promoter', 'keen_eye'],
  role: 'tank',
  baseStats: {
    hp: 1000, startMana: 50, maxMana: 100,
    attack: 60, special: 100, defense: 55, spDefense: 60,
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

export const TAPU_LELE: UnitDefinition = {
  id: 'tapu_lele',
  name: 'Tapu Lele',
  cost: 5,
  types: ['mind_spirit','temporal_woods','keen_eye'],
  role: 'special caster',
  baseStats: {
    hp: 1200, startMana: 60, maxMana: 120,
    attack: 70, special: 100, defense: 55, spDefense: 70,
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


// ─── Ruiner ───────────────────────────────────────────────────────────────────
// Unown(1), Stonjourner(2), Absol(2), Xatu(2), Claydol(3), Spiritomb(4), Runerigus(5)

export const UNOWN: UnitDefinition = {
  id: 'unown',
  name: 'Unown',
  cost: 1,
  types: ['ruiner','keen_eye'],
  role: 'special caster',
  baseStats: {
    hp: 500, startMana: 30, maxMana: 50,
    attack: 35, special: 100, defense: 20, spDefense: 25,
    attackSpeed: 0.65, critChance: 0.10, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'unown_hidden_power',
    name: 'Hidden Power',
    description: 'Randomly fires one of three Hidden Powers at the nearest enemy: Ice (stuns for 1s), Fire (+50% damage), or Electric (50% splash to adjacent enemies). Deals 300/450/700 magic damage.',
    scaling: { damage: [300, 450, 700] },
  },
  spritePath: '/visuals/sprites/ruiner/unown-sprite.webp',
}

export const STONJOURNER: UnitDefinition = {
  id: 'stonjourner',
  name: 'Stonjourner',
  cost: 2,
  types: ['ruiner','bruiser'],
  role: 'tank',
  baseStats: {
    hp: 900, startMana: 30, maxMana: 80,
    attack: 55, special: 100, defense: 60, spDefense: 30,
    attackSpeed: 0.55, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'stonjourner_power_spot',
    name: 'Power Spot',
    description: 'Restore 250/350/450 HP. Draw power from the nearest ally, gaining 33% of their armor and sp. def as a flat bonus for 5 seconds.',
    scaling: { healAmount: [250, 350, 450], borrowPercent: [0.33, 0.33, 0.33] },
  },
  spritePath: '/visuals/sprites/ruiner/Stonjourner-sprite.webp',
}

export const ABSOL: UnitDefinition = {
  id: 'absol',
  name: 'Absol',
  cost: 2,
  types: ['ruiner','roughneck'],
  role: 'attack caster',
  baseStats: {
    hp: 850, startMana: 30, maxMana: 80,
    attack: 65, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.80, critChance: 0.35, critDamage: 1.60, range: 1,
  },
  ability: {
    id: 'absol_night_slash',
    name: 'Night Slash',
    description: 'Dash 1 hex toward the largest enemy cluster and slash all enemies in a 1-hex radius for 100/150/250 physical damage. Heal Absol for 50/75/100 HP for each enemy hit.',
    scaling: { damage: [100, 150, 250], healPerHit: [50, 75, 100] },
  },
  spritePath: '/visuals/sprites/ruiner/Absol-sprite.webp',
}

export const XATU: UnitDefinition = {
  id: 'xatu',
  name: 'Xatu',
  cost: 2,
  types: ['ruiner','substitutor', 'spellweaver'],
  role: 'tank',
  baseStats: {
    hp: 750, startMana: 50, maxMana: 100,
    attack: 45, special: 100, defense: 55, spDefense: 65,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'xatu_magic_bounce',
    name: 'Magic Bounce',
    description: 'Gain a 400/475/600 HP shield for 3 seconds. Store all damage the shield absorbs. When the shield breaks or expires, Xatu\'s next attack deals 90/120/150% of the stored damage as magic damage.',
    scaling: { shield: [400, 475, 600], scalingRatio: [90, 120, 150] },
  },
  spritePath: '/visuals/sprites/ruiner/Xatu-sprite.png',
}

export const CLAYDOL: UnitDefinition = {
  id: 'claydol',
  name: 'Claydol',
  cost: 3,
  types: ['ruiner','keen_eye'],
  role: 'special caster',
  baseStats: {
    hp: 750, startMana: 60, maxMana: 120,
    attack: 55, special: 100, defense: 40, spDefense: 40,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 3,
  },
  ability: {
    id: 'claydol_gravity',
    name: 'Gravity',
    description: 'Lift the 2 nearest enemies airborne for 1.5 seconds, then slam them down dealing 400/600/1000 + 5/8/10% of their max HP as special damage.',
    scaling: { damage: [400, 600, 1000], maxHpPct: [5, 8, 10] },
  },
  spritePath: '/visuals/sprites/ruiner/Claydol-sprite.png',
}

export const SPIRITOMB: UnitDefinition = {
  id: 'spiritomb',
  name: 'Spiritomb',
  cost: 4,
  types: ['ruiner','mystic'],
  role: 'special caster',
  baseStats: {
    hp: 1100, startMana: 100, maxMana: 100,
    attack: 55, special: 100, defense: 65, spDefense: 65,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'spiritomb_destiny_bond',
    name: 'Destiny Bond',
    description: 'Passive: Every second, deal 75/100/500 special damage to enemies within 1 Hex and restore 20/40/100 HP for each enemy hit. On cast: mark one enemy outside the 1-hex radius — it takes the same damage and heals Spiritomb as if it were in the aura.',
    scaling: { damage: [75, 100, 500], healPerHit: [20, 40, 100] },
  },
  spritePath: '/visuals/sprites/ruiner/Spiritomb-sprite.webp',
}

export const RUNERIGUS: UnitDefinition = {
  id: 'runerigus',
  name: 'Runerigus',
  cost: 5,
  types: ['ruiner', 'promoter'],
  role: 'special caster',
  baseStats: {
    hp: 950, startMana: 20, maxMana: 40,
    attack: 55, special: 100, defense: 60, spDefense: 55,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'runerigus_wandering_spirit',
    name: 'Wandering Spirit',
    description: 'Reach out with ghostly hands and pass along Wandering Spirit to the nearest unmarked enemy, rendering it unable to cast its ability. When the marked unit would next cast, it instead takes 550/875/7000 special damage and the mark is consumed.',
    scaling: { silenceDamage: [550, 875, 7000] },
  },
  spritePath: '/visuals/sprites/ruiner/Runerigus-sprite.webp',
}


// ─── Ascender ─────────────────────────────────────────────────────────────────
// Klawf(1), Gogoat(2), Sneasler(3), Aerodactyl(4), Tapu Koko(5)

export const KLAWF: UnitDefinition = {
  id: 'klawf',
  name: 'Klawf',
  cost: 1,
  types: ['ascender','quickclaw'],
  role: 'attack marksman',
  baseStats: {
    hp: 650, startMana: 30, maxMana: 80,
    attack: 55, special: 100, defense: 45, spDefense: 50,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'klawf_anger_shell',
    name: 'Anger Shell',
    description: 'Gain +50/75/100% bonus attack speed and +50% crit chance for 4 seconds.',
    scaling: { atkSpdBonus: [0.50, 0.75, 1.00], critBonus: [0.50, 0.50, 0.50] },
  },
  spritePath: '/visuals/sprites/ascenders/klawf-sprite.webp',
}

export const GOGOAT: UnitDefinition = {
  id: 'gogoat',
  name: 'Gogoat',
  cost: 2,
  types: ['ascender','bruiser'],
  role: 'tank',
  baseStats: {
    hp: 700, startMana: 40, maxMana: 90,
    attack: 55, special: 100, defense: 65, spDefense: 50,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'gogoat_grass_pelt',
    name: 'Grass Pelt',
    description: 'Empower the next 3 attacks: each deals 50/80/120 bonus physical damage and heals Gogoat for 105/145/200 HP.',
    scaling: { atkBonus: [50, 80, 120], selfHeal: [105, 145, 200] },
  },
  spritePath: '/visuals/sprites/ascenders/Gogoat-sprite.webp',
}

export const SNEASLER: UnitDefinition = {
  id: 'sneasler',
  name: 'Sneasler',
  cost: 3,
  types: ['ascender', 'roughneck'],
  role: 'attack caster',
  baseStats: {
    hp: 750, startMana: 20, maxMana: 30,
    attack: 70, special: 100, defense: 40, spDefense: 40,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'sneasler_dire_claw',
    name: 'Dire Claw',
    description: 'Swipe enemies in an arc, dealing 285/465/750% attack damage and poisoning them for 20/50/75 magic damage per second over 4 seconds. If the target is already poisoned, the swipe critically strikes.',
    scaling: { damage: [285, 465, 750], poisonPerSec: [20, 50, 75] },
  },
  spritePath: '/visuals/sprites/ascenders/Sneasler-sprite.webp',
}

export const AERODACTYL: UnitDefinition = {
  id: 'aerodactyl',
  name: 'Aerodactyl',
  cost: 4,
  types: ['ascender','crashout'],
  role: 'attack marksman',
  baseStats: {
    hp: 800, startMana: 0, maxMana: 80,
    attack: 90, special: 100, defense: 55, spDefense: 55,
    attackSpeed: 0.90, critChance: 0.35, critDamage: 1.50, range: 1,
  },
  ability: {
    id: 'aerodactyl_ancient_power',
    name: 'Ancient Power',
    description: 'Boost attack, special, attack speed, defense, spDef, and move speed by 30/45/80% for the rest of combat. Gain +1 range and 25% omnivamp. Each attack also launches a rock from the target to the furthest enemy, dealing 30/40/100% attack damage.',
    scaling: { statBonus: [0.30, 0.45, 0.80], rockDamagePct: [0.50, 0.75, 3] },
  },
  spritePath: '/visuals/sprites/ascenders/Aerodactyl-sprite.webp',
}

export const SALAMENCE: UnitDefinition = {
  id: 'salamence',
  name: 'Salamence',
  cost: 5,
  types: ['rogue','bruiser'],
  role: 'attack fighter',
  baseStats: {
    hp: 1100, startMana: 20, maxMana: 60,
    attack: 95, special: 100, defense: 70, spDefense: 55,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'salamence_outrage',
    name: 'Outrage',
    description: 'Become Enraged for the rest of combat: take 50% reduced damage from every enemy except the current attack target, become immune to attack reduction, and gain no more mana. Attacks become Outrage — each auto grants 5/7/50% Attack and Attack Speed until he dies.',
    scaling: { rampPct: [5, 7, 50], damageReductionPct: [50, 50, 50] },
  },
  spritePath: '/visuals/sprites/misc/salamence_sprite.png',
}

export const DARMANITAN: UnitDefinition = {
  id: 'darmanitan',
  name: 'Darmanitan',
  cost: 5,
  types: ['zen', 'crashout'],
  role: 'attack fighter',
  baseStats: {
    // maxMana 80: Zen's "20 reduced mana" is baked into his base pool per the
    // design note ("make it so he starts with 80 base mana") rather than applied
    // dynamically on transform.
    hp: 1300, startMana: 0, maxMana: 80,
    attack: 120, special: 100, defense: 50, spDefense: 45,
    attackSpeed: 0.80, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'darmanitan_flair_blitz',
    name: 'Flair Blitz',
    description: 'Blitz into the current target and the two closest units within 2 hexes (at 3★, every enemy on the board), dealing 500/700/1000% Attack to each, then return home. The first Flair Blitz after entering Zen deals 50% more damage.',
    scaling: { damagePct: [500, 700, 1000] },
  },
  spritePath: '/visuals/sprites/misc/darmanitan_sprite.webp',
}

export const LATIOS: UnitDefinition = {
  id: 'latios',
  name: 'Latios',
  cost: 5,
  types: ['soul_bonded','mystic'],
  role: 'special caster',
  baseStats: {
    hp: 1250, startMana: 20, maxMana: 60,
    attack: 70, special: 100, defense: 55, spDefense: 70,
    attackSpeed: 0.75, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'latios_luster_purge',
    name: 'Luster Purge',
    description: 'Briefly channel a charged orb, then hurl it at the largest group of enemies. Enemies within a 3-hex radius take 250/600/3000 special damage and have their Sp. Defense halved for 3 seconds.',
    scaling: { damage: [250, 600, 3000], spDefShredPct: [50, 50, 50], shredSeconds: [3, 3, 3] },
  },
  spritePath: '/visuals/sprites/misc/latios_sprite.webp',
}

export const LATIAS: UnitDefinition = {
  id: 'latias',
  name: 'Latias',
  cost: 5,
  types: ['soul_bonded','stalwart'],
  role: 'tank',
  baseStats: {
    hp: 1500, startMana: 30, maxMana: 90,
    attack: 70, special: 100, defense: 75, spDefense: 85,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'latias_mist_ball',
    name: 'Mist Ball',
    description: 'Channel a charged orb, healing 300/400/2000 over the channel, then hurl it at the largest group of enemies. Enemies within a 2-hex radius take 150/250/1000 special damage and have their Sp. Attack halved for 3 seconds.',
    scaling: { damage: [150, 250, 1000], healOverChannel: [300, 400, 2000], spAtkShredPct: [50, 50, 50] },
  },
  spritePath: '/visuals/sprites/misc/latias_sprite.webp',
}

export const TAPU_KOKO: UnitDefinition = {
  id: 'tapu_koko',
  name: 'Tapu Koko',
  cost: 5,
  types: ['shock_spirit','quickclaw'],
  role: 'attack marksman',
  baseStats: {
    hp: 1200, startMana: 0, maxMana: 80,
    attack: 85, special: 100, defense: 55, spDefense: 55,
    attackSpeed: 0.85, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'tapukoko_natures_madness',
    name: "Nature's Madness",
    description: "Passive: every 3rd attack chains lightning to the 3 nearest enemies for bonus magic damage. On cast: Tapu Koko's next auto and its chain lightning stun and deal 250/300/2000% attack as additional damage. Electric Terrain: gain 3/5/20% attack speed per auto after casting.",
    scaling: { surgeBonusPct: [250, 300, 2000], asPerAuto: [3, 5, 20], chainPct: [70, 85, 200] },
  },
  spritePath: '/visuals/sprites/misc/tapu_koko_sprite.webp',
}


// ─── Froststone ───────────────────────────────────────────────────────────────
// Snorunt(1), Froslass(2), Weavile(2), H-Avalugg(3), Abomasnow(4), Mamoswine(4)

export const SNORUNT: UnitDefinition = {
  id: 'snorunt',
  name: 'Snorunt',
  cost: 1,
  types: ['froststone','stalwart'],
  role: 'tank',
  baseStats: {
    hp: 750, startMana: 20, maxMana: 60,
    attack: 30, special: 100, defense: 50, spDefense: 55,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'snorunt_ice_body',
    name: 'Ice Body',
    description: 'Gain a 150/200/300 shield for 3 seconds. Enemies who attack the shield are chilled.',
    scaling: { shieldAmount: [150, 200, 300] },
  },
  spritePath: '/visuals/sprites/froststone/Snorunt-sprite.webp',
}

export const FROSLASS: UnitDefinition = {
  id: 'froslass',
  name: 'Froslass',
  cost: 2,
  types: ['froststone','keen_eye'],
  role: 'special caster',
  baseStats: {
    hp: 750, startMana: 40, maxMana: 90,
    attack: 50, special: 100, defense: 35, spDefense: 50,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'froslass_icy_wind',
    name: 'Icy Wind',
    description: 'Send 3 cold winds in a line dealing 100/200/400 magic damage to the first enemy hit, with 25% less damage per subsequent enemy. All hit enemies are chilled (-25% attack speed) for 2 seconds.',
    scaling: { baseDamage: [100, 200, 400] },
  },
  spritePath: '/visuals/sprites/froststone/Froslass-sprite.webp',
}

export const WEAVILE: UnitDefinition = {
  id: 'weavile',
  name: 'Weavile',
  cost: 2,
  types: ['froststone','corkscrew'],
  role: 'attack marksman',
  baseStats: {
    hp: 750, startMana: 40, maxMana: 70,
    attack: 75, special: 100, defense: 35, spDefense: 35,
    attackSpeed: 0.85, critChance: 0.35, critDamage: 1.60, range: 1,
  },
  ability: {
    id: 'weavile_triple_axel',
    name: 'Triple Axel',
    description: 'Empower the next 3 attacks with distinct effects: (1) 135/200/335% attack as bonus physical damage; (2) spin AoE hitting all enemies within 1 hex of Weavile for 150/200/275 magic damage; (3) 10/10/15% max HP true damage + knock up for 1 second.',
    scaling: { firstDmg: [135, 200, 335], spinDmg: [150, 200, 300], hpPercent: [0.10, 0.10, 0.15] },
  },
  spritePath: '/visuals/sprites/froststone/Weavile-sprite.webp',
}

export const H_AVALUGG: UnitDefinition = {
  id: 'h_avalugg',
  name: 'Hisuian Avalugg',
  cost: 3,
  types: ['froststone','bruiser'],
  role: 'tank',
  baseStats: {
    hp: 1200, startMana: 40, maxMana: 90,
    attack: 70, special: 100, defense: 80, spDefense: 40,
    attackSpeed: 0.55, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'h_avalugg_mountain_gale',
    name: 'Icicle Crash',
    description: 'Drop icicles on the 3 nearest enemies, dealing 120/175/285% attack damage each and knocking them up for 1.5/2/3 seconds.',
    scaling: { damage: [120, 175, 285], knockUpSeconds: [1.5, 2, 3] },
  },
  spritePath: '/visuals/sprites/froststone/h-Avalugg-sprite.png',
}

export const ABOMASNOW: UnitDefinition = {
  id: 'abomasnow',
  name: 'Abomasnow',
  cost: 4,
  types: ['froststone','mystic'],
  role: 'special caster',
  baseStats: {
    hp: 1100, startMana: 40, maxMana: 90,
    attack: 65, special: 100, defense: 55, spDefense: 55,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 4,
  },
  ability: {
    id: 'abomasnow_blizzard',
    name: 'Blizzard',
    description: 'Target the largest group of enemies in a 1-hex radius with a blizzard, dealing 300/500/1000 damage on cast, causing enemies in the blizzard to take 50/75/200 magic damage every 0.5 seconds for 4 seconds. Enemies hit have their MR shredded by 30 for 3 seconds.',
    scaling: { castDmg: [300, 500, 1000], tickDmg: [50, 75, 500] },
  },
  spritePath: '/visuals/sprites/froststone/Abomasnow-sprite.webp',
}

export const MAMOSWINE: UnitDefinition = {
  id: 'mamoswine',
  name: 'Mamoswine',
  cost: 4,
  types: ['froststone','substitutor','stalwart'],
  role: 'tank',
  baseStats: {
    hp: 1150, startMana: 40, maxMana: 90,
    attack: 75, special: 100, defense: 70, spDefense: 70,
    attackSpeed: 0.70, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'mamoswine_thick_fat',
    name: 'Ice Rider',
    description: 'Gain 40/60/100 armor and MR for 5 seconds. During this time, become a passive attack handler - each auto deals your defense + MR as bonus special damage.',
    scaling: { armorMr: [40, 60, 100] },
  },
  spritePath: '/visuals/sprites/froststone/Mamoswine-sprite.webp',
}


// ─── Summons ──────────────────────────────────────────────────────────────────

export const GOLETT: UnitDefinition = {
  id: 'golett',
  name: 'Golett',
  cost: 0,
  types: ['Golem'],
  role: 'attack fighter',
  baseStats: {
    hp: 600, startMana: 50, maxMana: 100,
    attack: 50, special: 100, defense: 40, spDefense: 45,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'golett_shadow_punch',
    name: 'Shadow Punch',
    description: 'Passive: Each auto deals +30% special as bonus special damage. Active: Gains a 200/250/325 shield and empowers the next auto to deal 400/500/700% attack as bonus physical damage. 2 seconds later, a shadow punch materializes and deals 100/150/200 magic to the same target.',
    scaling: { shield: [200, 250, 325], empoweredDamagePct: [400, 500, 700], followUpDamage: [100, 150, 200] },
  },
  spritePath: '/visuals/sprites/ruiner/golett-sprite.webp',
}

export const GOLURK: UnitDefinition = {
  id: 'golurk',
  name: 'Golurk',
  cost: 0,
  types: ['Golem'],
  role: 'attack fighter',
  baseStats: {
    hp: 800, startMana: 50, maxMana: 100,
    attack: 70, special: 100, defense: 55, spDefense: 65,
    attackSpeed: 0.65, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'golurk_poltergeist',
    name: 'Poltergeist',
    description: 'Passive: Each auto deals +40% special as bonus special damage. Active: Gains a 225/300/375 shield and empowers the next auto to deal 320/430/535% attack as bonus physical damage in a 1-hex AoE, knocking up all hit. 2 seconds later, a shadow punch deals 125/175/250 magic to the same AoE targets.',
    scaling: { shield: [225, 300, 375], empoweredDamagePct: [320, 430, 535], followUpDamage: [125, 175, 250] },
  },
  spritePath: '/visuals/sprites/ruiner/golurk-sprite.webp',
}

export const MEGA_GOLURK: UnitDefinition = {
  id: 'mega_golurk',
  name: 'Mega Golurk',
  cost: 0,
  types: ['Golem'],
  role: 'attack fighter',
  baseStats: {
    hp: 1000, startMana: 50, maxMana: 100,
    attack: 110, special: 100, defense: 70, spDefense: 85,
    attackSpeed: 0.60, critChance: 0.25, critDamage: 1.40, range: 1,
  },
  ability: {
    id: 'mega_golurk_phantom_force',
    name: 'Phantom Force',
    description: 'Passive: Each auto deals +55% special as bonus special. Active: Gains a 300/400/550 shield and empowers the next auto to deal 275/365/500% attack as bonus physical damage to ALL enemies, knocking up all hit. 2 seconds later, a shadow punch deals 175/275/450 magic to all enemies.',
    scaling: { shield: [300, 400, 550], empoweredDamagePct: [275, 365, 500], followUpDamage: [175, 275, 450] },
  },
  spritePath: '/visuals/sprites/ruiner/mega-golurk-sprite.png',
}


// ─── Ascender cliffs ──────────────────────────────────────────────────────────

export const CLIFF_L: UnitDefinition = {
  id: 'cliff_l',
  name: 'Cliff',
  cost: 0,
  types: [],
  isDummy: true,
  baseStats: {
    hp: 400, startMana: 0, maxMana: 0,
    attack: 0, special: 100, defense: 20, spDefense: 20,
    attackSpeed: 0, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '/visuals/trait icons/cliff-l.png',
}

export const CLIFF_R: UnitDefinition = {
  id: 'cliff_r',
  name: 'Cliff',
  cost: 0,
  types: [],
  isDummy: true,
  baseStats: {
    hp: 400, startMana: 0, maxMana: 0,
    attack: 0, special: 100, defense: 20, spDefense: 20,
    attackSpeed: 0, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '/visuals/trait icons/cliff-r.png',
}

// ─── Testing ──────────────────────────────────────────────────────────────────

export const DUMMY: UnitDefinition = {
  id: 'dummy',
  name: 'Dummy',
  cost: 0,
  types: [],
  isDummy: true,
  baseStats: {
    hp: 1500, startMana: 0, maxMana: 9999,
    attack: 0, special: 100, defense: 30, spDefense: 30,
    attackSpeed: 0.5, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '/visuals/sprites/substitute.webp',
  spriteScale: 0.6,
}

export const DUMMY_MELEE: UnitDefinition = {
  id: 'dummy_melee',
  name: 'Attacker (Melee)',
  cost: 0,
  types: [],
  baseStats: {
    hp: 400, startMana: 0, maxMana: 9999,
    attack: 55, special: 100, defense: 30, spDefense: 30,
    attackSpeed: 0.9, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '/visuals/sprites/substitute.webp',
  spriteScale: 0.6,
}

export const DUMMY_RANGED: UnitDefinition = {
  id: 'dummy_ranged',
  name: 'Attacker (Ranged)',
  cost: 0,
  types: [],
  baseStats: {
    hp: 400, startMana: 0, maxMana: 9999,
    attack: 45, special: 100, defense: 30, spDefense: 30,
    attackSpeed: 0.9, critChance: 0, critDamage: 1.0, range: 4,
  },
  spritePath: '/visuals/sprites/substitute.webp',
  spriteScale: 0.6,
}

// ─── Creeps (PvE rounds) ──────────────────────────────────────────────────────
// Neutral monsters fought in the opening rounds (see src/econ/creeps.ts). cost 0
// keeps them out of the shop/pool; no `ability` means auto-attacks only. Tuned
// deliberately weak so early boards clear them for free.

export const CREEP_DIGLETT: UnitDefinition = {
  id: 'creep_diglett',
  name: 'Diglett',
  cost: 0,
  types: [],
  baseStats: {
    hp: 150, startMana: 0, maxMana: 0,
    attack: 20, special: 100, defense: 10, spDefense: 10,
    attackSpeed: 0.55, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '/visuals/sprites/misc/a-diglett.webp',
  spriteScale: 1.5,   // 0.6 base ×2.5
}

export const CREEP_SLOWBRO: UnitDefinition = {
  id: 'creep_slowbro',
  name: 'Slowbro',
  cost: 0,
  types: [],
  baseStats: {
    hp: 550, startMana: 0, maxMana: 0,
    attack: 12, special: 100, defense: 45, spDefense: 45,
    attackSpeed: 0.45, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '/visuals/sprites/misc/slowbro_sprite.webp',
  spriteScale: 1.225,   // 0.7 base +75%
}

export const CREEP_G_SLOWBRO: UnitDefinition = {
  id: 'creep_g_slowbro',
  name: 'Galarian Slowbro',
  cost: 0,
  types: [],
  baseStats: {
    hp: 220, startMana: 0, maxMana: 0,
    attack: 18, special: 100, defense: 15, spDefense: 15,
    attackSpeed: 0.60, critChance: 0, critDamage: 1.0, range: 3,
  },
  spritePath: '/visuals/sprites/misc/g_slowbro_sprite.webp',
  spriteScale: 1.225,   // 0.7 base +75%
}

export const SUBSTITUTOR_SUB: UnitDefinition = {
  id: 'substitutor_sub',
  name: 'Substitute',
  cost: 0,
  types: ['substitutor_sub'],
  isDummy: true,
  baseStats: {
    hp: 1500, startMana: 0, maxMana: 0,
    attack: 0, special: 100, defense: 0, spDefense: 0,
    attackSpeed: 0, critChance: 0, critDamage: 1.0, range: 1,
  },
  spritePath: '/visuals/sprites/substitute.webp',
  spriteScale: 0.6,
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ALL_UNITS: UnitDefinition[] = [
  // Jungle (3/5/7): Tangela(1), Ribombee(1), Venusaur(2), Vigoroth(3), Vikavolt(3), Toucannon(4), Tropius(4), Tapu Bulu(5)
  TANGELA, RIBOMBEE,
  VENUSAUR,
  VIGOROTH, VIKAVOLT,
  TOUCANNON, TROPIUS,
  TAPU_BULU,
  // Beachy (2/4/6): Kingler(1), A-Raichu(2), Palossand(3), A-Exeggutor(3), Blastoise(4), Tapu Fini(5)
  KINGLER,
  A_RAICHU,
  PALOSSAND, A_EXEGGUTOR,
  BLASTOISE,
  TAPU_FINI,
  // Volcanic (3/5/7): Graveler(1), Typhlosion(1), Torkoal(2), Gible(2), Armarouge(3), A-Marowak(4), Wheezing(4), Charizard(5)
  GRAVELER, TYPHLOSION,
  TORKOAL, GIBLE,
  ARMAROUGE,
  A_MAROWAK, WHEEZING,
  CHARIZARD,
  // Sky Striker (2/4/6): Pidgeotto(1), Wailord(2), Talonflame(3), Noivern(4), Rayquaza(5)
  PIDGEOTTO,
  WAILORD,
  TALONFLAME,
  NOIVERN,
  RAYQUAZA,
  // Cave Crawler (3/5): Zubat(1), Druddigon(1), Sableye(2), Ferrothorn(2), Excadrill(3)
  ZUBAT, DRUDDIGON,
  SABLEYE, FERROTHORN,
  EXCADRILL,
  // River (2/3/4): Drednaw(2), Bellibolt(3), Quagsire(4), Barraskewda(4)
  DREDNAW,
  BELLIBOLT,
  QUAGSIRE, BARRASKEWDA,
  // Temporal Woods (2/4/6): Morgrem(1), Morelull(1), Oranguru(2), Celebi(3), Fezandipiti(4), Tapu Lele(5)
  MORGREM, MORELULL,
  ORANGURU,
  CELEBI,
  FEZANDIPITI,
  TAPU_LELE,
  // Ruiner (3/5/7): Unown(1), Stonjourner(2), Absol(2), Xatu(2), Claydol(3), Spiritomb(4), Runerigus(5)
  UNOWN,
  STONJOURNER, ABSOL, XATU,
  CLAYDOL,
  SPIRITOMB,
  RUNERIGUS,
  // Ascender (2/4): Klawf(1), Gogoat(2), Sneasler(3), Aerodactyl(4), Tapu Koko(5)
  KLAWF,
  GOGOAT,
  SNEASLER,
  AERODACTYL,
  TAPU_KOKO,
  // Rogue: Salamence(5)
  SALAMENCE,
  // Zen / Crashout: Darmanitan(4)
  DARMANITAN,
  // Soul Bonded: Latios(5), Latias(5)
  LATIOS, LATIAS,
  // Froststone (2/4/6): Snorunt(1), Froslass(2), Weavile(2), H-Avalugg(3), Abomasnow(4), Mamoswine(4)
  SNORUNT,
  FROSLASS, WEAVILE,
  H_AVALUGG,
  ABOMASNOW, MAMOSWINE,
  // Summons
  GOLETT, GOLURK, MEGA_GOLURK,
  // Ascender cliffs
  CLIFF_L, CLIFF_R,
  // Substitutor sub dummy
  SUBSTITUTOR_SUB,
  // Creeps (PvE rounds)
  CREEP_DIGLETT, CREEP_SLOWBRO, CREEP_G_SLOWBRO,
  // Testing
  DUMMY, DUMMY_MELEE, DUMMY_RANGED,
]

export const UNIT_MAP: Map<string, UnitDefinition> = new Map(
  ALL_UNITS.map(u => [u.id, u])
)
