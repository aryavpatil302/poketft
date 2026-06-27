import type { ItemDefinition } from '../core/types'

// ─── Component items (single-component, pure stat) ────────────────────────────

export const BF_SWORD: ItemDefinition = {
  id: 'bf_sword',
  name: 'B.F. Sword',
  description: '+20 Attack Damage',
  statBonus: { attack: 20 },
}

export const RECURVE_BOW: ItemDefinition = {
  id: 'recurve_bow',
  name: 'Recurve Bow',
  description: '+15% Attack Speed',
  statBonus: { attackSpeed: 0.15 },
}

export const NEEDLESSLY_LARGE_ROD: ItemDefinition = {
  id: 'needlessly_large_rod',
  name: 'Needlessly Large Rod',
  description: '+20 Special Attack',
  statBonus: { special: 20 },
}

export const CHAIN_VEST: ItemDefinition = {
  id: 'chain_vest',
  name: 'Chain Vest',
  description: '+20 Defense',
  statBonus: { defense: 20 },
}

export const NEGATRON_CLOAK: ItemDefinition = {
  id: 'negatron_cloak',
  name: 'Negatron Cloak',
  description: '+20 Sp. Defense',
  statBonus: { spDefense: 20 },
}

export const GIANTS_BELT: ItemDefinition = {
  id: 'giants_belt',
  name: "Giant's Belt",
  description: '+200 HP',
  statBonus: { hp: 200 },
}

export const TEAR_OF_THE_GODDESS: ItemDefinition = {
  id: 'tear_of_the_goddess',
  name: 'Tear of the Goddess',
  description: '+20 Starting Mana',
  statBonus: { startMana: 20 },
}

// ─── Combined items (with passives) ──────────────────────────────────────────

export const INFINITY_EDGE: ItemDefinition = {
  id: 'infinity_edge',
  name: 'Infinity Edge',
  description: '+35 Attack, +20% Crit Chance, +15% Crit Damage. Crits deal bonus true damage equal to 10% of missing HP.',
  statBonus: { attack: 35, critChance: 0.20, critDamage: 0.15 },
  passive: 'infinity_edge_passive',
}

export const RAGEBLADE: ItemDefinition = {
  id: 'rageblade',
  name: 'Rageblade',
  description: '+20% Attack Speed. On auto-attack hit, gain 8% Attack Speed until end of combat (stacks infinitely).',
  statBonus: { attackSpeed: 0.20 },
  passive: 'rageblade_passive',
}

export const BRAMBLE_VEST: ItemDefinition = {
  id: 'bramble_vest',
  name: 'Bramble Vest',
  description: '+40 Defense. On taking physical damage, deal 80 magic damage to the attacker.',
  statBonus: { defense: 40 },
  passive: 'bramble_vest_passive',
}

export const WARMOGS_ARMOR: ItemDefinition = {
  id: 'warmogs_armor',
  name: "Warmog's Armor",
  description: '+500 HP. Regenerate 3% of max HP per second.',
  statBonus: { hp: 500 },
  passive: 'warmogs_passive',
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ALL_ITEMS: ItemDefinition[] = [
  BF_SWORD, RECURVE_BOW, NEEDLESSLY_LARGE_ROD, CHAIN_VEST,
  NEGATRON_CLOAK, GIANTS_BELT, TEAR_OF_THE_GODDESS,
  INFINITY_EDGE, RAGEBLADE, BRAMBLE_VEST, WARMOGS_ARMOR,
]

export const ITEM_MAP: Map<string, ItemDefinition> = new Map(
  ALL_ITEMS.map(i => [i.id, i])
)
